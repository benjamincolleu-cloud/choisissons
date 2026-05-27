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

const STATUS_MAP: Record<string, string> = {
  active:             'active',
  trialing:           'trialing',
  past_due:           'past_due',
  canceled:           'canceled',
  incomplete:         'inactive',
  incomplete_expired: 'inactive',
  unpaid:             'past_due',
  paused:             'inactive',
}

async function activateSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.supabase_user_id
  const plan   = sub.metadata?.plan ?? 'citoyen'
  if (!userId) {
    console.warn('[stripe-webhook] subscription sans supabase_user_id:', sub.id)
    return
  }
  const status = STATUS_MAP[sub.status] ?? 'inactive'
  await supabase.from('profiles').update({
    subscription_status:    status,
    subscription_plan:      status === 'active' ? plan : 'gratuit',
    stripe_subscription_id: sub.id,
  }).eq('id', userId)
}

async function updateSubscriptionStatus(sub: Stripe.Subscription) {
  const customerId = sub.customer as string
  const status     = STATUS_MAP[sub.status] ?? 'inactive'
  const plan       = sub.metadata?.plan

  const updates: Record<string, unknown> = {
    subscription_status:    status,
    stripe_subscription_id: sub.id,
  }
  if (plan && status === 'active') {
    updates.subscription_plan = plan
  } else if (['canceled', 'inactive'].includes(status)) {
    updates.subscription_plan = 'gratuit'
  }

  await supabase.from('profiles').update(updates).eq('stripe_customer_id', customerId)
}

async function cancelSubscription(sub: Stripe.Subscription) {
  const customerId = sub.customer as string
  await supabase.from('profiles').update({
    subscription_status:    'canceled',
    subscription_plan:      'gratuit',
    stripe_subscription_id: null,
  }).eq('stripe_customer_id', customerId)
}

Deno.serve(async (req) => {
  const sig  = req.headers.get('stripe-signature') ?? ''
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, sig, Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
    )
  } catch (err) {
    console.error('[stripe-webhook] Signature invalide:', err)
    return new Response(`Webhook Error: ${err}`, { status: 400 })
  }

  console.log('[stripe-webhook] event:', event.type)

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await activateSubscription(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.updated':
        await updateSubscriptionStatus(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await cancelSubscription(event.data.object as Stripe.Subscription)
        break
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId  = session.metadata?.supabase_user_id
        const plan    = session.metadata?.plan ?? 'citoyen'
        if (userId && session.mode === 'subscription') {
          await supabase.from('profiles').update({
            subscription_status: 'active',
            subscription_plan:   plan,
          }).eq('id', userId)
        }
        break
      }
    }
  } catch (err) {
    // Retourner 200 pour éviter que Stripe ne rejoue indéfiniment
    console.error('[stripe-webhook] Erreur traitement:', event.type, err)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
