import { useState, useEffect, useRef } from 'react'
import { X, CheckCircle, Share2, Copy, Camera } from 'lucide-react'
import { toPng } from 'html-to-image'
import { supabase } from '../../supabaseClient'

interface AssembleeData {
  pour: number
  contre: number
  abstention: number
  sort: string
}

// ── Carte visuelle hors-écran (format story 9:16) ─────────────
function ShareCard({
  cardRef,
  title,
  targetType,
  votes,
  total,
  pourPct,
  contrePct,
  blancPct,
  assemblee,
  aPourPct,
  aContrePct,
  aAbstPct,
  sortLabel,
}: {
  cardRef: React.RefObject<HTMLDivElement | null>
  title?: string
  targetType: 'law' | 'proposal'
  votes: { pour: number; contre: number; blanc: number }
  total: number
  pourPct: number
  contrePct: number
  blancPct: number
  assemblee: AssembleeData | null
  aPourPct: number
  aContrePct: number
  aAbstPct: number
  sortLabel: string
}) {
  const s = {
    card: {
      position: 'fixed' as const,
      left: '-9999px',
      top: '0',
      width: '540px',
      height: '960px',
      background: 'linear-gradient(150deg, #1e1b4b 0%, #312e81 45%, #4338ca 100%)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex',
      flexDirection: 'column' as const,
      padding: '40px 32px 36px',
      color: 'white',
      overflow: 'hidden',
      boxSizing: 'border-box' as const,
    },
  }

  const barRow = (label: string, pct: number, barColor: string, numColor: string, count: number) => (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: numColor, opacity: 0.9 }}>{label}</span>
        <span style={{ fontSize: '52px', fontWeight: 900, color: numColor, lineHeight: 1 }}>{pct}%</span>
      </div>
      <div style={{ height: '8px', background: 'rgba(255,255,255,0.12)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '4px' }} />
      </div>
      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)', marginTop: '4px' }}>
        {count.toLocaleString('fr-FR')} vote{count !== 1 ? 's' : ''}
      </p>
    </div>
  )

  const adoptColor = sortLabel.toLowerCase().includes('adopt') ? '#86efac' : '#fca5a5'
  const adoptBg = sortLabel.toLowerCase().includes('adopt') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'

  return (
    <div ref={cardRef} style={s.card}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <div style={{ width: '42px', height: '42px', background: 'rgba(255,255,255,0.15)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
          🗳️
        </div>
        <span style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.5px' }}>CHOISISSONS</span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          {targetType === 'law' ? 'Loi' : 'Proposition'}
        </span>
      </div>

      {/* Titre */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{
          fontSize: title && title.length > 80 ? '18px' : '22px',
          fontWeight: 800,
          lineHeight: 1.3,
          color: 'white',
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}>
          {title ?? 'Proposition citoyenne'}
        </p>
      </div>

      {/* Résultats citoyens */}
      <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '18px', padding: '22px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <p style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '16px' }}>
          👥 Avis citoyens
        </p>
        {barRow('Pour', pourPct, '#22c55e', '#4ade80', votes.pour)}
        {barRow('Contre', contrePct, '#ef4444', '#f87171', votes.contre)}
        {barRow('Vote blanc', blancPct, 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.55)', votes.blanc)}
        <div style={{ marginTop: '12px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
            <strong style={{ color: 'white', fontWeight: 800 }}>{total.toLocaleString('fr-FR')}</strong>{' '}
            vote{total !== 1 ? 's' : ''} exprimé{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Bloc Assemblée */}
      {assemblee && (
        <div style={{ background: 'rgba(0,35,149,0.35)', borderRadius: '16px', padding: '18px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              🏛️ Et les députés ?
            </p>
            {sortLabel && (
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '99px', background: adoptBg, color: adoptColor }}>
                {sortLabel}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', textAlign: 'center' }}>
            {[
              { label: 'Pour', pct: aPourPct, color: '#4ade80' },
              { label: 'Contre', pct: aContrePct, color: '#f87171' },
              { label: 'Abst.', pct: aAbstPct, color: 'rgba(255,255,255,0.35)' },
            ].map(({ label, pct, color }) => (
              <div key={label} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 4px' }}>
                <p style={{ fontSize: '30px', fontWeight: 900, color, lineHeight: 1 }}>{pct}%</p>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '3px' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* CTA footer */}
      <div style={{ background: 'rgba(255,255,255,0.09)', borderRadius: '16px', padding: '20px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.14)' }}>
        <p style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px', letterSpacing: '-0.3px' }}>
          Votez sur <span style={{ color: '#a5b4fc' }}>choisissons.fr</span>
        </p>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>La démocratie participative</p>
      </div>
    </div>
  )
}

// ── Modal principal ────────────────────────────────────────────
export default function ResultsModal({
  proposalId,
  onClose,
  targetType = 'proposal',
  title,
  alreadyVoted = false,
}: {
  proposalId: string
  onClose: () => void
  targetType?: 'law' | 'proposal'
  title?: string
  alreadyVoted?: boolean
}) {
  const [votes, setVotes] = useState({ pour: 0, contre: 0, blanc: 0 })
  const [assemblee, setAssemblee] = useState<AssembleeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [animated, setAnimated] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sharingImage, setSharingImage] = useState(false)

  const cardRef = useRef<HTMLDivElement>(null)

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

  async function handleShareImage() {
    if (!cardRef.current) return
    setSharingImage(true)
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })

      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const file = new File([blob], 'choisissons-vote.png', { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'CHOISISSONS — Mon vote',
          text: title ? `J'ai voté sur « ${title} »` : 'Je participe à CHOISISSONS',
        })
      } else {
        // Fallback : téléchargement
        const link = document.createElement('a')
        link.download = 'choisissons-vote.png'
        link.href = dataUrl
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch { /* dismissed ou erreur silencieuse */ } finally {
      setSharingImage(false)
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
    <>
      {/* Carte hors-écran pour la capture PNG */}
      <ShareCard
        cardRef={cardRef}
        title={title}
        targetType={targetType}
        votes={votes}
        total={total}
        pourPct={pourPct}
        contrePct={contrePct}
        blancPct={blancPct}
        assemblee={assemblee}
        aPourPct={aPourPct}
        aContrePct={aContrePct}
        aAbstPct={aAbstPct}
        sortLabel={sortLabel}
      />

      {/* Modal visible */}
      <div className="fixed inset-0 z-50 flex items-end p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle size={18} className="text-green-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {alreadyVoted ? 'Vote déjà enregistré' : 'Votre vote a été enregistré'}
                </p>
                <p className="text-xs text-slate-400">Résultats en temps réel</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <X size={16} className="text-slate-500" />
            </button>
          </div>

          {/* Bannière « déjà voté » */}
          {alreadyVoted && (
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2 flex-shrink-0">
              <CheckCircle size={15} className="text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700 font-medium">Vous avez déjà voté sur ce sujet.</p>
            </div>
          )}

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

                {/* ── Et les députés ? ─────────────────────────── */}
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

          {/* Footer */}
          <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex-shrink-0 space-y-2">
            {/* Boutons de partage côte à côte */}
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-slate-200"
              >
                {copied ? <><Copy size={15} />Copié !</> : <><Share2 size={15} />Lien</>}
              </button>
              <button
                onClick={handleShareImage}
                disabled={loading || sharingImage}
                className="flex-1 py-3 rounded-xl bg-indigo-50 text-indigo-700 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-indigo-100 disabled:opacity-50"
              >
                {sharingImage
                  ? <><span className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />Génération…</>
                  : <><Camera size={15} />Image</>
                }
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm active:scale-95 transition-all"
            >
              Fermer
            </button>
          </div>

        </div>
      </div>
    </>
  )
}
