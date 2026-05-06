import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AN_API_URLS = [
  'https://data.assemblee-nationale.fr/api/v2/dossiers-legislatifs',
  'https://www.assemblee-nationale.fr/dyn/opendata/AMDSJSON.json',
  'https://api.assemblee-nationale.fr/v1/dossiers-legislatifs',
]

interface LawRow {
  id: string
  number: string
  title: string
  description: string
  category: string
  stage: string
  parliament_vote_date: string
  votes: { pour: number; contre: number; blanc: number }
  tags: string[]
  official_url: string
  synced_at: string
}

const FALLBACK_LAWS: LawRow[] = [
  {
    id: 'an-simplification-eco',
    number: 'PLF Simplification',
    title: 'Projet de loi sur la simplification de la vie économique',
    description: "Réduction des normes administratives pour les entreprises. Simplification des procédures d'autorisation, allègement des obligations déclaratives et réforme du droit des sociétés.",
    category: 'Économie',
    stage: 'voting',
    parliament_vote_date: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['simplification', 'économie', 'entreprises'],
    official_url: 'https://www.assemblee-nationale.fr/dyn/17/dossiers/simplification_vie_economique',
    synced_at: new Date().toISOString(),
  },
  {
    id: 'an-lpm-2024-2030',
    number: 'PLF LPM',
    title: 'Projet de loi de programmation militaire (LPM)',
    description: "Programmation des crédits de la défense nationale pour 2024-2030. Modernisation des équipements, recrutement et adaptation aux nouvelles menaces.",
    category: 'Sécurité',
    stage: 'voting',
    parliament_vote_date: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['défense', 'armée', 'sécurité'],
    official_url: 'https://www.assemblee-nationale.fr/dyn/17/dossiers/loi_programmation_militaire',
    synced_at: new Date().toISOString(),
  },
  {
    id: 'an-acces-logement',
    number: 'PPL Logement',
    title: "Proposition de loi sur l'accès au logement",
    description: "Mesures pour faciliter l'accès au logement des ménages modestes : encadrement des loyers, renforcement de la garantie Visale et création de nouveaux dispositifs d'aide à l'accession.",
    category: 'Social',
    stage: 'voting',
    parliament_vote_date: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['logement', 'social', 'loyers'],
    official_url: 'https://www.assemblee-nationale.fr/dyn/17/dossiers/acces_logement',
    synced_at: new Date().toISOString(),
  },
  {
    id: 'an-ia-numerique',
    number: 'PPL IA',
    title: "Loi sur l'intelligence artificielle et la souveraineté numérique",
    description: "Encadrement de l'IA dans les services publics et les entreprises. Création d'une autorité nationale de contrôle de l'IA.",
    category: 'Numérique',
    stage: 'review',
    parliament_vote_date: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['ia', 'numérique', 'souveraineté'],
    official_url: 'https://www.assemblee-nationale.fr/dyn/17/dossiers/ia_souverainete_numerique',
    synced_at: new Date().toISOString(),
  },
  {
    id: 'an-plf-2026',
    number: 'PLF 2026',
    title: 'Projet de loi de finances 2026',
    description: "Budget de l'État pour l'année 2026. Recettes fiscales, dépenses publiques et réforme de la TVA sur les produits essentiels.",
    category: 'Économie',
    stage: 'review',
    parliament_vote_date: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['budget', 'fiscalité', 'économie'],
    official_url: 'https://www.assemblee-nationale.fr/dyn/17/dossiers/plf_2026',
    synced_at: new Date().toISOString(),
  },
]

function mapCategory(label: string): string {
  const t = label.toLowerCase()
  if (t.includes('financ') || t.includes('budget') || t.includes('fiscal') || t.includes('économi')) return 'Économie'
  if (t.includes('social') || t.includes('santé') || t.includes('retraite') || t.includes('logement')) return 'Social'
  if (t.includes('environnement') || t.includes('écologi') || t.includes('climat')) return 'Environnement'
  if (t.includes('numérique') || t.includes('digital') || t.includes('technolog') || t.includes('ia')) return 'Numérique'
  if (t.includes('sécurité') || t.includes('défense') || t.includes('justice') || t.includes('militaire')) return 'Sécurité'
  if (t.includes('éducation') || t.includes('culture') || t.includes('enseignement')) return 'Éducation'
  return label || 'Divers'
}

function extractDossiers(raw: unknown): unknown[] {
  if (!raw || typeof raw !== 'object') return []
  const r = raw as Record<string, unknown>
  if (Array.isArray(r.dossiers)) return r.dossiers
  const exp = r.export as Record<string, unknown> | undefined
  if (exp) {
    const dl = exp.dossiersLegislatifs as Record<string, unknown> | undefined
    if (dl && Array.isArray(dl.dossierLegislatif)) return dl.dossierLegislatif
  }
  if (Array.isArray(raw)) return raw
  return []
}

function mapDossier(d: unknown, index: number): LawRow | null {
  if (!d || typeof d !== 'object') return null
  const r = d as Record<string, unknown>
  const uid   = (r.uid ?? r.id ?? `an-${index}`) as string
  const titre = (r.titre ?? r.titreCourt ?? r.title ?? '') as string
  if (!titre) return null

  const rawThemes = (r.themes ?? r.theme ?? []) as unknown[]
  const themes: string[] = Array.isArray(rawThemes)
    ? rawThemes.map(t => (typeof t === 'string' ? t : ((t as Record<string, unknown>).libelle as string) ?? '')).filter(Boolean)
    : []

  const numMatch = uid.match(/(\d+)$/)
  return {
    id: `an-${uid}`,
    number: numMatch ? `n°${numMatch[1]}` : uid,
    title: titre,
    description: ((r.description ?? r.expose ?? '') as string) || titre,
    category: mapCategory(themes[0] ?? (r.libelleTheme as string) ?? ''),
    stage: 'voting',
    parliament_vote_date: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: themes.slice(0, 3).map(t => t.toLowerCase()),
    official_url: (r.urlAn ?? r.url ?? `https://www.assemblee-nationale.fr/dyn/17/dossiers/${uid}`) as string,
    synced_at: new Date().toISOString(),
  }
}

async function fetchFromAN(): Promise<LawRow[] | null> {
  for (const url of AN_API_URLS) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
      if (!res.ok) continue
      const raw: unknown = await res.json()
      console.log(`[sync-an-laws] ${url} →`, JSON.stringify(raw).slice(0, 300))
      const dossiers = extractDossiers(raw)
      const laws = dossiers.slice(0, 20).map((d, i) => mapDossier(d, i)).filter((l): l is LawRow => l !== null)
      if (laws.length > 0) return laws
    } catch (e) {
      console.log(`[sync-an-laws] ${url} erreur:`, e)
    }
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const fromAN = await fetchFromAN()
  const laws = fromAN ?? FALLBACK_LAWS
  const source = fromAN ? 'API Assemblée Nationale' : 'fallback statique'

  const { error } = await supabase
    .from('parliamentary_laws')
    .upsert(laws, { onConflict: 'id' })

  if (error) {
    console.error('[sync-an-laws] Upsert error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  console.log(`[sync-an-laws] ${laws.length} lois synchronisées depuis ${source}`)
  return new Response(
    JSON.stringify({ ok: true, count: laws.length, source }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
