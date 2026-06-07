/**
 * TEST D'INTÉGRATION CRITIQUE — Vote sur une loi parlementaire
 *
 * Ce test vérifie la chaîne de bout en bout :
 *   frontend → deposer_bulletin (RPC) → parliamentary_laws.votes_pour/contre/blanc
 *
 * Il tourne contre la vraie base Supabase (pas de mocks).
 * Les données de test sont supprimées après chaque run (afterAll).
 *
 * Variables d'environnement requises (voir tests/.env.test.example) :
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { config } from 'dotenv'

config({ path: '.env.test' })

// ── Clients Supabase ───────────────────────────────────────────
const SUPABASE_URL          = process.env.SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY     = process.env.SUPABASE_ANON_KEY ?? ''
const SUPABASE_SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    '❌ Variables manquantes. Copie tests/.env.test.example → .env.test et remplis les valeurs.'
  )
}

// Admin : setup / teardown / assertions directes en base
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Anon : simule exactement un vrai utilisateur (même clé que le frontend)
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

// ── Identifiants uniques pour ce run de test ───────────────────
const RUN_ID         = Date.now()
const TEST_NUMBER    = `TEST-VOTE-${RUN_ID}`   // number de la loi de test
const USER_1_HASH    = `test-user-1-${RUN_ID}`
const USER_2_HASH    = `test-user-2-${RUN_ID}`

// ── Helpers ────────────────────────────────────────────────────
async function getLawCounts() {
  const { data } = await supabaseAdmin
    .from('parliamentary_laws')
    .select('votes_pour, votes_contre, votes_blanc')
    .eq('number', TEST_NUMBER)
    .single()
  return data ?? { votes_pour: -1, votes_contre: -1, votes_blanc: -1 }
}

async function deposer(userHash: string, choice: 'YES' | 'NO' | 'ABSTAIN', proofSuffix: string) {
  return supabaseAnon.rpc('deposer_bulletin', {
    p_proposal_id: TEST_NUMBER,
    p_user_hash:   userHash,
    p_choice:      choice,
    p_proof_hash:  `test-proof-${proofSuffix}-${RUN_ID}`,
  })
}

// ── Setup & Teardown ───────────────────────────────────────────
beforeAll(async () => {
  const { error } = await supabaseAdmin.from('parliamentary_laws').insert({
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
  if (error) throw new Error(`❌ Setup beforeAll échoué : ${error.message}`)
})

afterAll(async () => {
  // Suppression dans l'ordre des dépendances
  await supabaseAdmin.from('urne_electronique').delete().eq('proposal_id', TEST_NUMBER)
  await supabaseAdmin.from('registre_scrutin').delete().eq('proposal_id', TEST_NUMBER)
  await supabaseAdmin.from('parliamentary_laws').delete().eq('number', TEST_NUMBER)
})

// ── Tests ──────────────────────────────────────────────────────
describe('deposer_bulletin — loi parlementaire', () => {

  it('1. Vote YES → votes_pour passe de 0 à 1, urne_electronique reçoit le bulletin', async () => {
    const { data, error } = await deposer(USER_1_HASH, 'YES', 'a')

    expect(error, `RPC error: ${error?.message}`).toBeNull()
    expect(data).toMatchObject({ success: true, is_law: true, updated: false })

    const counts = await getLawCounts()
    expect(counts.votes_pour).toBe(1)
    expect(counts.votes_contre).toBe(0)
    expect(counts.votes_blanc).toBe(0)

    const { data: bulletins } = await supabaseAdmin
      .from('urne_electronique')
      .select('vote_choice')
      .eq('proposal_id', TEST_NUMBER)
      .eq('vote_choice', 'YES')
    expect(bulletins?.length).toBeGreaterThanOrEqual(1)
  })

  it('2. Même utilisateur revote NO → le YES est annulé, votes_contre = 1 (pas de doublon)', async () => {
    const { data, error } = await deposer(USER_1_HASH, 'NO', 'b')

    expect(error).toBeNull()
    expect(data).toMatchObject({ success: true, is_law: true, updated: true })

    const counts = await getLawCounts()
    expect(counts.votes_pour).toBe(0)    // annulé
    expect(counts.votes_contre).toBe(1)  // nouveau choix
    expect(counts.votes_blanc).toBe(0)
  })

  it('3. Un 2e utilisateur vote YES → cumul correct (Pour=1, Contre=1)', async () => {
    const { error } = await deposer(USER_2_HASH, 'YES', 'c')

    expect(error).toBeNull()

    const counts = await getLawCounts()
    expect(counts.votes_pour).toBe(1)   // user 2
    expect(counts.votes_contre).toBe(1) // user 1
    expect(counts.votes_blanc).toBe(0)
  })

  it('4. deposer_bulletin détecte bien is_law=true (join sur number, pas uuid)', async () => {
    // Voter avec un 3e utilisateur et vérifier le flag is_law
    const USER_3_HASH = `test-user-3-${RUN_ID}`
    const { data, error } = await deposer(USER_3_HASH, 'ABSTAIN', 'd')

    expect(error).toBeNull()
    expect(data).toMatchObject({ success: true, is_law: true })

    // votes_blanc doit être 1
    const counts = await getLawCounts()
    expect(counts.votes_blanc).toBe(1)

    // Cleanup user 3 pour ne pas fausser les tests suivants
    await supabaseAdmin.from('registre_scrutin').delete()
      .eq('proposal_id', TEST_NUMBER).eq('user_hash', USER_3_HASH)
    await supabaseAdmin.from('parliamentary_laws').update({ votes_blanc: 0 })
      .eq('number', TEST_NUMBER)
  })

})

describe('Garde-fous RLS et politiques de base', () => {

  it('5. La politique RLS UPDATE existe sur parliamentary_laws', async () => {
    const { data, error } = await supabaseAdmin.rpc('check_vote_rls')
    expect(error, `check_vote_rls error: ${error?.message}`).toBeNull()

    const result = data as {
      parliamentary_laws_has_update_policy: boolean
      deposer_bulletin_has_row_security_off: boolean
    }

    expect(result.parliamentary_laws_has_update_policy).toBe(true)
  })

  it('6. deposer_bulletin a bien SET row_security = off (sans quoi les UPDATE sont bloqués)', async () => {
    const { data } = await supabaseAdmin.rpc('check_vote_rls')

    const result = data as { deposer_bulletin_has_row_security_off: boolean }
    expect(result.deposer_bulletin_has_row_security_off).toBe(true)
  })

})
