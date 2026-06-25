import { useState, useEffect } from 'react'
import { X, CheckCircle, Share2, Copy } from 'lucide-react'
import { supabase } from '../../supabaseClient'

interface AssembleeData {
  pour: number
  contre: number
  abstention: number
  sort: string
}

export default function ResultsModal({
  proposalId,
  onClose,
  targetType = 'proposal',
  title,
}: {
  proposalId: string
  onClose: () => void
  targetType?: 'law' | 'proposal'
  title?: string
}) {
  const [votes, setVotes] = useState({ pour: 0, contre: 0, blanc: 0 })
  const [assemblee, setAssemblee] = useState<AssembleeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [animated, setAnimated] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchResults() {
      try {
        if (targetType === 'law') {
          const { data, error } = await supabase
            .from('parliamentary_laws')
            .select('votes_pour, votes_contre, votes_blanc, assemblee_pour, assemblee_contre, assemblee_abstention, assemblee_sort')
            .eq('id', proposalId)
            .single()
          if (error) throw error
          if (!cancelled && data) {
            setVotes({
              pour: (data.votes_pour as number) ?? 0,
              contre: (data.votes_contre as number) ?? 0,
              blanc: (data.votes_blanc as number) ?? 0,
            })
            const ap = (data.assemblee_pour as number) ?? 0
            const ac = (data.assemblee_contre as number) ?? 0
            if (ap + ac > 0) {
              setAssemblee({
                pour: ap,
                contre: ac,
                abstention: (data.assemblee_abstention as number) ?? 0,
                sort: (data.assemblee_sort as string) ?? '',
              })
            }
          }
        } else {
          const { data, error } = await supabase
            .from('proposals')
            .select('votes_pour, votes_contre, votes_blanc')
            .eq('id', proposalId)
            .single()
          if (error) throw error
          if (!cancelled && data) {
            setVotes({
              pour: (data as { votes_pour: number }).votes_pour ?? 0,
              contre: (data as { votes_contre: number }).votes_contre ?? 0,
              blanc: (data as { votes_blanc: number }).votes_blanc ?? 0,
            })
          }
        }
      } catch { /* keep zeros */ } finally {
        if (!cancelled) {
          setLoading(false)
          setTimeout(() => setAnimated(true), 60)
        }
      }
    }
    fetchResults()
    return () => { cancelled = true }
  }, [proposalId, targetType])

  async function handleShare() {
    const url = window.location.origin
    const text = title
      ? `J'ai voté sur « ${title} ». Et toi, tu en penses quoi ?`
      : 'Je participe à CHOISISSONS — la démocratie citoyenne.'
    if (navigator.share) {
      try { await navigator.share({ title: 'CHOISISSONS', text, url }) } catch { /* dismissed */ }
    } else {
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      } catch { /* ignore */ }
    }
  }

  const total = votes.pour + votes.contre + votes.blanc
  const pourPct = total > 0 ? Math.round((votes.pour / total) * 100) : 0
  const contrePct = total > 0 ? Math.round((votes.contre / total) * 100) : 0
  const blancPct = 100 - pourPct - contrePct

  const citizenBars = [
    { label: 'Pour', pct: pourPct, color: 'bg-green-500', textColor: 'text-green-600', count: votes.pour },
    { label: 'Contre', pct: contrePct, color: 'bg-red-400', textColor: 'text-red-500', count: votes.contre },
    { label: 'Vote blanc', pct: blancPct, color: 'bg-slate-300', textColor: 'text-slate-500', count: votes.blanc },
  ]

  const aTotal = assemblee ? assemblee.pour + assemblee.contre + assemblee.abstention : 0
  const aPourPct = aTotal > 0 ? Math.round((assemblee!.pour / aTotal) * 100) : 0
  const aContrePct = aTotal > 0 ? Math.round((assemblee!.contre / aTotal) * 100) : 0
  const aAbstPct = aTotal > 0 ? 100 - aPourPct - aContrePct : 0

  const sortLabel = assemblee?.sort ?? ''
  const sortCls = sortLabel.toLowerCase().includes('adopt')
    ? 'bg-green-100 text-green-700'
    : sortLabel.toLowerCase().includes('rejet')
      ? 'bg-red-100 text-red-600'
      : 'bg-slate-100 text-slate-600'

  return (
    <div className="fixed inset-0 z-50 flex items-end p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={18} className="text-green-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Votre vote a été enregistré</p>
              <p className="text-xs text-slate-400">Résultats en temps réel</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {loading ? (
            <div className="space-y-5">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2 animate-pulse">
                  <div className="flex justify-between">
                    <div className="h-3 bg-slate-100 rounded w-16" />
                    <div className="h-3 bg-slate-100 rounded w-8" />
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* ── Résultats citoyens ───────────────────────── */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  {targetType === 'law' ? '👥 Avis citoyens CHOISISSONS' : '👥 Résultats citoyens'}
                </p>
                <div className="space-y-3">
                  {citizenBars.map(({ label, pct, color, textColor, count }) => (
                    <div key={label}>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className={`text-sm font-semibold ${textColor}`}>{label}</span>
                        <span className={`text-xl font-black ${textColor}`}>{pct}%</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full transition-all duration-700 ease-out`}
                          style={{ width: animated ? `${pct}%` : '0%' }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {count.toLocaleString('fr-FR')} vote{count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="pt-3 mt-1 border-t border-slate-100 text-center">
                  <p className="text-sm text-slate-500">
                    <span className="font-bold text-slate-700">{total.toLocaleString('fr-FR')}</span>{' '}
                    vote{total !== 1 ? 's' : ''} exprimé{total !== 1 ? 's' : ''} au total
                  </p>
                </div>
              </div>

              {/* ── Et les députés ? (lois seulement) ───────── */}
              {assemblee && (
                <div className="bg-blue-50 border border-[#002395]/10 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold text-[#002395] uppercase tracking-wider">
                      🏛️ Et les députés ?
                    </p>
                    {sortLabel && (
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${sortCls}`}>
                        {sortLabel}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Pour', pct: aPourPct, color: 'bg-green-500', count: assemblee.pour },
                      { label: 'Contre', pct: aContrePct, color: 'bg-red-400', count: assemblee.contre },
                      { label: 'Abstention', pct: aAbstPct, color: 'bg-slate-300', count: assemblee.abstention },
                    ].map(({ label, pct, color, count }) => (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-600 font-medium">{label}</span>
                          <span className="text-xs font-bold text-slate-700">
                            {pct}%{' '}
                            <span className="font-normal text-slate-400">({count.toLocaleString('fr-FR')})</span>
                          </span>
                        </div>
                        <div className="h-2 bg-white border border-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${color} rounded-full transition-all duration-700 ease-out`}
                            style={{ width: animated ? `${pct}%` : '0%' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 text-right">
                    {aTotal.toLocaleString('fr-FR')} député{aTotal !== 1 ? 's' : ''} ont voté
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer : partage + fermer */}
        <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex-shrink-0 space-y-2">
          <button
            onClick={handleShare}
            className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-slate-200"
          >
            {copied
              ? <><Copy size={15} />Lien copié !</>
              : <><Share2 size={15} />Partager mon vote</>
            }
          </button>
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm active:scale-95 transition-all"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  )
}
