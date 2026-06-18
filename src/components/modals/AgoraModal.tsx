import { useState, useEffect } from 'react'
import { X, Users, ThumbsUp, ThumbsDown, Vote, MessageSquarePlus } from 'lucide-react'
import { supabase, supabaseUrl, supabaseAnonKey } from '../../supabaseClient'
import type { Proposal } from '../../types'

interface DbArg {
  id: number
  side: 'pour' | 'contre'
  content: string
  author_hash: string
  created_at: string
  flags_count: number
}

type SubmitStatus = 'published' | 'pending' | 'rejected' | null

export default function AgoraModal({ proposal, onVote, onClose, hasVoted, userHash, targetType, onNavigateSupport, originalText }: {
  proposal: Proposal
  onVote: () => void
  onClose: () => void
  hasVoted?: boolean
  userHash?: string
  targetType?: 'law' | 'proposal'
  onNavigateSupport?: () => void
  originalText?: string
}) {
  const [dbArgs, setDbArgs] = useState<DbArg[]>([])
  const [loadingArgs, setLoadingArgs] = useState(true)
  const [isSubscribed, setIsSubscribed] = useState(false)

  // Formulaire
  const [showForm, setShowForm] = useState(false)
  const [argSide, setArgSide] = useState<'pour' | 'contre' | null>(null)
  const [argText, setArgText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>(null)
  const [submitMessage, setSubmitMessage] = useState('')

  // Côtés déjà publiés par cet utilisateur
  const [publishedSides, setPublishedSides] = useState<Set<'pour' | 'contre'>>(new Set())

  const [flaggedIds, setFlaggedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data } = await supabase
          .from('arguments')
          .select('id, side, content, author_hash, created_at, flags_count')
          .eq('target_id', proposal.id)
          .eq('target_type', targetType ?? 'proposal')
          .eq('moderation_status', 'published')
          .order('created_at', { ascending: false })
        if (!cancelled) setDbArgs((data ?? []) as DbArg[])
      } finally {
        if (!cancelled) setLoadingArgs(false)
      }
    }
    load()

    // Abonnement + côtés déjà publiés
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return

      const [profileRes, myArgsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('subscription_status, subscription_plan')
          .eq('id', user.id)
          .single(),
        supabase
          .from('arguments')
          .select('side')
          .eq('target_id', proposal.id)
          .eq('target_type', targetType ?? 'proposal')
          .eq('author_hash', userHash ?? ''),
      ])

      if (!cancelled) {
        if (profileRes.data) {
          setIsSubscribed(
            profileRes.data.subscription_status === 'active' &&
            String(profileRes.data.subscription_plan ?? '').includes('citoyen')
          )
        }
        if (myArgsRes.data) {
          setPublishedSides(new Set(myArgsRes.data.map(r => r.side as 'pour' | 'contre')))
        }
      }
    })

    return () => { cancelled = true }
  }, [proposal.id, targetType, userHash])

  async function refreshArgs() {
    const { data } = await supabase
      .from('arguments')
      .select('id, side, content, author_hash, created_at, flags_count')
      .eq('target_id', proposal.id)
      .eq('target_type', targetType ?? 'proposal')
      .eq('moderation_status', 'published')
      .order('created_at', { ascending: false })
    if (data) setDbArgs(data as DbArg[])
  }

  async function handleSubmit() {
    if (!argSide || argText.trim().length < 50 || !userHash) return
    setSubmitting(true)
    setSubmitStatus(null)
    setSubmitMessage('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      const res = await fetch(`${supabaseUrl}/functions/v1/moderate-argument`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          target_id: proposal.id,
          target_type: targetType ?? 'proposal',
          side: argSide,
          content: argText.trim(),
          author_hash: userHash,
        }),
      })

      const json = await res.json() as { status?: string; message?: string; reason?: string }
      const status = json.status as SubmitStatus

      setSubmitStatus(status)
      setSubmitMessage(json.message ?? json.reason ?? '')

      if (status === 'published') {
        setPublishedSides(prev => new Set([...prev, argSide]))
        setArgText('')
        setArgSide(null)
        setShowForm(false)
        await refreshArgs()
      } else if (status === 'pending') {
        setPublishedSides(prev => new Set([...prev, argSide]))
        setArgText('')
        setArgSide(null)
        setShowForm(false)
      }
      // 'rejected' : on garde le formulaire ouvert avec le message d'erreur
    } catch {
      setSubmitStatus('rejected')
      setSubmitMessage('Erreur de connexion. Réessayez.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleFlag(argId: number) {
    if (!userHash || flaggedIds.has(argId)) return
    setFlaggedIds(prev => new Set([...prev, argId]))
    try {
      await supabase.from('argument_flags').insert({
        argument_id: argId,
        reporter_hash: userHash,
      })
      const { count } = await supabase
        .from('argument_flags')
        .select('*', { count: 'exact', head: true })
        .eq('argument_id', argId)
      if ((count ?? 0) >= 3) {
        await supabase.from('arguments').update({ moderation_status: 'flagged' }).eq('id', argId)
        setDbArgs(prev => prev.filter(a => a.id !== argId))
      }
    } catch { /* silently fail */ }
  }

  function fmtDate(s: string) {
    try { return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) }
    catch { return '' }
  }

  const pourDbArgs = dbArgs.filter(a => a.side === 'pour')
  const contreDbArgs = dbArgs.filter(a => a.side === 'contre')
  const { pour, contre, blanc } = proposal.votes
  const isEmpty = !loadingArgs && pourDbArgs.length === 0 && contreDbArgs.length === 0

  function ArgCard({ arg, color }: { arg: DbArg; color: 'green' | 'red' }) {
    const bg = color === 'green' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
    const badge = color === 'green' ? 'text-green-600 bg-green-100' : 'text-red-500 bg-red-100'
    return (
      <div className={`border rounded-xl p-3 ${bg}`}>
        <p className="text-sm text-slate-700 leading-relaxed">{arg.content}</p>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${badge}`}>Citoyen soutenant</span>
            <span className="text-[10px] text-slate-400">{fmtDate(arg.created_at)}</span>
          </div>
          <button
            onClick={() => handleFlag(arg.id)}
            disabled={flaggedIds.has(arg.id)}
            className="text-[10px] text-slate-300 hover:text-red-400 disabled:opacity-40 transition-colors"
          >
            Signaler
          </button>
        </div>
      </div>
    )
  }

  // ── Bloc CTA selon l'état de l'abonnement ────────────────────
  function renderCta() {
    if (isSubscribed) {
      return (
        <button
          onClick={() => { setShowForm(true); setSubmitStatus(null); setSubmitMessage('') }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 text-white font-semibold text-sm shadow-md shadow-indigo-100 active:scale-95 transition-all"
        >
          <MessageSquarePlus size={16} />
          ✏️ Donner mon avis
        </button>
      )
    }
    return (
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center">
        <p className="text-base font-bold text-indigo-700 mb-1">💬 Envie de participer au débat ?</p>
        <p className="text-xs text-indigo-500 mb-3 leading-relaxed">
          Les citoyens soutenant peuvent publier des arguments argumentés dans l'Agora (2 €/mois).
        </p>
        {onNavigateSupport && (
          <button
            onClick={() => { onClose(); onNavigateSupport() }}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all"
          >
            Devenir Citoyen soutenant — 2 €/mois
          </button>
        )}
      </div>
    )
  }

  // ── Formulaire de soumission ─────────────────────────────────
  function renderForm() {
    return (
      <div className="bg-white border border-indigo-200 rounded-2xl p-4 shadow-sm">
        {/* Charte */}
        <p className="text-[10px] text-slate-500 mb-3 leading-relaxed bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
          Charte : respect, argumentation factuelle, pas d'attaques personnelles ni de liens URL.
        </p>

        {/* Choix du camp */}
        <p className="text-xs font-semibold text-slate-600 mb-2">Choisissez votre position :</p>
        <div className="flex gap-2 mb-3">
          {(['pour', 'contre'] as const).map(side => {
            const alreadyPublished = publishedSides.has(side)
            const isSelected = argSide === side
            return (
              <button
                key={side}
                onClick={() => !alreadyPublished && setArgSide(isSelected ? null : side)}
                disabled={alreadyPublished}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                  alreadyPublished
                    ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                    : isSelected
                      ? side === 'pour'
                        ? 'bg-green-500 border-green-500 text-white shadow-md shadow-green-100'
                        : 'bg-red-500 border-red-500 text-white shadow-md shadow-red-100'
                      : side === 'pour'
                        ? 'border-green-200 text-green-700 hover:bg-green-50'
                        : 'border-red-200 text-red-600 hover:bg-red-50'
                }`}
              >
                {alreadyPublished
                  ? `✓ Déjà publié ${side === 'pour' ? '(Pour)' : '(Contre)'}`
                  : side === 'pour' ? '👍 Je suis Pour' : '👎 Je suis Contre'
                }
              </button>
            )
          })}
        </div>

        {/* Textarea — apparaît après sélection du camp */}
        {argSide && (
          <>
            <textarea
              value={argText}
              onChange={e => { setArgText(e.target.value); setSubmitStatus(null) }}
              placeholder="Expliquez votre position en 50 à 500 caractères…"
              maxLength={500}
              rows={4}
              autoFocus
              className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <div className="flex items-center justify-between mt-1 mb-3">
              <span className={`text-[10px] ${argText.length < 50 ? 'text-red-400' : 'text-slate-400'}`}>
                {argText.length} / 500 {argText.length < 50 && '(min. 50)'}
              </span>
            </div>

            {/* Feedback après envoi */}
            {submitStatus === 'rejected' && submitMessage && (
              <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <span className="text-sm">❌</span>
                <p className="text-xs text-red-700 leading-relaxed">{submitMessage}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || argText.trim().length < 50}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {submitting
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Publication…</>
                : 'Publier mon argument'
              }
            </button>
          </>
        )}

        <button
          onClick={() => { setShowForm(false); setArgSide(null); setArgText(''); setSubmitStatus(null) }}
          className="w-full mt-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Annuler
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-100 flex-shrink-0">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
          <X size={18} className="text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Agora — Débat citoyen</p>
          <h2 className="font-bold text-slate-800 text-sm leading-tight truncate">{proposal.title}</h2>
        </div>
      </div>

      {/* Résumé / diff */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0">
        {originalText ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">📋 Article en vigueur</p>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-100 rounded-lg p-2">{originalText}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">✏️ Modification proposée</p>
              <p className="text-xs text-amber-800 leading-relaxed bg-amber-50 rounded-lg p-2">{proposal.description}</p>
            </div>
          </div>
        ) : proposal.resume ? (
          <p className="text-sm text-slate-600 leading-relaxed">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1.5" title="Résumé simplifié, non officiel">En clair —</span>
            {proposal.resume}
          </p>
        ) : null}
        {proposal.tags.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {proposal.tags.map(tag => (
              <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Compteurs de votes */}
      <div className="px-4 py-3 border-b border-slate-100 flex-shrink-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Résultats du vote citoyen</p>
        <div className="flex gap-2">
          <div className="flex-1 text-center bg-green-50 rounded-xl py-2">
            <p className="text-lg font-black text-green-600">{pour.toLocaleString('fr-FR')}</p>
            <p className="text-[10px] text-green-500 font-semibold uppercase">Votes Pour</p>
          </div>
          <div className="flex-1 text-center bg-slate-50 rounded-xl py-2">
            <p className="text-lg font-black text-slate-400">{blanc.toLocaleString('fr-FR')}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Votes Blanc</p>
          </div>
          <div className="flex-1 text-center bg-red-50 rounded-xl py-2">
            <p className="text-lg font-black text-red-500">{contre.toLocaleString('fr-FR')}</p>
            <p className="text-[10px] text-red-400 font-semibold uppercase">Votes Contre</p>
          </div>
        </div>
      </div>

      {/* Corps scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {/* Titre section */}
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-indigo-500" />
            <h3 className="font-bold text-slate-700 text-sm">Agora — le débat citoyen</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">Arguments publiés par les citoyens soutenant</p>

          {/* Feedback post-soumission (published ou pending) */}
          {submitStatus === 'published' && (
            <div className="mb-4 flex items-start gap-2 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
              <span className="text-base">✅</span>
              <div>
                <p className="text-sm font-bold text-green-700">Argument publié</p>
                <p className="text-xs text-green-600 leading-relaxed">{submitMessage}</p>
              </div>
            </div>
          )}
          {submitStatus === 'pending' && (
            <div className="mb-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
              <span className="text-base">⏳</span>
              <div>
                <p className="text-sm font-bold text-blue-700">En attente du jury</p>
                <p className="text-xs text-blue-600 leading-relaxed">{submitMessage}</p>
              </div>
            </div>
          )}

          {/* Chargement */}
          {loadingArgs ? (
            <div className="space-y-2 mb-4">
              {[1, 2].map(i => <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />)}
            </div>
          ) : isEmpty ? (
            /* État vide */
            <div className="text-center py-6 mb-4">
              <p className="text-2xl mb-2">💬</p>
              <p className="text-sm font-bold text-slate-700 mb-1">Aucun argument pour le moment.</p>
              <p className="text-xs text-slate-400">Soyez le premier à ouvrir le débat !</p>
            </div>
          ) : (
            /* Liste des arguments */
            <div className="space-y-4 mb-4">
              {pourDbArgs.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ThumbsUp size={12} className="text-green-600" />
                    <span className="text-xs font-semibold text-green-700">Pour ({pourDbArgs.length})</span>
                  </div>
                  <div className="space-y-2">
                    {pourDbArgs.map(arg => <ArgCard key={arg.id} arg={arg} color="green" />)}
                  </div>
                </div>
              )}
              {contreDbArgs.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ThumbsDown size={12} className="text-red-500" />
                    <span className="text-xs font-semibold text-red-600">Contre ({contreDbArgs.length})</span>
                  </div>
                  <div className="space-y-2">
                    {contreDbArgs.map(arg => <ArgCard key={arg.id} arg={arg} color="red" />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CTA ou formulaire */}
          {showForm ? renderForm() : renderCta()}
        </div>
      </div>

      {/* Bouton de vote fixé en bas */}
      {proposal.stage === 'voting' && (
        <div className="p-4 border-t border-slate-100 bg-white flex-shrink-0">
          {hasVoted ? (
            <div className="w-full bg-slate-100 text-slate-400 rounded-xl py-4 font-semibold flex items-center justify-center gap-2">
              <Vote size={18} />
              Vous avez déjà voté
            </div>
          ) : (
            <button
              onClick={onVote}
              className="w-full bg-indigo-600 text-white rounded-xl py-4 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all"
            >
              <Vote size={18} />
              Entrer dans l'isoloir
            </button>
          )}
        </div>
      )}
    </div>
  )
}
