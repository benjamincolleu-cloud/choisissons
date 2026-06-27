import { useState, useEffect, useRef } from 'react'
import { X, CheckCircle, Share2, Copy, Camera, Download, ArrowLeft } from 'lucide-react'
import { toPng } from 'html-to-image'
import { supabase } from '../../supabaseClient'

interface AssembleeData {
  pour: number
  contre: number
  abstention: number
  sort: string
}

// ────────────────────────────────────────────────────────────────
// Carte visuelle format story (1080×1920).
// Positionnée hors-écran via position:fixed — pas de display:none
// ni de visibility:hidden, sinon html-to-image capture du blanc/noir.
// ────────────────────────────────────────────────────────────────
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
  const adoptColor = sortLabel.toLowerCase().includes('adopt') ? '#86efac' : '#fca5a5'
  const adoptBg   = sortLabel.toLowerCase().includes('adopt')
    ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'

  function Bar(label: string, pct: number, barColor: string, numColor: string, count: number) {
    return (
      <div key={label} style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
          <span style={{ fontSize: '30px', fontWeight: 700, color: numColor }}>{label}</span>
          <span style={{ fontSize: '100px', fontWeight: 900, color: numColor, lineHeight: 1 }}>{pct}%</span>
        </div>
        <div style={{ height: '14px', background: 'rgba(255,255,255,0.12)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '8px' }} />
        </div>
        <p style={{ fontSize: '22px', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>
          {count.toLocaleString('fr-FR')} vote{count !== 1 ? 's' : ''}
        </p>
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      style={{
        // Hors-écran mais rendu réellement dans le DOM
        position: 'fixed',
        left: '-99999px',
        top: '0',
        // Dimensions explicites 1080×1920 (format story 9:16)
        width: '1080px',
        height: '1920px',
        // Fond opaque — sans ça, la transparence devient noire sur Facebook/Instagram
        backgroundColor: '#1e1b4b',
        background: 'linear-gradient(150deg,#1e1b4b 0%,#312e81 45%,#4338ca 100%)',
        // Polices système uniquement — pas d'import externe qui bloquerait Safari
        fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
        display: 'flex',
        flexDirection: 'column',
        padding: '80px 64px 72px',
        color: 'white',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Logo — carré coloré sans image externe pour éviter le canvas "tainted" */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '56px' }}>
        <div style={{
          width: '80px', height: '80px',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: '36px', height: '36px', background: '#a5b4fc', borderRadius: '6px' }} />
        </div>
        <span style={{ fontSize: '44px', fontWeight: 900, letterSpacing: '-1px' }}>CHOISISSONS</span>
        <span style={{ marginLeft: 'auto', fontSize: '20px', color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
          {targetType === 'law' ? 'Loi' : 'Proposition'}
        </span>
      </div>

      {/* Titre */}
      <div style={{ marginBottom: '48px' }}>
        <p style={{
          fontSize: (title ?? '').length > 80 ? '34px' : '42px',
          fontWeight: 800,
          lineHeight: 1.25,
          color: 'white',
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {title ?? 'Proposition citoyenne'}
        </p>
      </div>

      {/* Résultats citoyens */}
      <div style={{
        background: 'rgba(255,255,255,0.07)',
        borderRadius: '32px',
        padding: '44px',
        marginBottom: '24px',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <p style={{ fontSize: '20px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '32px' }}>
          Avis citoyens
        </p>
        {Bar('Pour',       pourPct,   '#22c55e', '#4ade80', votes.pour)}
        {Bar('Contre',     contrePct, '#ef4444', '#f87171', votes.contre)}
        {Bar('Vote blanc', blancPct,  'rgba(255,255,255,0.28)', 'rgba(255,255,255,0.55)', votes.blanc)}
        <div style={{ marginTop: '20px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <p style={{ fontSize: '24px', color: 'rgba(255,255,255,0.5)' }}>
            <strong style={{ color: 'white', fontWeight: 800 }}>{total.toLocaleString('fr-FR')}</strong>
            {' '}vote{total !== 1 ? 's' : ''} exprime{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Bloc Assemblée */}
      {assemblee && (
        <div style={{
          background: 'rgba(0,35,149,0.35)',
          borderRadius: '28px',
          padding: '36px',
          marginBottom: '24px',
          border: '1px solid rgba(255,255,255,0.12)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
            <p style={{ fontSize: '20px', fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '2px' }}>
              Et les deputes ?
            </p>
            {sortLabel && (
              <span style={{ fontSize: '20px', fontWeight: 700, padding: '6px 20px', borderRadius: '99px', background: adoptBg, color: adoptColor }}>
                {sortLabel}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '16px', textAlign: 'center' }}>
            {[
              { label: 'Pour',   pct: aPourPct,   color: '#4ade80' },
              { label: 'Contre', pct: aContrePct, color: '#f87171' },
              { label: 'Abst.',  pct: aAbstPct,   color: 'rgba(255,255,255,0.35)' },
            ].map(({ label, pct, color }) => (
              <div key={label} style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: '20px', padding: '20px 8px' }}>
                <p style={{ fontSize: '56px', fontWeight: 900, color, lineHeight: 1 }}>{pct}%</p>
                <p style={{ fontSize: '20px', color: 'rgba(255,255,255,0.45)', marginTop: '6px' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* CTA footer */}
      <div style={{
        background: 'rgba(255,255,255,0.09)',
        borderRadius: '28px',
        padding: '40px',
        textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.13)',
      }}>
        <p style={{ fontSize: '30px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>
          Votez sur{' '}
          <span style={{ color: '#a5b4fc' }}>choisissons.fr</span>
        </p>
        <p style={{ fontSize: '22px', color: 'rgba(255,255,255,0.45)' }}>La democratie participative</p>
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
  const [votes, setVotes]           = useState({ pour: 0, contre: 0, blanc: 0 })
  const [assemblee, setAssemblee]   = useState<AssembleeData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [animated, setAnimated]     = useState(false)
  const [copied, setCopied]         = useState(false)
  const [sharingImage, setSharingImage] = useState(false)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [imageError, setImageError]     = useState<string | null>(null)

  const cardRef = useRef<HTMLDivElement>(null)

  // ── Chargement des résultats ────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function fetchResults() {
      try {
        if (targetType === 'law') {
          const { data, error } = await supabase
            .from('parliamentary_laws')
            .select('votes_pour,votes_contre,votes_blanc,assemblee_pour,assemblee_contre,assemblee_abstention,assemblee_sort')
            .eq('id', proposalId)
            .single()
          if (error) throw error
          if (!cancelled && data) {
            setVotes({
              pour:   (data.votes_pour   as number) ?? 0,
              contre: (data.votes_contre as number) ?? 0,
              blanc:  (data.votes_blanc  as number) ?? 0,
            })
            const ap = (data.assemblee_pour   as number) ?? 0
            const ac = (data.assemblee_contre as number) ?? 0
            if (ap + ac > 0) {
              setAssemblee({
                pour:       ap,
                contre:     ac,
                abstention: (data.assemblee_abstention as number) ?? 0,
                sort:       (data.assemblee_sort as string) ?? '',
              })
            }
          }
        } else {
          const { data, error } = await supabase
            .from('proposals')
            .select('votes_pour,votes_contre,votes_blanc')
            .eq('id', proposalId)
            .single()
          if (error) throw error
          if (!cancelled && data) {
            setVotes({
              pour:   (data as { votes_pour: number }).votes_pour   ?? 0,
              contre: (data as { votes_contre: number }).votes_contre ?? 0,
              blanc:  (data as { votes_blanc: number }).votes_blanc   ?? 0,
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

  // ── Partage lien ──────────────────────────────────────────
  async function handleShare() {
    const url  = window.location.origin
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

  // ── Génération et partage de l'image ─────────────────────
  async function handleShareImage() {
    const el = cardRef.current
    if (!el) return
    setSharingImage(true)
    setImageError(null)

    try {
      // Attend les polices système
      await document.fonts.ready

      const opts = {
        width:           1080,
        height:          1920,
        backgroundColor: '#1e1b4b', // fond opaque — évite le noir sur Facebook
        cacheBust:       true,
        pixelRatio:      2,
        skipFonts:       true,      // pas de polices externes à charger
      } as const

      // Correctif Safari : 1er appel souvent vide — ignoré intentionnellement
      await toPng(el, opts).catch(() => {})

      // 2e appel : résultat fiable sur tous navigateurs
      const dataUrl = await toPng(el, opts)

      // Diagnostic : dimensions réelles de l'image générée
      const img = new window.Image()
      img.onload = () => {
        console.log(`[ShareImage] image générée : ${img.naturalWidth}×${img.naturalHeight}px`)
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          console.error('[ShareImage] ⚠️ Image vide — mauvais élément capturé ?', el)
        }
      }
      img.src = dataUrl

      const res  = await fetch(dataUrl)
      const blob = await res.blob()
      const file = new File([blob], 'choisissons-vote.png', { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // Mobile : partage natif avec l'image
        await navigator.share({
          files: [file],
          title: 'CHOISISSONS — Mon vote',
          text: title ? `J'ai voté sur « ${title} »` : 'Je participe à CHOISISSONS',
        })
      } else {
        // Desktop : affiche le PNG dans le modal pour téléchargement
        setImageDataUrl(dataUrl)
      }
    } catch (err) {
      console.error('[ShareImage] erreur html-to-image :', err)
      setImageError('La génération de l\'image a échoué. Réessayez ou faites une capture d\'écran.')
    } finally {
      setSharingImage(false)
    }
  }

  // ── Calculs ──────────────────────────────────────────────
  const total      = votes.pour + votes.contre + votes.blanc
  const pourPct    = total > 0 ? Math.round((votes.pour   / total) * 100) : 0
  const contrePct  = total > 0 ? Math.round((votes.contre / total) * 100) : 0
  const blancPct   = 100 - pourPct - contrePct

  const citizenBars = [
    { label: 'Pour',       pct: pourPct,   color: 'bg-green-500', textColor: 'text-green-600', count: votes.pour   },
    { label: 'Contre',     pct: contrePct, color: 'bg-red-400',   textColor: 'text-red-500',   count: votes.contre },
    { label: 'Vote blanc', pct: blancPct,  color: 'bg-slate-300', textColor: 'text-slate-500', count: votes.blanc  },
  ]

  const aTotal     = assemblee ? assemblee.pour + assemblee.contre + assemblee.abstention : 0
  const aPourPct   = aTotal > 0 ? Math.round((assemblee!.pour   / aTotal) * 100) : 0
  const aContrePct = aTotal > 0 ? Math.round((assemblee!.contre / aTotal) * 100) : 0
  const aAbstPct   = aTotal > 0 ? 100 - aPourPct - aContrePct : 0

  const sortLabel = assemblee?.sort ?? ''
  const sortCls   = sortLabel.toLowerCase().includes('adopt')
    ? 'bg-green-100 text-green-700'
    : sortLabel.toLowerCase().includes('rejet')
      ? 'bg-red-100 text-red-600'
      : 'bg-slate-100 text-slate-600'

  return (
    <>
      {/* Carte hors-écran — toujours dans le DOM */}
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

          {/* Bannière déjà voté */}
          {alreadyVoted && (
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2 flex-shrink-0">
              <CheckCircle size={15} className="text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700 font-medium">Vous avez déjà voté sur ce sujet.</p>
            </div>
          )}

          {/* Erreur génération image */}
          {imageError && (
            <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex-shrink-0">
              <p className="text-xs text-red-600 font-medium">{imageError}</p>
            </div>
          )}

          {/* Corps scrollable */}
          <div className="overflow-y-auto flex-1">
            {imageDataUrl ? (
              /* ── Prévisualisation PNG ── */
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-700">Votre carte</p>
                  <button
                    onClick={() => setImageDataUrl(null)}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <ArrowLeft size={12} />
                    Retour aux résultats
                  </button>
                </div>

                <img
                  src={imageDataUrl}
                  alt="Carte de résultat CHOISISSONS"
                  className="w-full rounded-2xl shadow-md"
                  style={{ maxHeight: '55vh', objectFit: 'contain' }}
                />

                <a
                  href={imageDataUrl}
                  download="choisissons-vote.png"
                  className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Download size={15} />
                  Télécharger l'image
                </a>

                <p className="text-xs text-slate-400 text-center">
                  Sur Mac : clic droit sur l'image → « Enregistrer l'image sous… »
                </p>
              </div>

            ) : (
              /* ── Résultats ── */
              <div className="p-5 space-y-5">
                {loading ? (
                  <div className="space-y-5">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="space-y-2 animate-pulse">
                        <div className="flex justify-between">
                          <div className="h-3 bg-slate-100 rounded w-16" />
                          <div className="h-3 bg-slate-100 rounded w-8"  />
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Résultats citoyens */}
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

                    {/* Bloc Assemblée */}
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
                            { label: 'Pour',       pct: aPourPct,   color: 'bg-green-500', count: assemblee.pour       },
                            { label: 'Contre',     pct: aContrePct, color: 'bg-red-400',   count: assemblee.contre     },
                            { label: 'Abstention', pct: aAbstPct,   color: 'bg-slate-300', count: assemblee.abstention },
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
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex-shrink-0 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-slate-200"
              >
                {copied
                  ? <><Copy size={15} />Copié !</>
                  : <><Share2 size={15} />Lien</>
                }
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
