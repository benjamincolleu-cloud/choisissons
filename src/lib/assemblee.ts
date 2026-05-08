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
    id: 'an-souverainete-france',
    number: 'PPL Constitutionnelle',
    title: 'Proposition de loi sur la souveraineté de la France',
    description: "Proposition de loi constitutionnelle déposée le 7 mai 2026. En cours : 1ère lecture à l'Assemblée nationale.",
    category: 'Institutions',
    stage: 'voting',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['constitution', 'souveraineté', 'institutions'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/17/dossiers?limit=25&searchText=souverainet%C3%A9+de+la+France',
  },
  {
    id: 'an-cybersecurite',
    number: 'PLF Numérique',
    title: 'Projet de loi sur la cybersécurité et la résilience numérique',
    description: "Encadrement de la cybersécurité des entreprises et collectivités. Examen prévu avant l'été 2026.",
    category: 'Numérique',
    stage: 'voting',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['cybersécurité', 'numérique', 'résilience'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/17/dossiers?limit=25&searchText=cybers%C3%A9curit%C3%A9+r%C3%A9silience',
  },
  {
    id: 'an-retention-administrative',
    number: 'PPL Sécurité',
    title: 'Proposition de loi sur la rétention administrative',
    description: "Renforcement des mesures de sécurité et prévention des risques d'attentat. Adoptée le 5 mai 2026.",
    category: 'Sécurité',
    stage: 'adopted',
    parliamentVoteDate: '5 mai 2026',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['sécurité', 'rétention', 'attentat'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/17/dossiers?limit=25&searchText=r%C3%A9tention+administrative+s%C3%A9curit%C3%A9',
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
