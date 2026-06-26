import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { X, ArrowUpDown, Building2, ChevronRight, Users, Landmark, Newspaper } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { showToast } from '../lib/toast'
import { generateVoteProof } from '../lib/identity'
import { loadPendingVotes, savePendingVotes } from '../lib/votes'
import { mapRowToProposal } from '../lib/utils'
import { PROPOSALS, MOCK_ORGANISATIONS } from '../lib/constants'
import type { Proposal, VoteChoice, Stage, Organisation, ProposalRow } from '../types'
import ProposalCard from '../components/proposals/ProposalCard'
import AgoraModal from '../components/modals/AgoraModal'
import VotingBooth from '../components/modals/VotingBooth'
import ResultsModal from '../components/modals/ResultsModal'

export default function ExplorePage({ onNavigateCommuneRegister, onNavigateAssocRegister }: {
  onSelectCategory?: (cat: string) => void
  onNavigateCommuneRegister: () => void
  onNavigateAssocRegister: () => void
}) {
  const { userHash } = useAuth()
  const [exploreTab, setExploreTab] = useState<'discover' | 'organisations'>('discover')

  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<Stage | null>('voting')
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent')
  const [loadingData, setLoadingData] = useState(true)
  const [allProposals, setAllProposals] = useState<Proposal[]>(PROPOSALS)

  const [agoraProposal, setAgoraProposal] = useState<Proposal | null>(null)
  const [votingProposal, setVotingProposal] = useState<Proposal | null>(null)
  const [votedChoices, setVotedChoices] = useState<Record<string, VoteChoice>>({})
  const [resultsProposalId, setResultsProposalId] = useState<string | null>(null)
  const [resultsAlreadyVoted, setResultsAlreadyVoted] = useState(false)
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())

  const [orgSubTab, setOrgSubTab] = useState<'commune' | 'ong' | 'media'>('commune')
  const [organisations, setOrganisations] = useState<Organisation[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [followedOrgIds, setFollowedOrgIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function fetchExploreData() {
      try {
        const { data, error } = await supabase
          .from('proposals')
          .select('id,title,description,category,status,supports,votes_pour,votes_contre,votes_blanc,tags,created_at,blockchain_proof')
          .order('created_at', { ascending: false })
          .limit(100)
        if (error) throw error
        if (!cancelled && data && data.length > 0) {
          setAllProposals((data as ProposalRow[]).map(mapRowToProposal))
        }
      } catch {
        // keep PROPOSALS fallback
      } finally {
        if (!cancelled) setLoadingData(false)
      }
    }
    fetchExploreData()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!userHash) return
    let cancelled = false
    supabase.rpc('get_my_votes', { p_user_hash: userHash }).then(({ data }) => {
      if (!cancelled && data) {
        setVotedIds(new Set((data as { proposal_id: string | number }[]).map(r => String(r.proposal_id))))
      }
    })
    return () => { cancelled = true }
  }, [userHash])

  useEffect(() => {
    if (exploreTab !== 'organisations') return
    let cancelled = false
    async function fetchOrgs() {
      setLoadingOrgs(true)
      try {
        const [orgsRes, followsRes] = await Promise.all([
          supabase.from('organisations').select('id,name,type,description,population').eq('type', orgSubTab),
          supabase.from('citizen_organisations').select('organisation_id').eq('user_hash', userHash),
        ])
        if (orgsRes.error) throw orgsRes.error
        if (!cancelled) {
          if (orgsRes.data && orgsRes.data.length > 0) {
            setOrganisations(orgsRes.data as Organisation[])
          } else {
            setOrganisations(MOCK_ORGANISATIONS.filter(o => o.type === orgSubTab))
          }
          if (followsRes.data) {
            setFollowedOrgIds(new Set(followsRes.data.map((r: { organisation_id: string }) => r.organisation_id)))
          }
        }
      } catch {
        if (!cancelled) showToast('Une erreur est survenue. Réessayez.')
      } finally {
        if (!cancelled) setLoadingOrgs(false)
      }
    }
    fetchOrgs()
    return () => { cancelled = true }
  }, [exploreTab, orgSubTab, userHash])

  async function handleFollowOrg(orgId: string) {
    setFollowedOrgIds(prev => {
      const next = new Set(prev)
      next.add(orgId)
      return next
    })
    try {
      const { error } = await supabase.from('citizen_organisations').insert({
        user_hash: userHash,
        organisation_id: orgId,
      })
      if (error) throw error
    } catch {
      showToast('Une erreur est survenue. Réessayez.')
    }
  }

  async function handleVoted(proposalId: string, choice: VoteChoice) {
    setVotingProposal(null)
    setAgoraProposal(null)

    const choiceMap: Record<VoteChoice, string> = { pour: 'YES', contre: 'NO', blanc: 'ABSTAIN' }
    const mappedChoice = choiceMap[choice]

    setVotedChoices(prev => ({ ...prev, [proposalId]: choice }))
    setAllProposals(prev => prev.map(p =>
      p.id !== proposalId ? p : { ...p, votes: { ...p.votes, [choice]: p.votes[choice] + 1 } }
    ))

    const proof = await generateVoteProof(proposalId, mappedChoice)
    try {
      const { data, error } = await supabase.rpc('deposer_bulletin', {
        p_proposal_id: String(proposalId),
        p_user_hash: userHash,
        p_choice: mappedChoice,
        p_proof_hash: proof,
      })
      if (error) throw new Error('DB Error')
      const result = (data ?? {}) as { success?: boolean; already_voted?: boolean }
      if (result.already_voted) {
        setAllProposals(prev => prev.map(p =>
          p.id !== proposalId ? p : { ...p, votes: { ...p.votes, [choice]: Math.max(0, p.votes[choice] - 1) } }
        ))
      }
      setResultsAlreadyVoted(result.already_voted ?? false)
      setResultsProposalId(proposalId)
    } catch {
      const pending = loadPendingVotes()
      if (!pending.some(v => v.proposalId === proposalId)) {
        savePendingVotes([...pending, { proposalId, userHash, choice: mappedChoice, timestamp: Date.now() }])
      }
      showToast('Réseau faible. Vote sauvegardé et synchronisé à la prochaine connexion.', 'warning')
    }
  }

  const EXPLORE_CATEGORIES = ['Toutes', 'Économie', 'Social', 'Numérique', 'Institutions', 'Environnement', 'Justice']

  const STATUS_TABS: { key: Stage; label: string }[] = [
    { key: 'voting', label: 'En vote' },
    { key: 'review', label: 'En examen' },
    { key: 'adopted', label: 'Adoptées' },
  ]

  const filteredProposals = useMemo(() => {
    let list = allProposals
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      )
    }
    if (activeCategory && activeCategory !== 'Toutes') {
      list = list.filter(p => p.category === activeCategory)
    }
    if (activeStatus) {
      list = list.filter(p => p.stage === activeStatus)
    }
    if (sortBy === 'popular') {
      list = [...list].sort(
        (a, b) => (b.votes.pour + b.votes.contre + b.votes.blanc) - (a.votes.pour + a.votes.contre + a.votes.blanc)
      )
    } else {
      list = [...list].sort(
        (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
      )
    }
    return list
  }, [allProposals, query, activeCategory, activeStatus, sortBy])

  const orgSubTabLabel: Record<'commune' | 'ong' | 'media', string> = {
    commune: 'Communes',
    ong: 'ONG',
    media: 'Médias',
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-black text-slate-800">Explorer</h1>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5">
        {(['discover', 'organisations'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setExploreTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${exploreTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
          >
            {tab === 'discover' ? 'Propositions' : 'Organisations'}
          </button>
        ))}
      </div>

      {/* ── Discover tab ── */}
      {exploreTab === 'discover' && (
        <>
          <div className="relative mb-3">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher une proposition…"
              className="w-full bg-slate-100 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300"
            />
            {query.length > 0 && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
            {EXPLORE_CATEGORIES.map(cat => {
              const isActive = cat === 'Toutes' ? !activeCategory || activeCategory === 'Toutes' : activeCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat === 'Toutes' ? null : cat)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 active:scale-95'
                    }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1">
              {STATUS_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveStatus(activeStatus === key ? null : key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeStatus === key
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-500 active:scale-95'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSortBy(s => s === 'recent' ? 'popular' : 'recent')}
              className="flex items-center gap-1 text-xs text-indigo-600 font-semibold whitespace-nowrap"
            >
              <ArrowUpDown size={12} />
              {sortBy === 'recent' ? 'Récentes' : 'Populaires'}
            </button>
          </div>

          {loadingData ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-1/3 mb-3" />
                  <div className="h-5 bg-slate-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-full mb-1" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : filteredProposals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm font-medium">Aucun résultat</p>
              {query && <p className="text-slate-300 text-xs mt-1">pour « {query} »</p>}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProposals.map(proposal => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onOpen={() => setAgoraProposal(proposal)}
                  currentVote={votedChoices[proposal.id]}
                  hasAlreadyVoted={votedIds.has(proposal.id)}
                />
              ))}
            </div>
          )}

          {agoraProposal && !votingProposal && (
            <AgoraModal
              proposal={agoraProposal}
              onVote={() => setVotingProposal(agoraProposal)}
              onClose={() => setAgoraProposal(null)}
              hasVoted={votedIds.has(agoraProposal.id) || agoraProposal.id in votedChoices}
              userHash={userHash}
              targetType="proposal"
            />
          )}
          {votingProposal && (
            <VotingBooth
              proposal={votingProposal}
              onVoted={(choice) => handleVoted(votingProposal.id, choice)}
              onClose={() => setVotingProposal(null)}
            />
          )}
          {resultsProposalId && (
            <ResultsModal
              proposalId={resultsProposalId}
              alreadyVoted={resultsAlreadyVoted}
              onClose={() => { setResultsProposalId(null); setResultsAlreadyVoted(false) }}
            />
          )}
        </>
      )}

      {/* ── Organisations tab ── */}
      {exploreTab === 'organisations' && (
        <>
          <button
            onClick={onNavigateCommuneRegister}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-indigo-600 text-white active:scale-95 transition-all shadow-sm mb-3"
          >
            <div className="flex items-center gap-3">
              <Building2 size={16} className="text-indigo-200 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-semibold leading-tight">Inscrire ma commune</p>
                <p className="text-indigo-200 text-xs mt-0.5">Rejoindre la démocratie directe locale</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-indigo-200 flex-shrink-0" />
          </button>

          <button
            onClick={onNavigateAssocRegister}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-emerald-600 text-white active:scale-95 transition-all shadow-sm mb-4"
          >
            <div className="flex items-center gap-3">
              <Users size={16} className="text-emerald-200 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-semibold leading-tight">Inscrire mon association</p>
                <p className="text-emerald-200 text-xs mt-0.5">Rejoindre le réseau associatif citoyen</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-emerald-200 flex-shrink-0" />
          </button>

          <div className="flex gap-2 mb-4">
            {(['commune', 'ong', 'media'] as const).map(sub => (
              <button
                key={sub}
                onClick={() => setOrgSubTab(sub)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${orgSubTab === sub
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600'
                  }`}
              >
                {orgSubTabLabel[sub]}
              </button>
            ))}
          </div>

          {loadingOrgs ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : organisations.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Aucune organisation dans cette catégorie</p>
          ) : (
            <div className="space-y-3">
              {organisations.map(org => {
                const isFollowed = followedOrgIds.has(org.id)
                return (
                  <div key={org.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      {org.type === 'commune' && <Landmark size={18} className="text-indigo-500" />}
                      {org.type === 'ong' && <Users size={18} className="text-emerald-500" />}
                      {org.type === 'media' && <Newspaper size={18} className="text-amber-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{org.name}</p>
                      {org.population != null && (
                        <p className="text-xs text-slate-400">{org.population.toLocaleString('fr-FR')} habitants</p>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{org.description}</p>
                    </div>
                    <button
                      onClick={() => !isFollowed && handleFollowOrg(org.id)}
                      disabled={isFollowed}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${isFollowed
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-indigo-600 text-white active:scale-95'
                        }`}
                    >
                      {isFollowed ? '✓ Suivi' : 'Suivre'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
