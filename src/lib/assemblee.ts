import { supabase } from '../supabaseClient'

// Matches the ParliamentaryLaw interface in App.tsx
export interface ANLaw {
  id: string
  number: string
  title: string
  description: string
  resume: string        // résumé en langage clair, non officiel
  category: string
  stage: 'seedling' | 'review' | 'voting' | 'adopted' | 'rejected' | 'closed' | 'archived' | 'upcoming'
  parliamentVoteDate: string
  votes: { pour: number; contre: number; blanc: number }  // votes citoyens
  assembleePour: number
  assembleeContre: number
  assembleeAbstention: number
  assembleeSort: string
  tags: string[]
  officialUrl: string
}

const ZERO_ASSEMBLEE = { assembleePour: 0, assembleeContre: 0, assembleeAbstention: 0, assembleeSort: '' }

// Lois réelles en cours au Parlement (mai 2026) — utilisées si Supabase est vide
const FALLBACK_LAWS: ANLaw[] = [
  {
    id: 'an-souverainete-france',
    number: 'PPL Constitutionnelle',
    title: 'Proposition de loi sur la souveraineté de la France',
    description: "Proposition de loi constitutionnelle déposée le 7 mai 2026. En cours : 1ère lecture à l'Assemblée nationale.",
    resume: '',
    category: 'Institutions',
    stage: 'voting',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    ...ZERO_ASSEMBLEE,
    tags: ['constitution', 'souveraineté', 'institutions'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/17/dossiers?limit=25&searchText=souverainet%C3%A9+de+la+France',
  },
  {
    id: 'an-cybersecurite',
    number: 'PLF Numérique',
    title: 'Projet de loi sur la cybersécurité et la résilience numérique',
    description: "Encadrement de la cybersécurité des entreprises et collectivités. Examen prévu avant l'été 2026.",
    resume: '',
    category: 'Numérique',
    stage: 'voting',
    parliamentVoteDate: '',
    votes: { pour: 0, contre: 0, blanc: 0 },
    ...ZERO_ASSEMBLEE,
    tags: ['cybersécurité', 'numérique', 'résilience'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/17/dossiers?limit=25&searchText=cybers%C3%A9curit%C3%A9+r%C3%A9silience',
  },
  {
    id: 'an-retention-administrative',
    number: 'PPL Sécurité',
    title: 'Proposition de loi sur la rétention administrative',
    description: "Renforcement des mesures de sécurité et prévention des risques d'attentat. Adoptée le 5 mai 2026.",
    resume: '',
    category: 'Sécurité',
    stage: 'adopted',
    parliamentVoteDate: '5 mai 2026',
    votes: { pour: 0, contre: 0, blanc: 0 },
    ...ZERO_ASSEMBLEE,
    tags: ['sécurité', 'rétention', 'attentat'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/17/dossiers?limit=25&searchText=r%C3%A9tention+administrative+s%C3%A9curit%C3%A9',
  },
]

const CACHE_KEY      = 'an_cache'
const CACHE_TIME_KEY = 'an_cache_time'

export async function fetchDossiersLegislatifs(): Promise<ANLaw[]> {
  // Vider le cache pour forcer un rechargement propre depuis Supabase
  try {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(CACHE_TIME_KEY)
  } catch { /* ignore */ }

  // Lire depuis la table Supabase (remplie par l'Edge Function quotidienne)
  try {
    const { data, error } = await supabase
      .from('parliamentary_laws')
      // votes_pour/contre/blanc = colonnes entières mises à jour par deposer_bulletin
      // Ne pas lire le champ JSONB "votes" — il n'est jamais mis à jour
      .select('id, number, title, description, resume, category, stage, parliament_vote_date, votes_pour, votes_contre, votes_blanc, assemblee_pour, assemblee_contre, assemblee_abstention, assemblee_sort, tags, official_url, synced_at')
      .order('synced_at', { ascending: false })

    if (!error && data && data.length > 0) {
      const laws: ANLaw[] = data.map(row => {
        return {
          id:                  row.id,
          number:              row.number,
          title:               row.title,
          description:         row.description,
          resume:              row.resume ?? '',
          category:            row.category,
          stage:               row.stage as ANLaw['stage'],
          parliamentVoteDate:  row.parliament_vote_date ?? '',
          votes:               { pour: row.votes_pour ?? 0, contre: row.votes_contre ?? 0, blanc: row.votes_blanc ?? 0 },
          assembleePour:       row.assemblee_pour ?? 0,
          assembleeContre:     row.assemblee_contre ?? 0,
          assembleeAbstention: row.assemblee_abstention ?? 0,
          assembleeSort:       row.assemblee_sort ?? '',
          tags:                (row.tags as string[]) ?? [],
          officialUrl:         row.official_url ?? '',
        }
      })

      return laws
    }
  } catch { /* Supabase indisponible */ }

  return FALLBACK_LAWS
}
