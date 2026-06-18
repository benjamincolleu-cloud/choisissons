import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BANNED_PATTERNS = [
  /https?:\/\//i,
  /\bkill\b|\bmort\b|\bassassin/i,
]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { target_id, target_type, side, content, author_hash } = await req.json() as {
      target_id: string
      target_type: string
      side: 'pour' | 'contre'
      content: string
      author_hash: string
    }

    // ── Validation basique ────────────────────────────────────
    if (!target_id || !side || !content || !author_hash) {
      return new Response(
        JSON.stringify({ status: 'rejected', reason: 'Données manquantes.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const trimmed = content.trim()
    if (trimmed.length < 50) {
      return new Response(
        JSON.stringify({ status: 'rejected', reason: 'Argument trop court (minimum 50 caractères).' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }
    if (trimmed.length > 500) {
      return new Response(
        JSON.stringify({ status: 'rejected', reason: 'Argument trop long (maximum 500 caractères).' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    for (const pattern of BANNED_PATTERNS) {
      if (pattern.test(trimmed)) {
        return new Response(
          JSON.stringify({ status: 'rejected', reason: 'Contenu non conforme à la charte (URL ou langage inapproprié).' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        )
      }
    }

    // ── Client Supabase avec droits service ──────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, serviceKey)

    // ── Vérifier doublon (même auteur, même camp, même cible) ─
    const { data: existing } = await supabase
      .from('arguments')
      .select('id')
      .eq('target_id', target_id)
      .eq('target_type', target_type ?? 'proposal')
      .eq('side', side)
      .eq('author_hash', author_hash)
      .limit(1)

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ status: 'rejected', reason: 'Vous avez déjà publié un argument de ce côté.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    // ── Décision de modération ───────────────────────────────
    // Mots-clés qui déclenchent une relecture par le jury
    const PENDING_PATTERNS = [/\bpolitiqu/i, /\bpartis?\b/i, /\bélection/i, /\bgouvernement/i]
    const needsReview = PENDING_PATTERNS.some(p => p.test(trimmed))

    const moderation_status = needsReview ? 'pending' : 'published'

    const { error } = await supabase.from('arguments').insert({
      target_id,
      target_type: target_type ?? 'proposal',
      side,
      content: trimmed,
      author_hash,
      moderation_status,
      flags_count: 0,
    })

    if (error) throw error

    if (moderation_status === 'pending') {
      return new Response(
        JSON.stringify({
          status: 'pending',
          message: 'Votre argument a été reçu et sera examiné par le jury citoyen avant publication.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    return new Response(
      JSON.stringify({ status: 'published', message: 'Votre argument est publié dans l\'Agora.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', reason: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})
