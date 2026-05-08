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
    id: 'an-plf-2026',
    number: 'PLF 2026',
    title: 'Projet de loi de finances 2026',
    description: "Budget de l'État pour 2026. Recettes fiscales, dépenses publiques et trajectoire de réduction du déficit.",
    category: 'Économie',
    stage: 'voting',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['budget', 'fiscalité', 'économie'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/17/dossiers/PLF_2026',
  },
  {
    id: 'an-securite-retention',
    number: 'PPL Sécurité',
    title: 'Proposition de loi sur la sécurité et la rétention administrative',
    description: "Renforcement des mesures de sécurité, rétention administrative et prévention des risques d'attentat.",
    category: 'Sécurité',
    stage: 'voting',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['sécurité', 'rétention', 'attentat'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/17/dossiers',
  },
  {
    id: 'an-lpm-2024-2030',
    number: 'PLF LPM',
    title: 'Projet de loi de programmation militaire 2024-2030',
    description: "400 milliards d'euros pour moderniser les armées françaises sur la période 2024-2030.",
    category: 'Défense',
    stage: 'voting',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['défense', 'armée', 'budget'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/17/dossiers',
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
