import { supabase } from '../supabaseClient'
import { generateVoteProof } from './identity'
import type { PendingVote, VoteConfirme } from '../types'

export const LOGIN_TO_VOTE_MESSAGE = 'Connectez-vous pour que votre vote compte. Votre choix est gardé et sera envoyé dès votre connexion.'

// Libellés des choix, pour les messages de confirmation
export const LIBELLE_CHOIX: Record<string, string> = { YES: 'Pour', NO: 'Contre', ABSTAIN: 'Blanc' }

// Votes d'un visiteur confirmés à sa connexion : lus (puis effacés) par la page des lois
export const VOTES_CONFIRMES_EVENT = 'choisissons:votes-confirmes'
export function lireVotesConfirmes(): VoteConfirme[] {
  try {
    const raw = localStorage.getItem('votes_confirmes')
    return raw ? (JSON.parse(raw) as VoteConfirme[]) : []
  } catch { return [] }
}
export function effacerVotesConfirmes(): void {
  try { localStorage.removeItem('votes_confirmes') } catch { /* ignore */ }
}

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
  const confirmes: VoteConfirme[] = []
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
      const res = (data ?? {}) as { success?: boolean; already_voted?: boolean; error?: string }
      if (error) {
        // erreur réseau ou serveur : on garde le vote pour la prochaine connexion
        remaining.push(v)
      } else if (res.success || res.already_voted) {
        confirmes.push({ proposalId: v.proposalId, lawId: v.lawId, title: v.title, choice: v.choice, statut: res.success ? 'enregistre' : 'deja_vote' })
      } else if (res.error) {
        remaining.push(v)
      }
    } catch { remaining.push(v) }
  }
  savePendingVotes(remaining)
  if (confirmes.length > 0) {
    try { localStorage.setItem('votes_confirmes', JSON.stringify([...lireVotesConfirmes(), ...confirmes])) } catch { /* ignore */ }
    // La page des lois rouvre la loi et affiche la confirmation ; sinon, simple message
    window.dispatchEvent(new Event(VOTES_CONFIRMES_EVENT))
  }
}
