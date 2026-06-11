// ── Types ──────────────────────────────────────────────────────
export type Stage = 'seedling' | 'review' | 'voting' | 'adopted' | 'rejected' | 'closed' | 'archived' | 'upcoming'
export type VoteChoice = 'pour' | 'contre' | 'blanc'
export type NavPage = 'home' | 'explore' | 'reseau' | 'profile' | 'support' | 'impact' | 'library' | 'elu' | 'org' | 'admin' | 'commune' | 'commune-register' | 'assoc-register'

export interface Argument {
  id: string
  type: 'pour' | 'contre'
  text: string
  author: string
  likes: number
}

export interface Proposal {
  id: string
  title: string
  description: string
  resume?: string
  category: string
  stage: Stage
  votes: { pour: number; contre: number; blanc: number }
  signatures: number
  targetSignatures: number
  arguments: Argument[]
  author: string
  date: string
  tags: string[]
  blockchainProof?: string
}

// ── Supabase row shape ─────────────────────────────────────────
export interface ProposalRow {
  id: string
  title: string
  description: string
  category: string
  status: string
  supports: number
  votes_pour: number
  votes_contre: number
  votes_blanc: number
  tags: string[] | null
  created_at: string
  blockchain_proof?: string | null
}

// ── Toast system ───────────────────────────────────────────────
export interface ToastEntry { id: number; message: string; type: 'error' | 'warning' | 'info' }

// ── Pending votes ──────────────────────────────────────────────
export interface PendingVote { proposalId: string; userHash: string; choice: string; timestamp?: number }

// ── Parliamentary Laws data ────────────────────────────────────
export interface ParliamentaryLaw {
  id: string
  number: string
  title: string
  description: string
  resume: string
  category: string
  stage: Stage
  parliamentVoteDate: string
  votes: { pour: number; contre: number; blanc: number }
  assembleePour: number
  assembleeContre: number
  assembleeAbstention: number
  assembleeSort: string
  tags: string[]
  officialUrl: string
}

// ── Organisation types ─────────────────────────────────────────
export interface Organisation {
  id: string
  name: string
  type: 'commune' | 'ong' | 'media'
  description: string
  population?: number
  code_insee?: string
  abonnement?: boolean
}

export type CommuneRole = 'member' | 'admin' | 'elu' | 'agent_com' | 'lecteur_admin'
export type CommuneAction = 'create_consultation' | 'publish_news' | 'publish_agenda' | 'publish_editorial' | 'upload_bulletin' | 'manage_members' | 'view_stats'

export interface CommuneNews {
  id: string
  organisation_id: string
  title: string
  content: string
  category: 'info' | 'travaux' | 'evenement' | 'urgence'
  author_name?: string
  published_at: string
  created_by?: string
  is_published: boolean
}

export interface CommuneEvent {
  id: string
  organisation_id: string
  title: string
  description?: string
  event_date: string
  end_date?: string
  location?: string
  category: 'conseil' | 'fete' | 'marche' | 'reunion' | 'autre'
  created_by?: string
  is_published: boolean
}

// ── Account Page ───────────────────────────────────────────────
export interface VoteRecord {
  proposalId: string
  title: string
  date: string
}

export interface MyProposalRecord {
  id: string
  title: string
  stage: Stage
  supports?: number
}

// ── Agora Modal ────────────────────────────────────────────────
export interface DbArg {
  id: number
  side: 'pour' | 'contre'
  content: string
  author_hash: string
  created_at: string
  flags_count: number
}

// ── Member management (admin only) ───────────────────────────
export interface TeamMember { id: string; user_hash: string; role: CommuneRole; created_at: string }

// ── Org Dashboard ──────────────────────────────────────────────
export interface OrgProposal {
  id: string
  title: string
  status: string
  votes_pour: number
  votes_contre: number
  votes_blanc: number
  created_at: string
}

export interface OrgComment {
  id: string
  proposal_id: string
  organisation_id: string
  content: string
  created_at: string
}

// ── Admin Dashboard ───────────────────────────────────────────
export interface AdminProposal {
  id: string
  title: string
  description: string
  status: string
  supports: number
  created_at: string
  blockchain_proof?: string | null
}

// ── Elected Dashboard / Commune Page ────────────────────────────────
export interface LocalConsultation {
  id: string
  title: string
  description: string
  status: string
  created_at: string
  votes_pour: number
  votes_contre: number
  votes_blanc: number
}

// ── Library Page ──────────────────────────────────────────────
export type LibraryEntry = {
  id: string
  title: string
  description: string
  category: string
  status: string
  type: 'citizen' | 'law'
  votes_pour: number
  votes_contre: number
  votes_blanc: number
  date: string
}
