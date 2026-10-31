/**
 * TESTS D'INTÉGRATION CRITIQUES — Vote sur une loi parlementaire
 * Règles en vigueur depuis le 30/10/2026 (voir VOTE_SAFETY.md) :
 *   - seul un citoyen connecté peut voter ;
 *   - le vote est définitif (un seul vote par personne et par loi) ;
 *   - l'identifiant du votant est calculé par la base à partir du compte connecté :
 *     celui envoyé par l'appli est ignoré (impossible de voter à la place d'un autre) ;
 *   - personne ne peut écrire directement dans les compteurs, le registre ou l'urne.
 *
 * Ces tests tournent contre la vraie base Supabase (pas de simulation).
 * Ils créent 1 loi de test et 2 comptes citoyens temporaires, tous supprimés à la fin.
 *
 * Variables d'environnement requises (voir tests/.env.test.example) :
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { config } from 'dotenv'

config({ path: '.env.test' })

// ── Clients Supabase ───────────────────────────────────────────
const SUPABASE_URL              = process.env.SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY         = process.env.SUPABASE_ANON_KEY ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    '❌ Variables manquantes. Copie tests/.env.test.example → .env.test et remplis les valeurs.'
  )
}

const OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } }

// Admin : préparation, nettoyage et vérifications directes en base
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPTIONS)

// Visiteur : même clé publique que l'appli, sans être connecté
const visiteur = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, OPTIONS)

// ── Identifiants uniques pour ce passage ───────────────────────
const RUN_ID      = `${Date.now()}`
const TEST_NUMBER = `TEST-VOTE-${RUN_ID}`
const MOT_DE_PASSE = randomBytes(18).toString('base64url')

interface Citoyen { id: string; hash: string; client: SupabaseClient }
const comptesCrees: { id: string; client: SupabaseClient }[] = []

// Même calcul que la base : sha256 (hexadécimal) de l'identifiant du compte
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

// ── Aides ──────────────────────────────────────────────────────
async function connecter(client: SupabaseClient, email: string) {
  const { error } = await client.auth.signInWithPassword({ email, password: MOT_DE_PASSE })
  if (!error) return
  // Secours : lien magique, la méthode de connexion utilisée par l'appli
  const { data, error: lienErreur } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = data?.properties?.hashed_token
  if (lienErreur || !tokenHash) {
    throw new Error(`Connexion impossible (${error.message} / ${lienErreur?.message ?? 'pas de lien'})`)
  }
  const { error: otpErreur } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
  if (otpErreur) throw new Error(`Connexion par lien magique impossible : ${otpErreur.message}`)
}

async function creerCitoyen(n: number): Promise<Citoyen> {
  const email = `test-vote-${RUN_ID}-${n}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: MOT_DE_PASSE,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Création du compte de test ${n} impossible : ${error?.message}`)
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, OPTIONS)
  comptesCrees.push({ id: data.user.id, client }) // noté avant la connexion : supprimé même si elle échoue
  await connecter(client, email)
  return { id: data.user.id, hash: sha256(data.user.id), client }
}

function voter(client: SupabaseClient, choix: string, identifiantEnvoye = 'identifiant-invente-par-l-appli') {
  return client.rpc('deposer_bulletin', {
    p_proposal_id: TEST_NUMBER,
    p_user_hash:   identifiantEnvoye,
    p_choice:      choix,
    p_proof_hash:  `test-proof-${RUN_ID}-${randomBytes(4).toString('hex')}`,
  })
}

async function compteurs() {
  const { data, error } = await admin
    .from('parliamentary_laws')
    .select('votes_pour, votes_contre, votes_blanc')
    .eq('number', TEST_NUMBER)
    .single()
  if (error || !data) throw new Error(`Lecture des compteurs impossible : ${error?.message}`)
  return data
}

async function votantsInscrits(): Promise<string[]> {
  const { data, error } = await admin
    .from('registre_scrutin')
    .select('user_hash')
    .eq('proposal_id', TEST_NUMBER)
  if (error) throw new Error(`Lecture du registre impossible : ${error.message}`)
  return (data ?? []).map(r => r.user_hash as string).sort()
}

async function bulletinsDansUrne(): Promise<number> {
  const { count, error } = await admin
    .from('urne_electronique')
    .select('id', { count: 'exact', head: true })
    .eq('proposal_id', TEST_NUMBER)
  if (error) throw new Error(`Lecture de l'urne impossible : ${error.message}`)
  return count ?? 0
}

// ── Préparation & nettoyage ────────────────────────────────────
let alice: Citoyen
let bob: Citoyen

beforeAll(async () => {
  const { error } = await admin.from('parliamentary_laws').insert({
    number:               TEST_NUMBER,
    title:                '🧪 Loi de test automatique — ne pas modifier',
    description:          'Créée par tests/vote.integration.test.ts',
    category:             'Test',
    stage:                'upcoming',
    parliament_vote_date: null,
    official_url:         'https://example.com',
    votes_pour:           0,
    votes_contre:         0,
    votes_blanc:          0,
  })
  if (error) throw new Error(`❌ Création de la loi de test impossible : ${error.message}`)
  alice = await creerCitoyen(1)
  bob = await creerCitoyen(2)
}, 60_000)

afterAll(async () => {
  // Suppression dans l'ordre des dépendances (le registre n'a pas de lien automatique avec les comptes)
  await admin.from('urne_electronique').delete().eq('proposal_id', TEST_NUMBER)
  await admin.from('registre_scrutin').delete().eq('proposal_id', TEST_NUMBER)
  await admin.from('parliamentary_laws').delete().eq('number', TEST_NUMBER)
  for (const compte of comptesCrees) {
    await compte.client.auth.signOut().catch(() => undefined)
    const { error } = await admin.auth.admin.deleteUser(compte.id) // supprime aussi le profil
    if (error) console.error(`⚠️ Compte de test ${compte.id} non supprimé : ${error.message}`)
  }
}, 60_000)

// ── Tests ──────────────────────────────────────────────────────
describe('Vote sur une loi — règles de base', () => {

  it('1. Un visiteur non connecté ne peut pas voter', async () => {
    const { data, error } = await voter(visiteur, 'YES')
    const refuse = error !== null || (data as { success?: boolean } | null)?.success === false
    expect(refuse).toBe(true)

    expect(await compteurs()).toEqual({ votes_pour: 0, votes_contre: 0, votes_blanc: 0 })
    expect(await votantsInscrits()).toEqual([])
    expect(await bulletinsDansUrne()).toBe(0)
  })

  it("2. Un citoyen connecté vote : le vote compte et son identifiant est calculé par la base", async () => {
    const { data, error } = await voter(alice.client, 'YES', 'identifiant-pirate')

    expect(error, `Erreur : ${error?.message}`).toBeNull()
    expect(data).toMatchObject({ success: true, already_voted: false, is_law: true })

    expect(await compteurs()).toEqual({ votes_pour: 1, votes_contre: 0, votes_blanc: 0 })
    // L'identifiant inscrit est celui du compte d'Alice, pas celui envoyé par l'appli
    expect(await votantsInscrits()).toEqual([alice.hash])
    expect(await bulletinsDansUrne()).toBe(1)
  })

  it('3. Vote définitif : le même citoyen ne peut pas revoter', async () => {
    const { data, error } = await voter(alice.client, 'NO')

    expect(error).toBeNull()
    expect(data).toMatchObject({ success: false, already_voted: true })

    expect(await compteurs()).toEqual({ votes_pour: 1, votes_contre: 0, votes_blanc: 0 })
    expect(await votantsInscrits()).toEqual([alice.hash])
    expect(await bulletinsDansUrne()).toBe(1)
  })

  it("4. Impossible de voter à la place d'un autre (Bob envoie l'identifiant d'Alice)", async () => {
    const { data, error } = await voter(bob.client, 'NO', alice.hash)

    // Le vote est enregistré comme celui de Bob, celui d'Alice ne change pas
    expect(error).toBeNull()
    expect(data).toMatchObject({ success: true, already_voted: false })
    expect(await compteurs()).toEqual({ votes_pour: 1, votes_contre: 1, votes_blanc: 0 })
    expect(await votantsInscrits()).toEqual([alice.hash, bob.hash].sort())

    // Et Bob ne peut pas voter une seconde fois
    const second = await voter(bob.client, 'YES')
    expect(second.data).toMatchObject({ success: false, already_voted: true })
    expect(await compteurs()).toEqual({ votes_pour: 1, votes_contre: 1, votes_blanc: 0 })
  })

  it('5. Un choix invalide est refusé', async () => {
    const { data } = await voter(alice.client, 'PEUT-ETRE')
    expect(data).toMatchObject({ success: false, error: 'invalid_choice' })
    expect(await compteurs()).toEqual({ votes_pour: 1, votes_contre: 1, votes_blanc: 0 })
  })

  it('6. « Mes votes » renvoie les votes du compte connecté, rien pour un visiteur', async () => {
    const { data, error } = await alice.client.rpc('get_my_votes', { p_user_hash: 'n-importe-quoi' })
    expect(error).toBeNull()
    const ids = ((data ?? []) as { proposal_id: string }[]).map(v => v.proposal_id)
    expect(ids).toContain(TEST_NUMBER)

    const anonyme = await visiteur.rpc('get_my_votes', { p_user_hash: alice.hash })
    const rien = anonyme.error !== null || ((anonyme.data ?? []) as unknown[]).length === 0
    expect(rien).toBe(true)
  })
})

describe('Garde-fous : personne ne contourne le vote', () => {

  it('7. Un citoyen ne peut pas modifier les compteurs directement', async () => {
    const { data, error } = await alice.client
      .from('parliamentary_laws')
      .update({ votes_pour: 999 })
      .eq('number', TEST_NUMBER)
      .select('id')
    const bloque = error !== null || (data ?? []).length === 0
    expect(bloque).toBe(true)
    expect(await compteurs()).toEqual({ votes_pour: 1, votes_contre: 1, votes_blanc: 0 })
  })

  it("8. Personne ne peut écrire directement dans le registre ou l'urne", async () => {
    for (const client of [alice.client, visiteur]) {
      const registre = await client
        .from('registre_scrutin')
        .insert({ proposal_id: TEST_NUMBER, user_hash: `faux-${RUN_ID}`, last_choice: 'YES' })
      expect(registre.error).not.toBeNull()

      const urne = await client
        .from('urne_electronique')
        .insert({ proposal_id: TEST_NUMBER, vote_choice: 'YES', proof_hash: `faux-${RUN_ID}` })
      expect(urne.error).not.toBeNull()
    }
    expect(await votantsInscrits()).toEqual([alice.hash, bob.hash].sort())
    expect(await bulletinsDansUrne()).toBe(2)
  })
})
