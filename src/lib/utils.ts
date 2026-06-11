import type { Proposal, ProposalRow, ParliamentaryLaw, Stage, CommuneRole, CommuneAction } from '../types'
import { FR_MOIS, CITIZEN_VOTE_DAYS } from './constants'

export function mapRowToProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    stage: (row.status as Stage) ?? 'seedling',
    votes: { pour: row.votes_pour ?? 0, contre: row.votes_contre ?? 0, blanc: row.votes_blanc ?? 0 },
    signatures: row.supports ?? 0,
    targetSignatures: 10,
    arguments: [],
    author: 'Proposé par la communauté',
    date: row.created_at?.slice(0, 10) ?? '',
    tags: row.tags ?? [],
    blockchainProof: row.blockchain_proof ?? undefined,
  }
}

export function sha256Hex(text: string): Promise<string> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(buf =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  )
}

export function isAtLeast18(dateStr: string): boolean {
  const birth = new Date(dateStr)
  const limit = new Date(birth.getFullYear() + 18, birth.getMonth(), birth.getDate())
  return new Date() >= limit
}

export function emailToDisplayName(email: string): string {
  const local = email.split('@')[0] ?? email
  return local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function nameToInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')
}

export function parseFrDate(s: string): number {
  if (!s) return Infinity
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const t = new Date(s).getTime()
    return isNaN(t) ? Infinity : t
  }
  const parts = s.trim().split(/\s+/)
  if (parts.length === 3) {
    const day = parseInt(parts[0])
    const month = FR_MOIS[parts[1].toLowerCase()]
    const year = parseInt(parts[2])
    if (!isNaN(day) && month !== undefined && !isNaN(year))
      return new Date(year, month, day).getTime()
  }
  return Infinity
}

export function isCitizenVoteClosedFn(law: { stage: string; parliamentVoteDate: string }, nowMs = Date.now()): boolean {
  if (law.stage === 'closed' || law.stage === 'archived') return true
  const dateMs = parseFrDate(law.parliamentVoteDate)
  return dateMs !== Infinity && nowMs >= dateMs + CITIZEN_VOTE_DAYS * 24 * 3600 * 1000
}

export function citizenDeadlineMs(law: { parliamentVoteDate: string }): number {
  const t = parseFrDate(law.parliamentVoteDate)
  return t === Infinity ? Infinity : t + CITIZEN_VOTE_DAYS * 24 * 3600 * 1000
}

export function lawToProposal(law: ParliamentaryLaw): Proposal {
  const effectiveStage: Stage = isCitizenVoteClosedFn(law) ? 'closed' : 'voting'
  return {
    id: law.id,
    title: law.title,
    description: law.description,
    resume: law.resume,
    category: law.category,
    stage: effectiveStage,
    votes: law.votes,
    signatures: 0,
    targetSignatures: 10,
    arguments: [],
    author: 'Assemblée Nationale',
    date: law.parliamentVoteDate,
    tags: law.tags,
  }
}

export function canDo(role: CommuneRole, action: CommuneAction): boolean {
  const matrix: Record<CommuneAction, CommuneRole[]> = {
    create_consultation: ['admin', 'elu'],
    publish_news: ['admin', 'elu', 'agent_com'],
    publish_agenda: ['admin', 'elu', 'agent_com'],
    publish_editorial: ['admin', 'elu'],
    upload_bulletin: ['admin', 'agent_com'],
    manage_members: ['admin'],
    view_stats: ['admin', 'elu', 'agent_com', 'lecteur_admin'],
  }
  return matrix[action]?.includes(role) ?? false
}
