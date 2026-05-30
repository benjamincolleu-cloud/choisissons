import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AN_API_URL =
  'https://data.assemblee-nationale.fr/api/v2/documents?type=PRJL,PION&legislature=17&limit=50'

interface LawRow {
  number:               string
  title:                string
  description:          string
  category:             string
  stage:                string
  parliament_vote_date: string | null
  official_url:         string
  synced_at:            string
}

// ── Mapping catégories ──────────────────────────────────────────
const CATEGORY_RULES: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['santé', 'maladie', 'hôpital', 'médecin', 'soins', 'pharmacie', 'dépendance'], category: 'Santé' },
  { keywords: ['écologi', 'environnement', 'climat', 'biodiversité', 'énergie', 'renouvelable', 'carbone', 'pollution', 'eau', 'forêt'], category: 'Écologie' },
  { keywords: ['justice', 'judiciaire', 'tribunal', 'pénal', 'crime', 'délit', 'prison', 'avocat', 'droit civil'], category: 'Justice' },
  { keywords: ['économi', 'financ', 'budget', 'fiscal', 'impôt', 'taxe', 'emploi', 'travail', 'industrie', 'commerce', 'entreprise'], category: 'Économie' },
  { keywords: ['éducation', 'école', 'lycée', 'université', 'enseignement', 'formation', 'jeunesse', 'apprentissage'], category: 'Éducation' },
  { keywords: ['état', 'administration', 'fonction publique', 'service public', 'collectivité', 'décentralisation'], category: 'État' },
]

function mapCategory(sources: string[]): string {
  const haystack = sources.join(' ').toLowerCase()
  for (const { keywords, category } of CATEGORY_RULES) {
    if (keywords.some(k => haystack.includes(k))) return category
  }
  return 'Institutions'
}

// ── Extraction robuste du tableau de documents ──────────────────
function extractItems(raw: unknown): unknown[] {
  if (!raw || typeof raw !== 'object') return []
  const r = raw as Record<string, unknown>
  // Format v2 standard
  if (Array.isArray(r.items))     return r.items
  if (Array.isArray(r.documents)) return r.documents
  if (Array.isArray(r.data))      return r.data
  if (Array.isArray(raw))         return raw
  // Format export XML converti en JSON
  const exp = r.export as Record<string, unknown> | undefined
  if (exp) {
    const dl = exp.dossiersLegislatifs as Record<string, unknown> | undefined
    if (dl && Array.isArray(dl.dossierLegislatif)) return dl.dossierLegislatif
  }
  return []
}

// ── Mapper un document brut → LawRow ───────────────────────────
function mapDocument(d: unknown, index: number): LawRow | null {
  if (!d || typeof d !== 'object') return null
  const r = d as Record<string, unknown>

  const uid   = (r.uid ?? r.id ?? r.numero ?? `doc-${index}`) as string
  const title = (r.titre ?? r.titreCourt ?? r.title ?? '') as string
  if (!title) return null

  // Thèmes : tableau d'objets { libelle } ou tableau de chaînes
  const rawThemes = (r.themes ?? r.theme ?? r.matieres ?? []) as unknown[]
  const themes: string[] = Array.isArray(rawThemes)
    ? rawThemes
        .map(t => (typeof t === 'string' ? t : ((t as Record<string, unknown>).libelle as string) ?? ''))
        .filter(Boolean)
    : []

  // Description
  const description =
    ((r.description ?? r.expose ?? r.exposeDesMotifs ?? r.objet ?? '') as string).trim() || title

  // Date de vote
  const voteDate =
    (r.dateVoteSeance ?? r.dateAdoption ?? r.dateVote ?? null) as string | null

  // URL officielle
  const officialUrl =
    (r.urlAn ?? r.url ?? r.cheminUrl ??
      `https://www.assemblee-nationale.fr/dyn/17/dossiers/${uid}`) as string

  let calculatedStage = 'voting'
  if (voteDate) {
    const vd = new Date(voteDate)
    if (!isNaN(vd.getTime())) {
      const diffDays = (Date.now() - vd.getTime()) / (1000 * 3600 * 24)
      if (diffDays > 37) calculatedStage = 'archived'
      else if (diffDays > 7) calculatedStage = 'closed'
    }
  }

  return {
    number:               uid,
    title,
    description,
    category:             mapCategory([...themes, title]),
    stage:                calculatedStage,
    parliament_vote_date: voteDate || null,
    official_url:         officialUrl,
    synced_at:            new Date().toISOString(),
  }
}

