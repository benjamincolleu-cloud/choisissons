import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Plus, X, Vote, BookOpen, Newspaper, Info } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { showToast } from '../lib/toast'
import { generateVoteProof } from '../lib/identity'
import { loadPendingVotes, savePendingVotes } from '../lib/votes'
import { mapRowToProposal, canDo } from '../lib/utils'
import type { Organisation, CommuneRole, Proposal, VoteChoice, CommuneNews, CommuneEvent, ProposalRow } from '../types'
import StageBadge from '../components/common/StageBadge'
import ProposalCard from '../components/proposals/ProposalCard'
import AgoraModal from '../components/modals/AgoraModal'
import VotingBooth from '../components/modals/VotingBooth'
import ResultsModal from '../components/modals/ResultsModal'

export default function CommunePage({ commune, userRole, onBack }: {
  commune: Organisation
  userRole: CommuneRole
  onBack: () => void
}) {
  const { userHash } = useAuth()
  const [tab, setTab] = useState<'consultations' | 'archives' | 'actus' | 'agenda'>('consultations')

  const [activeProposals, setActiveProposals] = useState<Proposal[]>([])
  const [archivedProposals, setArchivedProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [agoraProposal, setAgoraProposal] = useState<Proposal | null>(null)
  const [votingProposal, setVotingProposal] = useState<Proposal | null>(null)
  const [votedChoices, setVotedChoices] = useState<Record<string, VoteChoice>>({})
  const [resultsProposalId, setResultsProposalId] = useState<string | null>(null)

  const [news, setNews] = useState<CommuneNews[]>([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [showNewsForm, setShowNewsForm] = useState(false)
  const [newsTitle, setNewsTitle] = useState('')
  const [newsContent, setNewsContent] = useState('')
  const [newsCategory, setNewsCategory] = useState<CommuneNews['category']>('info')
  const [submittingNews, setSubmittingNews] = useState(false)

  const [events, setEvents] = useState<CommuneEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [showEventForm, setShowEventForm] = useState(false)
  const [evTitle, setEvTitle] = useState('')
  const [evDesc, setEvDesc] = useState('')
  const [evDate, setEvDate] = useState('')
  const [evEndDate, setEvEndDate] = useState('')
  const [evLocation, setEvLocation] = useState('')
  const [evCategory, setEvCategory] = useState<CommuneEvent['category']>('reunion')
  const [submittingEvent, setSubmittingEvent] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchProposals() {
      try {
        const [activeRes, archiveRes] = await Promise.all([
          supabase
            .from('proposals')
            .select('id,title,description,category,status,supports,votes_pour,votes_contre,votes_blanc,tags,created_at,blockchain_proof')
            .eq('organisation_id', commune.id)
            .in('status', ['seedling', 'review', 'voting'])
            .order('created_at', { ascending: false }),
          supabase
            .from('proposals')
            .select('id,title,description,category,status,supports,votes_pour,votes_contre,votes_blanc,tags,created_at,blockchain_proof')
            .eq('organisation_id', commune.id)
            .in('status', ['adopted', 'rejected', 'closed'])
            .order('created_at', { ascending: false }),
        ])
        if (!cancelled) {
          if (activeRes.data) setActiveProposals((activeRes.data as ProposalRow[]).map(mapRowToProposal))
          if (archiveRes.data) setArchivedProposals((archiveRes.data as ProposalRow[]).map(mapRowToProposal))
        }
      } catch { /* fallback vide */ } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchProposals()
    return () => { cancelled = true }
  }, [commune.id])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('commune_news')
      .select('*')
      .eq('organisation_id', commune.id)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled && data) setNews(data as CommuneNews[])
        if (!cancelled) setLoadingNews(false)
      })
    return () => { cancelled = true }
  }, [commune.id])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('commune_agenda')
      .select('*')
      .eq('organisation_id', commune.id)
      .eq('is_published', true)
      .gte('event_date', new Date().toISOString())
      .order('event_date', { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) setEvents(data as CommuneEvent[])
        if (!cancelled) setLoadingEvents(false)
      })
    return () => { cancelled = true }
  }, [commune.id])

  const handleVoted = useCallback(async (proposalId: string, choice: VoteChoice, oldChoice?: VoteChoice) => {
    const isRevote = oldChoice !== undefined
    setVotingProposal(null)
    setAgoraProposal(null)

    const choiceMap: Record<VoteChoice, string> = {
      pour: 'YES', contre: 'NO', blanc: 'ABSTAIN',
    }
    const mappedChoice = choiceMap[choice]

    setVotedChoices(prev => ({ ...prev, [proposalId]: choice }))
    setActiveProposals(prev => prev.map(p => {
      if (p.id !== proposalId) return p
      const v = { ...p.votes, [choice]: p.votes[choice] + 1 }
      if (oldChoice) v[oldChoice] = Math.max(0, v[oldChoice] - 1)
      return { ...p, votes: v }
    }))

    const proof = await generateVoteProof(proposalId, mappedChoice)
    const voteParams = {
      p_proposal_id: String(proposalId),
      p_user_hash: userHash,
      p_choice: mappedChoice,
      p_proof_hash: proof,
    }

    try {
      const { error } = await supabase.rpc('deposer_bulletin', voteParams)
      if (error) throw new Error('DB Error')
      if (isRevote) {
        showToast('Vote mis à jour ✓', 'info')
      } else {
        setResultsProposalId(proposalId)
      }
    } catch {
      const pending = loadPendingVotes()
      if (!pending.some(v => v.proposalId === proposalId)) {
        savePendingVotes([...pending, { proposalId, userHash, choice: mappedChoice, timestamp: Date.now() }])
      }
      showToast('Réseau faible. Vote sauvegardé et synchronisé à la prochaine connexion.', 'warning')
    }
  }, [userHash])

  async function handlePublishNews() {
    if (!newsTitle.trim() || !newsContent.trim()) return
    setSubmittingNews(true)
    const draft: CommuneNews = {
      id: `draft-${Date.now()}`,
      organisation_id: commune.id,
      title: newsTitle,
      content: newsContent,
      category: newsCategory,
      published_at: new Date().toISOString(),
      is_published: true,
      created_by: userHash,
    }
    setNews(prev => [draft, ...prev])
    setShowNewsForm(false)
    setNewsTitle(''); setNewsContent('')
    try {
      const { error } = await supabase.from('commune_news').insert({
        organisation_id: commune.id,
        title: newsTitle,
        content: newsContent,
        category: newsCategory,
        is_published: true,
        created_by: userHash,
      })
      if (error) throw error
    } catch {
      showToast('Une erreur est survenue. Réessayez.')
    }
    setSubmittingNews(false)
  }

  async function handlePublishEvent() {
    if (!evTitle.trim() || !evDate) return
    setSubmittingEvent(true)
    const draft: CommuneEvent = {
      id: `draft-${Date.now()}`,
      organisation_id: commune.id,
      title: evTitle,
      description: evDesc || undefined,
      event_date: evDate,
      end_date: evEndDate || undefined,
      location: evLocation || undefined,
      category: evCategory,
      is_published: true,
      created_by: userHash,
    }
    setEvents(prev => [...prev, draft].sort((a, b) => a.event_date.localeCompare(b.event_date)))
    setShowEventForm(false)
    setEvTitle(''); setEvDesc(''); setEvDate(''); setEvEndDate(''); setEvLocation('')
    try {
      const { error } = await supabase.from('commune_agenda').insert({
        organisation_id: commune.id,
        title: evTitle,
        description: evDesc || null,
        event_date: evDate,
        end_date: evEndDate || null,
        location: evLocation || null,
        category: evCategory,
        is_published: true,
        created_by: userHash,
      })
      if (error) throw error
    } catch {
      showToast('Une erreur est survenue. Réessayez.')
    }
    setSubmittingEvent(false)
  }

  const NEWS_CATEGORY_STYLE: Record<CommuneNews['category'], { label: string; bg: string; text: string }> = {
    info: { label: 'Info', bg: 'bg-blue-100', text: 'text-blue-700' },
    travaux: { label: 'Travaux', bg: 'bg-orange-100', text: 'text-orange-700' },
    evenement: { label: 'Événement', bg: 'bg-green-100', text: 'text-green-700' },
    urgence: { label: 'Urgence', bg: 'bg-red-100', text: 'text-red-700' },
  }

  const EVENT_CATEGORY_STYLE: Record<CommuneEvent['category'], { label: string; bg: string; text: string }> = {
    conseil: { label: 'Conseil', bg: 'bg-indigo-100', text: 'text-indigo-700' },
    fete: { label: 'Fête', bg: 'bg-purple-100', text: 'text-purple-700' },
    marche: { label: 'Marché', bg: 'bg-amber-100', text: 'text-amber-700' },
    reunion: { label: 'Réunion', bg: 'bg-slate-100', text: 'text-slate-700' },
    autre: { label: 'Autre', bg: 'bg-gray-100', text: 'text-gray-600' },
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-indigo-700 px-5 pt-10 pb-6 text-white">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-indigo-200 text-xs font-medium mb-5 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Retour à Mon Compte
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span className="inline-block text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/50 text-indigo-100 mb-2">
              Commune partenaire CHOISISSONS
            </span>
            <h1 className="text-xl font-black leading-tight">{commune.name}</h1>
            {commune.code_insee && (
              <p className="text-indigo-300 text-xs mt-0.5">Code INSEE : {commune.code_insee}</p>
            )}
          </div>
          {commune.population != null && (
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black">{commune.population.toLocaleString('fr-FR')}</p>
              <p className="text-indigo-300 text-xs">habitants</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto px-4 mt-4 pb-1" style={{ scrollbarWidth: 'none' }}>
        {([
          { key: 'consultations' as const, label: 'Consultations' },
          { key: 'archives' as const, label: 'Archives' },
          { key: 'actus' as const, label: 'Actualités' },
          { key: 'agenda' as const, label: 'Agenda' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${tab === t.key
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-200 text-slate-500'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* ── Consultations actives ── */}
        {tab === 'consultations' && (
          loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                </div>
              ))}
            </div>
          ) : activeProposals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
              <Vote size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">Aucune consultation en cours</p>
              <p className="text-xs text-slate-300 mt-1">Les prochaines consultations apparaîtront ici</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {activeProposals.map(proposal => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onOpen={() => setAgoraProposal(proposal)}
                  currentVote={votedChoices[proposal.id]}
                  onRevote={() => setVotingProposal(proposal)}
                />
              ))}
            </div>
          )
        )}

        {/* ── Archives ── */}
        {tab === 'archives' && (
          loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                  <div className="h-2 bg-slate-100 rounded w-full" />
                </div>
              ))}
            </div>
          ) : archivedProposals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
              <BookOpen size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">Aucune consultation archivée</p>
            </div>
          ) : (
            <div className="space-y-3">
              {archivedProposals.map(p => {
                const total = p.votes.pour + p.votes.contre + p.votes.blanc
                const pourPct = total > 0 ? Math.round((p.votes.pour / total) * 100) : 0
                const contrePct = total > 0 ? Math.round((p.votes.contre / total) * 100) : 0
                const blancPct = 100 - pourPct - contrePct
                return (
                  <div key={p.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-slate-800 flex-1 leading-snug">{p.title}</h3>
                      <StageBadge stage={p.stage} />
                    </div>
                    <p className="text-xs text-slate-400 mb-3">
                      {p.date} · {total.toLocaleString('fr-FR')} vote{total !== 1 ? 's' : ''}
                    </p>
                    {total > 0 ? (
                      <>
                        <div className="flex h-2 rounded-full overflow-hidden mb-1.5">
                          <div className="bg-green-500" style={{ width: `${pourPct}%` }} />
                          <div className="bg-red-400" style={{ width: `${contrePct}%` }} />
                          <div className="bg-slate-200" style={{ width: `${blancPct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-green-600 font-semibold">Pour {pourPct}%</span>
                          <span className="text-slate-400">Blanc {blancPct}%</span>
                          <span className="text-red-500 font-semibold">Contre {contrePct}%</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-300 italic">Aucun vote enregistré</p>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── Actualités ── */}
        {tab === 'actus' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-700">Actualités de {commune.name}</h2>
              {canDo(userRole, 'publish_news') && (
                <button
                  onClick={() => setShowNewsForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white active:scale-95 transition-all"
                >
                  <Plus size={12} />
                  Publier
                </button>
              )}
            </div>

            {loadingNews ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                    <div className="h-3 bg-slate-100 rounded w-1/3 mb-2" />
                    <div className="h-4 bg-slate-100 rounded w-3/4 mb-1" />
                    <div className="h-3 bg-slate-100 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : news.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <Newspaper size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">Aucune actualité publiée</p>
                {canDo(userRole, 'publish_news') && (
                  <p className="text-xs text-slate-300 mt-1">Publiez la première actualité de votre commune</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {news.map(item => {
                  const style = NEWS_CATEGORY_STYLE[item.category]
                  return (
                    <div key={item.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                        <span className="text-xs text-slate-400 ml-auto">
                          {new Date(item.published_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-800 text-sm leading-snug mb-1">{item.title}</h3>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{item.content}</p>
                      {item.author_name && (
                        <p className="text-xs text-slate-400 mt-2">— {item.author_name}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {showNewsForm && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-end p-4">
                <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-sm">Publier une actualité</h3>
                    <button onClick={() => setShowNewsForm(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <X size={15} className="text-slate-500" />
                    </button>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Catégorie</label>
                      <div className="flex gap-2 flex-wrap">
                        {(Object.entries(NEWS_CATEGORY_STYLE) as [CommuneNews['category'], { label: string; bg: string; text: string }][]).map(([k, v]) => (
                          <button
                            key={k}
                            onClick={() => setNewsCategory(k)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${newsCategory === k ? `${v.bg} ${v.text} border-current` : 'border-slate-200 text-slate-500 bg-white'
                              }`}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Titre</label>
                      <input
                        type="text"
                        value={newsTitle}
                        onChange={e => setNewsTitle(e.target.value)}
                        placeholder="Titre de l'actualité"
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Contenu</label>
                      <textarea
                        value={newsContent}
                        onChange={e => setNewsContent(e.target.value)}
                        placeholder="Rédigez votre actualité..."
                        rows={4}
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                      />
                    </div>
                  </div>
                  <div className="px-5 pb-5 flex gap-3">
                    <button onClick={() => setShowNewsForm(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">Annuler</button>
                    <button
                      onClick={handlePublishNews}
                      disabled={!newsTitle.trim() || !newsContent.trim() || submittingNews}
                      className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      {submittingNews
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : 'Publier'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Agenda ── */}
        {tab === 'agenda' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-700">Agenda de {commune.name}</h2>
              {canDo(userRole, 'publish_agenda') && (
                <button
                  onClick={() => setShowEventForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white active:scale-95 transition-all"
                >
                  <Plus size={12} />
                  Ajouter
                </button>
              )}
            </div>

            {loadingEvents ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                    <div className="h-8 bg-slate-100 rounded w-1/4 mb-3" />
                    <div className="h-4 bg-slate-100 rounded w-2/3 mb-1" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <Info size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">Aucun événement à venir</p>
                {canDo(userRole, 'publish_agenda') && (
                  <p className="text-xs text-slate-300 mt-1">Ajoutez le premier événement de votre commune</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {events.map(ev => {
                  const style = EVENT_CATEGORY_STYLE[ev.category]
                  const d = new Date(ev.event_date)
                  const dayStr = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
                  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={ev.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex gap-4">
                      <div className="flex-shrink-0 text-center w-14">
                        <p className="text-2xl font-black text-indigo-600 leading-none">{d.getDate()}</p>
                        <p className="text-xs text-slate-400 font-medium uppercase">
                          {d.toLocaleDateString('fr-FR', { month: 'short' })}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm leading-snug">{ev.title}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {dayStr} · {timeStr}
                          {ev.location && ` · ${ev.location}`}
                        </p>
                        {ev.description && (
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{ev.description}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {showEventForm && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-end p-4">
                <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
                    <h3 className="font-bold text-slate-800 text-sm">Ajouter un événement</h3>
                    <button onClick={() => setShowEventForm(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <X size={15} className="text-slate-500" />
                    </button>
                  </div>
                  <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Catégorie</label>
                      <div className="flex gap-2 flex-wrap">
                        {(Object.entries(EVENT_CATEGORY_STYLE) as [CommuneEvent['category'], { label: string; bg: string; text: string }][]).map(([k, v]) => (
                          <button
                            key={k}
                            onClick={() => setEvCategory(k)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${evCategory === k ? `${v.bg} ${v.text} border-current` : 'border-slate-200 text-slate-500 bg-white'
                              }`}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Titre *</label>
                      <input type="text" value={evTitle} onChange={e => setEvTitle(e.target.value)} placeholder="Titre de l'événement"
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date de début *</label>
                        <input type="datetime-local" value={evDate} onChange={e => setEvDate(e.target.value)}
                          className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 [color-scheme:light]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date de fin</label>
                        <input type="datetime-local" value={evEndDate} onChange={e => setEvEndDate(e.target.value)}
                          className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 [color-scheme:light]" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Lieu</label>
                      <input type="text" value={evLocation} onChange={e => setEvLocation(e.target.value)} placeholder="Salle des fêtes, mairie…"
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
                      <textarea value={evDesc} onChange={e => setEvDesc(e.target.value)} rows={3} placeholder="Décrivez l'événement…"
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                    </div>
                  </div>
                  <div className="px-5 pb-5 flex gap-3 flex-shrink-0">
                    <button onClick={() => setShowEventForm(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">Annuler</button>
                    <button
                      onClick={handlePublishEvent}
                      disabled={!evTitle.trim() || !evDate || submittingEvent}
                      className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      {submittingEvent
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : 'Ajouter'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {agoraProposal && !votingProposal && (
        <AgoraModal
          proposal={agoraProposal}
          onVote={() => setVotingProposal(agoraProposal)}
          onClose={() => setAgoraProposal(null)}
          hasVoted={agoraProposal.id in votedChoices}
          userHash={userHash}
          targetType="proposal"
        />
      )}
      {votingProposal && (
        <VotingBooth
          proposal={votingProposal}
          onVoted={(choice) => handleVoted(votingProposal.id, choice, votedChoices[votingProposal.id])}
          onClose={() => setVotingProposal(null)}
        />
      )}
      {resultsProposalId && (
        <ResultsModal
          proposalId={resultsProposalId}
          onClose={() => setResultsProposalId(null)}
        />
      )}
    </div>
  )
}
