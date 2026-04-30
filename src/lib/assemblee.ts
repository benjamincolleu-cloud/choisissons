const AN_API_URL = 'https://api.an.fr/dossiers-legislatifs/json'

// Matches the ParliamentaryLaw interface in App.tsx
export interface ANLaw {
  id: string
  number: string
  title: string
  description: string
  category: string
  stage: 'seedling' | 'review' | 'voting' | 'adopted' | 'rejected' | 'closed'
  parliamentVoteDate: string
  votes: { pour: number; contre: number; blanc: number }
  tags: string[]
  officialUrl: string
}

// Maps AN procedure codes/labels to app categories
function mapCategory(themes: string[]): string {
  if (!themes.length) return 'Divers'
  const t = themes[0].toLowerCase()
  if (t.includes('financ') || t.includes('budget') || t.includes('fiscal') || t.includes('économi')) return 'Économie'
  if (t.includes('social') || t.includes('santé') || t.includes('retraite')) return 'Social'
  if (t.includes('environnement') || t.includes('écologi') || t.includes('climat')) return 'Environnement'
  if (t.includes('numérique') || t.includes('digital') || t.includes('technolog')) return 'Numérique'
  if (t.includes('sécurité') || t.includes('défense') || t.includes('justice')) return 'Sécurité'
  if (t.includes('éducation') || t.includes('culture') || t.includes('enseignement')) return 'Éducation'
  return themes[0]
}

// Extracts the last ongoing step date as vote date
function extractVoteDate(etapes: unknown[]): string {
  if (!Array.isArray(etapes) || !etapes.length) return ''
  const last = etapes[etapes.length - 1] as Record<string, unknown>
  const d = (last.dateDebut ?? last.date ?? '') as string
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return d
  }
}

// Normalises the raw AN JSON into a flat dossier array regardless of envelope shape
function extractDossiers(raw: unknown): unknown[] {
  if (!raw || typeof raw !== 'object') return []
  const r = raw as Record<string, unknown>

  // Shape A: { dossiers: [...] }
  if (Array.isArray(r.dossiers)) return r.dossiers

  // Shape B: { export: { dossiersLegislatifs: { dossierLegislatif: [...] } } }
  const exp = r.export as Record<string, unknown> | undefined
  if (exp) {
    const dl = exp.dossiersLegislatifs as Record<string, unknown> | undefined
    if (dl) {
      const inner = dl.dossierLegislatif
      if (Array.isArray(inner)) return inner
    }
  }

  // Shape C: top-level array
  if (Array.isArray(raw)) return raw

  return []
}

function mapDossier(d: unknown, index: number): ANLaw | null {
  if (!d || typeof d !== 'object') return null
  const r = d as Record<string, unknown>

  const uid    = (r.uid ?? r.id ?? `an-${index}`) as string
  const titre  = (r.titre ?? r.title ?? r.titreCourt ?? '') as string
  if (!titre) return null

  // Themes — may be array of strings or array of objects with .libelle
  const rawThemes = (r.themes ?? r.theme ?? []) as unknown[]
  const themes: string[] = Array.isArray(rawThemes)
    ? rawThemes.map(t => (typeof t === 'string' ? t : (t as Record<string, unknown>).libelle as string ?? '')).filter(Boolean)
    : []

  // Stage — map from procedure or last step
  const procedure = ((r.procedureParlementaire as Record<string, unknown> | undefined)?.libelle ?? r.type ?? '') as string
  const stage: ANLaw['stage'] = procedure.toLowerCase().includes('adopté') ? 'adopted' : 'voting'

  // Vote date from etapes / actesLegislatifs
  const etapes = (r.etapes ?? (r.actesLegislatifs as Record<string, unknown> | undefined)?.acteLegislatif ?? []) as unknown[]
  const parliamentVoteDate = extractVoteDate(Array.isArray(etapes) ? etapes : [])

  // Official URL
  const officialUrl = (r.urlAn ?? r.url ?? `https://www.assemblee-nationale.fr/dyn/17/dossiers/${uid}`) as string

  // Numero — extract from uid (e.g. "DLR5L17B0123" → "n°123")
  const numMatch = uid.match(/(\d+)$/)
  const number   = numMatch ? `n°${numMatch[1]}` : uid

  return {
    id: `an-${uid}`,
    number,
    title: titre,
    description: (r.description ?? r.expose ?? '') as string || titre,
    category: mapCategory(themes),
    stage,
    parliamentVoteDate,
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: themes.slice(0, 3).map(t => t.toLowerCase()),
    officialUrl,
  }
}

export async function fetchDossiersLegislatifs(): Promise<ANLaw[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(AN_API_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timeout)

    if (!res.ok) return []

    const raw: unknown = await res.json()
    const dossiers = extractDossiers(raw)

    const laws = dossiers
      .slice(0, 20)                          // limit to 20 most recent
      .map((d, i) => mapDossier(d, i))
      .filter((l): l is ANLaw => l !== null)

    return laws
  } catch {
    return []
  }
}