// ── Handler principal ───────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  let synced = 0
  let errors = 0

  // 1. Appel API AN
  let raw: unknown = null
  try {
    const res = await fetch(AN_API_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    raw = await res.json()
    console.log('[sync-parliamentary-laws] API réponse (extrait):', JSON.stringify(raw).slice(0, 400))
  } catch (e) {
    console.error('[sync-parliamentary-laws] Erreur appel API:', e)
    errors++
  }

  // 2. Mapper les documents
  const items = extractItems(raw)
  console.log(`[sync-parliamentary-laws] ${items.length} documents extraits`)

  const laws: LawRow[] = items
    .map((d, i) => {
      try {
        return mapDocument(d, i)
      } catch (e) {
        console.error(`[sync-parliamentary-laws] Erreur mapping item ${i}:`, e)
        errors++
        return null
      }
    })
    .filter((l): l is LawRow => l !== null)

  // 3. UPSERT par lot
  if (laws.length > 0) {
    const BATCH = 20
    for (let i = 0; i < laws.length; i += BATCH) {
      const batch = laws.slice(i, i + BATCH)
      try {
        const { error } = await supabase
          .from('parliamentary_laws')
          .upsert(batch, { onConflict: 'number' })
        if (error) {
          console.error(`[sync-parliamentary-laws] Upsert lot ${i}:`, error.message)
          errors += batch.length
        } else {
          synced += batch.length
        }
      } catch (e) {
        console.error(`[sync-parliamentary-laws] Exception lot ${i}:`, e)
        errors += batch.length
      }
    }
  }

  // 4. Update stages for older laws still in DB
  try {
    const { error: rpcError } = await supabase.rpc('update_parliamentary_law_stages')
    if (rpcError) {
      console.error('[sync-parliamentary-laws] RPC update stages error:', rpcError.message)
    }
  } catch (e) {
    console.error('[sync-parliamentary-laws] RPC Exception:', e)
  }

  // 5. Fetch scrutins for closed laws missing official results
  try {
    const { data: closedLaws } = await supabase
      .from('parliamentary_laws')
      .select('id, number, votes')
      .in('stage', ['closed', 'archived'])

    const lawsToUpdate = (closedLaws || []).filter(l => 
      l.votes && l.votes.pour === 0 && l.votes.contre === 0 && l.votes.blanc === 0
    )

    if (lawsToUpdate.length > 0) {
      console.log(`[sync-parliamentary-laws] ${lawsToUpdate.length} lois nécessitent la récupération des scrutins.`)
      const scrutinsRes = await fetch('https://data.assemblee-nationale.fr/api/v2/scrutins?legislature=17&limit=200', {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000)
      })
      
      if (scrutinsRes.ok) {
        const scrutinsRaw = await scrutinsRes.json()
        const scrutins = extractItems(scrutinsRaw)

        for (const law of lawsToUpdate) {
          const numMatch = String(law.number).match(/(\d+)$/)
          const shortNum = numMatch ? parseInt(numMatch[1], 10).toString() : null

          const scrutin = scrutins.find(s => {
            const r = s as Record<string, any>
            const text = `${r.titre} ${r.objet} ${r.uid}`.toLowerCase()
            return shortNum && text.includes(shortNum)
          })

          if (scrutin) {
            const r = scrutin as Record<string, any>
            const pour = r.syntheseVote?.nombrePour ?? r.decompte?.pour ?? 0
            const contre = r.syntheseVote?.nombreContre ?? r.decompte?.contre ?? 0
            const blanc = r.syntheseVote?.nombreAbstentions ?? r.decompte?.abstentions ?? 0

            if (pour > 0 || contre > 0 || blanc > 0) {
              await supabase.from('parliamentary_laws').update({ votes: { pour, contre, blanc } }).eq('id', law.id)
              console.log(`[sync-parliamentary-laws] Scrutin AN mis à jour pour ${law.number} : ${pour} Pour, ${contre} Contre`)
              synced++
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('[sync-parliamentary-laws] Erreur récupération scrutins:', e)
    errors++
  }

  const result = { synced, errors, timestamp: new Date().toISOString() }
  console.log('[sync-parliamentary-laws] Résultat:', result)

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
})
