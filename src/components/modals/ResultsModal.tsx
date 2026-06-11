import { useState, useEffect } from 'react'
import { X, CheckCircle } from 'lucide-react'
import { supabase } from '../../supabaseClient'

export default function ResultsModal({ proposalId, onClose }: { proposalId: string; onClose: () => void }) {
  const [votes, setVotes] = useState({ pour: 0, contre: 0, blanc: 0 })
  const [loading, setLoading] = useState(true)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchResults() {
      try {
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
      } catch { /* keep zeros */ }
      finally {
        if (!cancelled) {
          setLoading(false)
          setTimeout(() => setAnimated(true), 60)
        }
      }
    }
    fetchResults()
    return () => { cancelled = true }
  }, [proposalId])

  const total = votes.pour + votes.contre + votes.blanc
  const pourPct = total > 0 ? Math.round((votes.pour / total) * 100) : 0
  const contrePct = total > 0 ? Math.round((votes.contre / total) * 100) : 0
  const blancPct = 100 - pourPct - contrePct

  const bars = [
    { label: 'Pour', pct: pourPct, color: 'bg-green-500', textColor: 'text-green-600', count: votes.pour },
    { label: 'Contre', pct: contrePct, color: 'bg-red-400', textColor: 'text-red-500', count: votes.contre },
    { label: 'Vote blanc', pct: blancPct, color: 'bg-slate-300', textColor: 'text-slate-500', count: votes.blanc },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={18} className="text-green-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Votre vote a été enregistré</p>
              <p className="text-xs text-slate-400">Résultats en temps réel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
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
              {bars.map(({ label, pct, color, textColor, count }) => (
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

              <div className="pt-3 border-t border-slate-100 text-center">
                <p className="text-sm text-slate-500">
                  <span className="font-bold text-slate-700">{total.toLocaleString('fr-FR')}</span>{' '}
                  vote{total !== 1 ? 's' : ''} exprimé{total !== 1 ? 's' : ''} au total
                </p>
              </div>
            </>
          )}
        </div>

        <div className="px-5 pb-5">
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
