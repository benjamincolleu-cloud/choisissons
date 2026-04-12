const VOTER_ID_KEY = 'civis_voter_id'

function getOrCreateVoterId(): string {
  const existing = localStorage.getItem(VOTER_ID_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(VOTER_ID_KEY, id)
  return id
}

async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Returns the SHA-256 hash of the persistent voter UUID.
 * The raw UUID never leaves this module — only the hash is sent to Supabase.
 * Utilisé uniquement pour les votes en attente (offline) avant connexion.
 */
export async function getVoterHash(): Promise<string> {
  const uuid = getOrCreateVoterId()
  return sha256(uuid)
}

/**
 * Derives the user_hash from a Supabase Auth user ID.
 * The raw user ID is hashed before any write to Supabase — same privacy guarantee as getVoterHash().
 * TODO Phase 2: FranceConnect — remplacer userId par l'identifiant FranceConnect vérifié.
 */
export async function getSupabaseIdentity(userId: string): Promise<string> {
  return sha256(userId)
}

/**
 * Generates a one-time proof hash for a specific vote.
 * Combines proposal, choice, voter UUID and timestamp so each proof is unique.
 * The raw UUID is used here only as entropy — it is never stored or sent.
 */
export async function generateVoteProof(
  proposalId: string,
  choice: string,
): Promise<string> {
  const uuid = getOrCreateVoterId()
  return sha256(`${proposalId}-${choice}-${uuid}-${Date.now()}`)
}
