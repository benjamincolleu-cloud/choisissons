import { useState, useEffect } from 'react'
import { X, Users, ThumbsUp, ThumbsDown, Vote } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import type { Proposal } from '../../types'

interface DbArg {
  id: number
  side: 'pour' | 'contre'
  content: string
  author_hash: string
  created_at: string
  flags_count: number
}

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
  const [argSide, setArgSide] = useState<'pour' | 'contre' | null>(null)
  const [argText, setArgText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
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
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return
      const { data } = await supabase
        .from('profiles')
        .select('subscription_status, subscription_plan')
        .eq('id', user.id)
        .single()
      if (!cancelled && data) {
        setIsSubscribed(
          data.subscription_status === 'active' &&
          String(data.subscription_plan ?? '').includes('citoyen')
        )
      }
    })
    return () => { cancelled = true }
  }, [proposal.id, targetType])

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
    if (/https?:\/\//i.test(argText)) {
      setSubmitError('Les URLs ne sont pas autorisées dans les arguments.')
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const { error } = await supabase.from('arguments').insert({
        target_id: proposal.id,
        target_type: targetType ?? 'proposal',
        side: argSide,
        content: argText.trim(),
        author_hash: userHash,
        moderation_status: 'published',
      })
      if (error) throw error
      setArgText('')
      setArgSide(null)
      await refreshArgs()
    } catch {
      setSubmitError("Erreur lors de la publication. Réessayez.")
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

  function ArgCard({ arg, color }: { arg: DbArg; color: 'green' | 'red' }) {
    const bg = color === 'green' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
    const badge = color === 'green'
      ? 'text-green-600 bg-green-100'
      : 'text-red-500 bg-red-100'
    return (
      <div className={`border rounded-xl p-3 ${bg}`}>
        <p className="text-sm text-slate-700 leading-relaxed">{arg.content}</p>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${badge}`}>
              Citoyen soutenant
            </span>
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-3 p-4 border-b border-slate-100 flex-shrink-0">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
          <X size={18} className="text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Agora — Débat citoyen</p>
          <h2 className="font-bold text-slate-800 text-sm leading-tight truncate">{proposal.title}</h2>
        </div>
      </div>

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
        <div className="flex gap-2 mt-2 flex-wrap">
          {proposal.tags.map(tag => (
            <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">#{tag}</span>
          ))}
        </div>
      </div>

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

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-indigo-500" />
            <h3 className="font-bold text-slate-700 text-sm">Agora — le débat citoyen</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">Arguments publiés par les citoyens soutenant</p>

          {loadingArgs ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />)}
            </div>
          ) : pourDbArgs.length === 0 && contreDbArgs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4 italic">Aucun argument publié pour l'instant.</p>
          ) : (
            <div className="space-y-4">
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
        </div>

        <div className="p-4">
          {isSubscribed ? (
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-1">Publier votre argument</h4>
              <p className="text-[10px] text-slate-400 mb-3 leading-relaxed bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                Charte : respect, argumentation factuelle, pas d'attaques personnelles. Les avis contraires seront supprimés.
              </p>
              <div className="flex gap-2 mb-3">
                {(['pour', 'contre'] as const).map(side => (
                  <button
                    key={side}
                    onClick={() => setArgSide(argSide === side ? null : side)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${argSide === side
                      ? side === 'pour' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                  >
                    {side === 'pour' ? '👍 Pour' : '👎 Contre'}
                  </button>
                ))}
              </div>
              {argSide && (
                <>
                  <textarea
                    value={argText}
                    onChange={e => { setArgText(e.target.value); setSubmitError('') }}
                    placeholder="Votre argument (50 à 500 caractères, sans lien URL)…"
                    maxLength={500}
                    rows={3}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <div className="flex items-center justify-between mt-1 mb-2">
                    <span className={`text-[10px] ${argText.length < 50 ? 'text-red-400' : 'text-slate-400'}`}>
                      {argText.length} / 500 {argText.length < 50 && `(min. 50)`}
                    </span>
                  </div>
                  {submitError && <p className="text-xs text-red-500 mb-2">{submitError}</p>}
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || argText.trim().length < 50}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50 transition-all active:scale-95"
                  >
                    {submitting ? 'Publication…' : 'Publier mon argument'}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center">
              <p className="text-sm font-bold text-indigo-700 mb-1">Devenez Citoyen soutenant</p>
              <p className="text-xs text-indigo-500 mb-3 leading-relaxed">
                Pour publier votre avis argumenté dans l'Agora (2 €/mois).
              </p>
              {onNavigateSupport && (
                <button
                  onClick={() => { onClose(); onNavigateSupport() }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all"
                >
                  Voir les forfaits →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

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
