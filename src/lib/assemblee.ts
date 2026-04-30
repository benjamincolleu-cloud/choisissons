const AN_API_URL = 'https://www.assemblee-nationale.fr/dyn/opendata/AMDSJSON.json'

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

const FALLBACK_LAWS: ANLaw[] = [
  {
    id: 'an-plf-2026',
    number: 'PLF 2026',
    title: 'Projet de loi de finances 2026',
    description: "Budget de l'État pour l'année 2026. Recettes fiscales, dépenses publiques et réforme de la TVA.",
    category: 'Économie',
    stage: 'voting',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['budget', 'fiscalité', 'économie'],
    officialUrl: 'https://www.assemblee-nationale.fr',
  },
  {
    id: 'an-ia-numerique',
    number: 'PPL IA',
    title: "Loi sur l'intelligence artificielle et la souveraineté numérique",
    description: "Encadrement de l'IA dans les services publics et les entreprises. Création d'une autorité nationale de contrôle.",
    category: 'Numérique',
    stage: 'voting',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['ia', 'numérique', 'souveraineté'],
    officialUrl: 'https://www.assemblee-nationale.fr',
  },
  {
    id: 'an-retraites-complementaires',
    number: 'PPL Retraites',
    title: 'Réforme des retraites complémentaires',
    description: 'Modification des règles de calcul des pensions complémentaires AGIRC-ARRCO.',
    category: 'Social',
    stage: 'review',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['retraites', 'social', 'travail'],
    officialUrl: 'https://www.assemblee-nationale.fr',
  },
]

function mapCategory(label: string): string {
  const t = label.toLowerCase()
  if (t.includes('financ') || t.includes('budget') || t.includes('fiscal') || t.includes('économi')) return 'Économie'
  if (t.includes('social') || t.includes('santé') || t.includes('retraite')) return 'Social'
  if (t.includes('environnement') || t.includes('écologi') || t.includes('climat')) return 'Environnement'
  if (t.includes('numérique') || t.includes('digital') || t.includes('technolog') || t.includes('ia')) return 'Numérique'
  if (t.includes('sécurité') || t.includes('défense') || t.includes('justice')) return 'Sécurité'
  if (t.includes('éducation') || t.includes('culture') || t.includes('enseignement')) return 'Éducation'
  return label || 'Divers'
}

function extractDossiers(raw: unknown): unknown[] {
  if (!raw || typeof raw !== 'object') return []
  const r = raw as Record<string, unknown>

  if (Array.isArray(r.dossiers)) return r.dossiers
  if (Array.isArray(r.amendements)) return r.amendements

  // { export: { dossiersLegislatifs: { dossierLegislatif: [...] } } }
  const exp = r.export as Record<string, unknown> | undefined
  if (exp) {
    const dl = exp.dossiersLegislatifs as Record<string, unknown> | undefined
    if (dl && Array.isArray(dl.dossierLegislatif)) return dl.dossierLegislatif
  }

  if (Array.isArray(raw)) return raw
  return []
}

function mapDossier(d: unknown, index: number): ANLaw | null {
  if (!d || typeof d !== 'object') return null
  const r = d as Record<string, unknown>

  const uid   = (r.uid ?? r.id ?? `an-${index}`) as string
  const titre = (r.titre ?? r.titreCourt ?? r.title ?? '') as string
  if (!titre) return null

  const rawThemes = (r.themes ?? r.theme ?? []) as unknown[]
  const themes: string[] = Array.isArray(rawThemes)
    ? rawThemes
        .map(t => (typeof t === 'string' ? t : ((t as Record<string, unknown>).libelle as string) ?? ''))
        .filter(Boolean)
    : []

  const categorySource = themes[0] ?? (r.libelleTheme as string) ?? ''
  const numMatch = uid.match(/(\d+)$/)

  return {
    id: `an-${uid}`,
    number: numMatch ? `n°${numMatch[1]}` : uid,
    title: titre,
    description: ((r.description ?? r.expose ?? '') as string) || titre,
    category: mapCategory(categorySource),
    stage: 'voting',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: themes.slice(0, 3).map(t => t.toLowerCase()),
    officialUrl: (r.urlAn ?? r.url ?? `https://www.assemblee-nationale.fr/dyn/17/dossiers/${uid}`) as string,
  }
}

const CACHE_KEY      = 'an_cache'
const CACHE_TIME_KEY = 'an_cache_time'
const CACHE_TTL_MS   = 24 * 60 * 60 * 1000

export async function fetchDossiersLegislatifs(): Promise<ANLaw[]> {
  try {
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY)
    if (cachedTime) {
      const age = Date.now() - Number(cachedTime)
      if (age < CACHE_TTL_MS) {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) return JSON.parse(cached) as ANLaw[]
      }
    }
  } catch { /* localStorage indisponible — continuer sans cache */ }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(AN_API_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timeout)

    if (!res.ok) return FALLBACK_LAWS

    const raw: unknown = await res.json()
    const dossiers = extractDossiers(raw)

    const laws = dossiers
      .slice(0, 20)
      .map((d, i) => mapDossier(d, i))
      .filter((l): l is ANLaw => l !== null)

    const result = laws.length > 0 ? laws : FALLBACK_LAWS

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(result))
      localStorage.setItem(CACHE_TIME_KEY, String(Date.now()))
    } catch { /* quota dépassé — pas bloquant */ }

    return result
  } catch {
    return FALLBACK_LAWS
  }
}
