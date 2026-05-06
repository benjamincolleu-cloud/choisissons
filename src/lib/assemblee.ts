import { supabase } from '../supabaseClient'

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

// Lois réelles en cours au Parlement (mai 2026) — utilisées si Supabase est vide
const FALLBACK_LAWS: ANLaw[] = [
  {
    id: 'an-simplification-eco',
    number: 'PLF Simplification',
    title: 'Projet de loi sur la simplification de la vie économique',
    description: "Réduction des normes administratives pour les entreprises. Simplification des procédures d'autorisation, allègement des obligations déclaratives et réforme du droit des sociétés.",
    category: 'Économie',
    stage: 'voting',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['simplification', 'économie', 'entreprises'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/17/dossiers/simplification_vie_economique',
  },
  {
    id: 'an-lpm-2024-2030',
    number: 'PLF LPM',
    title: 'Projet de loi de programmation militaire (LPM)',
    description: "Programmation des crédits de la défense nationale pour 2024-2030. Modernisation des équipements, recrutement et adaptation aux nouvelles menaces.",
    category: 'Sécurité',
    stage: 'voting',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['défense', 'armée', 'sécurité'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/17/dossiers/loi_programmation_militaire',
  },
  {
    id: 'an-acces-logement',
    number: 'PPL Logement',
    title: "Proposition de loi sur l'accès au logement",
    description: "Mesures pour faciliter l'accès au logement des ménages modestes : encadrement des loyers, renforcement de la garantie Visale et création de nouveaux dispositifs d'aide à l'accession.",
    category: 'Social',
    stage: 'voting',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['logement', 'social', 'loyers'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/17/dossiers/acces_logement',
  },
  {
    id: 'an-ia-numerique',
    number: 'PPL IA',
    title: "Loi sur l'intelligence artificielle et la souveraineté numérique",
    description: "Encadrement de l'IA dans les services publics et les entreprises. Création d'une autorité nationale de contrôle de l'IA.",
    category: 'Numérique',
    stage: 'review',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['ia', 'numérique', 'souveraineté'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/17/dossiers/ia_souverainete_numerique',
  },
  {
    id: 'an-plf-2026',
    number: 'PLF 2026',
    title: 'Projet de loi de finances 2026',
    description: "Budget de l'État pour l'année 2026. Recettes fiscales, dépenses publiques et réforme de la TVA sur les produits essentiels.",
    category: 'Économie',
    stage: 'review',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['budget', 'fiscalité', 'économie'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/17/dossiers/plf_2026',
  },
]

const CACHE_KEY      = 'an_cache'
const CACHE_TIME_KEY = 'an_cache_time'
const CACHE_TTL_MS   = 24 * 60 * 60 * 1000

export async function fetchDossiersLegislatifs(): Promise<ANLaw[]> {
  // Vérifier le cache localStorage (24h)
  try {
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY)
    if (cachedTime && Date.now() - Number(cachedTime) < CACHE_TTL_MS) {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) return JSON.parse(cached) as ANLaw[]
    }
  } catch { /* localStorage indisponible */ }

  // Lire depuis la table Supabase (remplie par l'Edge Function quotidienne)
  try {
    const { data, error } = await supabase
      .from('parliamentary_laws')
      .select('*')
      .order('synced_at', { ascending: false })

    if (!error && data && data.length > 0) {
      const laws: ANLaw[] = data.map(row => ({
        id:                 row.id,
        number:             row.number,
        title:              row.title,
        description:        row.description,
        category:           row.category,
        stage:              row.stage as ANLaw['stage'],
        parliamentVoteDate: row.parliament_vote_date,
        votes:              row.votes as ANLaw['votes'],
        tags:               row.tags as string[],
        officialUrl:        row.official_url,
      }))

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(laws))
        localStorage.setItem(CACHE_TIME_KEY, String(Date.now()))
      } catch { /* quota dépassé */ }

      return laws
    }
  } catch { /* Supabase indisponible */ }

  return FALLBACK_LAWS
}
