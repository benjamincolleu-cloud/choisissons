import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const SUCCESS_URL = 'https://choisissons.fr/mon-compte?success=true'
const CANCEL_URL  = 'https://choisissons.fr/soutenir'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

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

  const { plan, productId } = await req.json() as { plan: string; productId: string }
  if (!plan || !productId) {
    return new Response(
      JSON.stringify({ error: 'plan et productId sont requis' }),
      { status: 400 },
    )
  }

  // Résoudre dynamiquement le price_id depuis le product_id Stripe
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 1 })
  const priceId = prices.data[0]?.id
  if (!priceId) {
    return new Response(
      JSON.stringify({ error: `Aucun prix actif trouvé pour le produit : ${productId}` }),
      { status: 400 },
    )
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
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  // subscription_data.metadata est transmis à l'objet Subscription Stripe →
  // le webhook customer.subscription.created peut lire supabase_user_id et plan
  const session = await stripe.checkout.sessions.create({
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

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
