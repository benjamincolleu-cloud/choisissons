import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
if (!stripeKey) console.error('[checkout] STRIPE_SECRET_KEY manquante')

const stripe = new Stripe(stripeKey, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const SUCCESS_URL = 'https://choisissons.fr/mon-compte?success=true'
const CANCEL_URL  = 'https://choisissons.fr/soutenir'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Toujours retourner 200 — l'erreur est dans le champ "error" du JSON.
// Cela évite que supabase-js encapsule la réponse dans FunctionsHttpError
// et cache le message réel côté frontend.
function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authError || !user) {
      console.error('[checkout] Auth error:', authError?.message)
      return ok({ error: `Auth: ${authError?.message ?? 'utilisateur non trouvé'}` })
    }
    console.log('[checkout] user:', user.id)

    const body = await req.json() as { plan?: string; productId?: string }
    const { plan, productId } = body
    console.log('[checkout] plan:', plan, '| productId:', productId)

    if (!plan || !productId) {
      return ok({ error: 'plan et productId sont requis' })
    }

    // Résoudre le price_id depuis le product_id Stripe
    console.log('[checkout] stripe.prices.list for product:', productId)
    let prices: Awaited<ReturnType<typeof stripe.prices.list>>
    try {
      prices = await stripe.prices.list({ product: productId, active: true, limit: 1 })
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr)
      console.error('[checkout] Stripe prices.list error:', msg)
      return ok({ error: `Stripe prices.list: ${msg}` })
    }
    console.log('[checkout] prices.data.length:', prices.data.length, '| first id:', prices.data[0]?.id)

    const priceId = prices.data[0]?.id
    if (!priceId) {
      console.error('[checkout] Aucun prix actif pour:', productId)
      return ok({ error: `Aucun prix actif pour le produit ${productId}` })
    }

    // Récupérer ou créer le Stripe customer
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()
    if (profileError) console.warn('[checkout] profile fetch warning:', profileError.message)

    let customerId = profile?.stripe_customer_id as string | undefined
    if (!customerId) {
      console.log('[checkout] Creating Stripe customer for:', user.email)
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }
    console.log('[checkout] customerId:', customerId)

    let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>
    try {
      session = await stripe.checkout.sessions.create({
        customer:   customerId,
        mode:       'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          metadata: { supabase_user_id: user.id, plan },
        },
        success_url: SUCCESS_URL,
        cancel_url:  CANCEL_URL,
        metadata: { supabase_user_id: user.id, plan },
      })
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr)
      console.error('[checkout] Stripe sessions.create error:', msg)
      return ok({ error: `Stripe sessions.create: ${msg}` })
    }
    console.log('[checkout] session:', session.id)

    return ok({ url: session.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[checkout] ERREUR FATALE:', msg)
    return ok({ error: `Erreur interne: ${msg}` })
  }
})
