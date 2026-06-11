import { supabase } from '../supabaseClient'
import { generateVoteProof } from './identity'
import { showToast } from './toast'
import type { PendingVote } from '../types'

export function loadPendingVotes(): PendingVote[] {
  try {
    const raw = localStorage.getItem('pending_votes')
    return raw ? (JSON.parse(raw) as PendingVote[]) : []
  } catch { return [] }
}

export function savePendingVotes(votes: PendingVote[]): void {
  localStorage.setItem('pending_votes', JSON.stringify(votes))
}

export async function flushPendingVotes(): Promise<void> {
  const pending = loadPendingVotes()
  if (pending.length === 0) return
  const remaining: PendingVote[] = []
  for (const v of pending) {
    try {
      const proof = await generateVoteProof(v.proposalId, v.choice)
      const flushParams = {
        p_proposal_id: String(v.proposalId),
        p_user_hash: v.userHash,
        p_choice: v.choice,
        p_proof_hash: proof,
      }
      const { data, error } = await supabase.rpc('deposer_bulletin', flushParams)
      if (error || (data as { error?: string } | null)?.error === 'already_voted') {
        // drop silently
      } else if (data && (data as { error?: string }).error) {
        remaining.push(v)
      }
    } catch { remaining.push(v) }
  }
  savePendingVotes(remaining)
  if (remaining.length < pending.length) {
    showToast(`${pending.length - remaining.length} vote(s) en attente synchronisé(s).`, 'info')
  }
}
