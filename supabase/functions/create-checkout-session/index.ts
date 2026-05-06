import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const PRICE_MAP: Record<string, string> = {
  citoyen:         Deno.env.get('STRIPE_PRICE_CITOYEN')    ?? '',
  commune_petite:  Deno.env.get('STRIPE_PRICE_COMMUNE_S')  ?? '',
  commune_moyenne: Deno.env.get('STRIPE_PRICE_COMMUNE_M')  ?? '',
  commune_grande:  Deno.env.get('STRIPE_PRICE_COMMUNE_L')  ?? '',
}

const SUCCESS_URL = 'http://localhost:5173/merci'
const CANCEL_URL  = 'http://localhost:5173/'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401 })
  }

  const { plan } = await req.json() as { plan: string }
  const priceId = PRICE_MAP[plan]
  if (!priceId) {
    return new Response(JSON.stringify({ error: `Plan inconnu ou non configuré: ${plan}` }), { status: 400 })
  }

  // Récupérer ou créer le Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id as string | undefined
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer:    customerId,
    mode:        'subscription',
    line_items:  [{ price: priceId, quantity: 1 }],
    success_url: SUCCESS_URL,
    cancel_url:  CANCEL_URL,
    metadata:    { supabase_user_id: user.id, plan },
  })

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
