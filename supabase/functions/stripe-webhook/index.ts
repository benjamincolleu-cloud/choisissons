import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

Deno.serve(async (req) => {
  const sig  = req.headers.get('stripe-signature') ?? ''
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, sig, Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
    )
  } catch (err) {
    console.error('Signature invalide:', err)
    return new Response(`Webhook Error: ${err}`, { status: 400 })
  }

  console.log('[stripe-webhook] event:', event.type)

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId  = session.metadata?.supabase_user_id
      const plan    = session.metadata?.plan ?? 'citoyen'
      if (userId) {
        await supabase.from('profiles').update({
          subscription_status: 'active',
          subscription_plan:   plan,
        }).eq('id', userId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub        = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      // Mapper les statuts Stripe vers les valeurs autorisées en base
      const statusMap: Record<string, string> = {
        active:   'active',
        past_due: 'past_due',
        trialing: 'trialing',
        canceled: 'canceled',
      }
      const status = statusMap[sub.status] ?? 'inactive'
      await supabase.from('profiles')
        .update({ subscription_status: status })
        .eq('stripe_customer_id', customerId)
      break
    }

    case 'customer.subscription.deleted': {
      const sub        = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      await supabase.from('profiles').update({
        subscription_status: 'canceled',
        subscription_plan:   'gratuit',
      }).eq('stripe_customer_id', customerId)
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
