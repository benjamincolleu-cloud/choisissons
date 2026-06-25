import { useState, useCallback, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import { fetchDossiersLegislatifs } from '../lib/assemblee'
import { Landmark, X } from 'lucide-react'

import type { Proposal, VoteChoice, Stage, ParliamentaryLaw, ProposalRow } from '../types'
import { PROPOSALS, PARLIAMENTARY_LAWS_INITIAL } from '../lib/constants'
import { mapRowToProposal, parseFrDate, isCitizenVoteClosedFn, citizenDeadlineMs, lawToProposal } from '../lib/utils'
import { showToast } from '../lib/toast'
import { loadPendingVotes, savePendingVotes } from '../lib/votes'
import { generateVoteProof } from '../lib/identity'

import ProposalCard from '../components/proposals/ProposalCard'
import LawCard from '../components/proposals/LawCard'

// Modals
import AgoraModal from '../components/modals/AgoraModal'
import VotingBooth from '../components/modals/VotingBooth'
import ResultsModal from '../components/modals/ResultsModal'

interface HomePageProps {
    initialCategory?: string
    onNavigateSupport?: () => void
    onNavigateLibrary?: () => void
}

export default function HomePage({ initialCategory, onNavigateSupport, onNavigateLibrary }: HomePageProps) {
    const { userHash } = useAuth()
    const [activeTab, setActiveTab] = useState<'lois' | 'propositions'>(
        initialCategory ? 'propositions' : 'lois'
    )

    const [proposals, setProposals] = useState<Proposal[]>(PROPOSALS)
    const [loading, setLoading] = useState(true)
    const [activeStage, setActiveStage] = useState<Stage | 'all'>('all')
    const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory ?? null)
    const [agoraProposal, setAgoraProposal] = useState<Proposal | null>(null)
    const [votingProposal, setVotingProposal] = useState<Proposal | null>(null)
    const [votedChoices, setVotedChoices] = useState<Record<string, VoteChoice>>({})
    const [resultsProposalId, setResultsProposalId] = useState<string | null>(null)
    const [resultsProposalTitle, setResultsProposalTitle] = useState<string>('')
    const [resultsLaw, setResultsLaw] = useState<{ id: string; title: string } | null>(null)

    const previewResults = useMemo(
        () => new URLSearchParams(window.location.search).has('preview_results'),
        [],
    )
    const [lawTab, setLawTab] = useState<'upcoming' | 'voter' | 'resultats'>(
        previewResults ? 'resultats' : 'voter'
    )
    const [laws, setLaws] = useState<ParliamentaryLaw[]>(PARLIAMENTARY_LAWS_INITIAL)
    const [lawVotedIds, setLawVotedIds] = useState<Set<string>>(() => {
        try {
            const raw = localStorage.getItem('law_voted_ids')
            return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
        } catch { return new Set() }
    })
    const [agoraLaw, setAgoraLaw] = useState<Proposal | null>(null)
    const [votingLaw, setVotingLaw] = useState<Proposal | null>(null)
    const [votedIds, setVotedIds] = useState<Set<string>>(new Set())

    // Retourne l'identifiant utilisé dans registre_scrutin pour une loi donnée
    // (même logique que dans handleLawVoted)
    function getLawAnId(law: ParliamentaryLaw): string {
        const l = law as ParliamentaryLaw & { uid?: string; reference?: string }
        return l.uid ?? l.reference ?? law.number ?? law.id
    }

    useEffect(() => {
        let cancelled = false
        fetchDossiersLegislatifs().then(anLaws => {
            if (!cancelled && anLaws.length > 0) {
                setLaws(anLaws as ParliamentaryLaw[])
            }
        })
        return () => { cancelled = true }
    }, [])

    useEffect(() => {
        let cancelled = false
        async function fetchProposals() {
            try {
                const { data, error } = await supabase
                    .from('proposals')
                    .select('id,title,description,category,status,supports,votes_pour,votes_contre,votes_blanc,tags,created_at,blockchain_proof')
                    .order('created_at', { ascending: false })
                    .limit(100)
                if (error) throw error
                if (!cancelled && data && data.length > 0) {
                    setProposals((data as ProposalRow[]).map(mapRowToProposal))
                }
            } catch {
                showToast('Impossible de charger les propositions. Vérifiez votre connexion.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        fetchProposals()
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

    // Vérifie dans registre_scrutin quelles lois l'utilisateur a déjà votées
    useEffect(() => {
        if (!userHash || laws.length === 0) return
        let cancelled = false

        // Map anId → law.id pour le recroisement après la query
        const anIdToLawId: Record<string, string> = {}
        for (const law of laws) {
            anIdToLawId[getLawAnId(law)] = law.id
        }
        const anIds = Object.keys(anIdToLawId)

        supabase
            .from('registre_scrutin')
            .select('proposal_id')
            .in('proposal_id', anIds)
            .eq('user_hash', userHash)
            .then(({ data }) => {
                if (cancelled || !data || data.length === 0) return
                const voted = (data as { proposal_id: string }[])
                    .map(r => anIdToLawId[r.proposal_id])
                    .filter(Boolean)
                if (voted.length > 0) {
                    setLawVotedIds(prev => new Set([...prev, ...voted]))
                }
            })

        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userHash, laws.length])

    const filtered = useMemo(() =>
        proposals.filter(p => {
            const stageOk = activeStage === 'all' || p.stage === activeStage
            const categoryOk = !activeCategory || p.category === activeCategory
            return stageOk && categoryOk
        }),
        [proposals, activeStage, activeCategory])

    const handleVoted = useCallback(async (proposalId: string, choice: VoteChoice, oldChoice?: VoteChoice, proposalTitle?: string) => {
        const isRevote = oldChoice !== undefined
        setVotingProposal(null)
        setAgoraProposal(null)

        const choiceMap: Record<VoteChoice, string> = {
            pour: 'YES', contre: 'NO', blanc: 'ABSTAIN',
        }
        const mappedChoice = choiceMap[choice]

        setVotedChoices(prev => ({ ...prev, [proposalId]: choice }))
        setProposals(prev =>
            prev.map(p => {
                if (p.id !== proposalId) return p
                const newVotes = { ...p.votes, [choice]: p.votes[choice] + 1 }
                if (isRevote && oldChoice) newVotes[oldChoice] = Math.max(0, newVotes[oldChoice] - 1)
                return { ...p, votes: newVotes }
            })
        )

        const proof = await generateVoteProof(proposalId, mappedChoice)
        const voteParams = {
            p_proposal_id: String(proposalId),
            p_user_hash: userHash,
            p_choice: mappedChoice,
            p_proof_hash: proof,
        }

        try {
            const { error } = await supabase.rpc('deposer_bulletin', voteParams)
            if (error) throw error

            if (isRevote) {
                showToast('Vote mis à jour ✓', 'info')
            } else {
                setResultsProposalTitle(proposalTitle ?? '')
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

    const handleLawVoted = useCallback(async (lawId: string, choice: VoteChoice) => {
        const targetLaw = laws.find(l => l.id === lawId)
        const lawWithExtras = targetLaw as (typeof targetLaw & { uid?: string; reference?: string })
        const anId = lawWithExtras?.uid || lawWithExtras?.reference || targetLaw?.number || lawId

        setLawVotedIds(prev => {
            const next = new Set([...prev, lawId])
            try { localStorage.setItem('law_voted_ids', JSON.stringify([...next])) } catch { /* ignore */ }
            return next
        })

        setLaws(prev =>
            prev.map(l =>
                (l.id === lawId || l.number === lawId)
                    ? { ...l, votes: { ...l.votes, [choice]: l.votes[choice] + 1 } }
                    : l
            )
        )

        setVotingLaw(null)
        setAgoraLaw(null)

        const choiceMap: Record<VoteChoice, string> = {
            pour: 'YES', contre: 'NO', blanc: 'ABSTAIN',
        }
        const mappedChoice = choiceMap[choice]

        try {
            const proof = await generateVoteProof(anId, mappedChoice)

            const voteParams = {
                p_proposal_id: String(anId),
                p_user_hash: userHash,
                p_choice: mappedChoice,
                p_proof_hash: proof,
            }

            const { error } = await supabase.rpc('deposer_bulletin', voteParams)

            if (error) {
                showToast('Réseau faible. Vote sauvegardé localement.', 'warning')
                return
            }

            setResultsLaw({ id: lawId, title: targetLaw?.title ?? '' })

        } catch {
            showToast('Erreur de connexion. Vote sauvegardé localement.', 'warning')
        }
    }, [userHash, laws])

    const filters: { value: Stage | 'all'; label: string }[] = [
        { value: 'all', label: 'Toutes' },
        { value: 'seedling', label: 'Pépinière' },
        { value: 'review', label: 'Jury' },
        { value: 'voting', label: 'Vote' },
        { value: 'adopted', label: 'Adoptées' },
    ]

    return (
        <>
            <div className="p-4">
                {/* Header */}
                <div className="mb-4">
                    <h1 className="text-2xl font-black text-slate-800">Démocratie</h1>
                    <p className="text-slate-500 text-sm">Citoyenne, citoyen — votre voix compte.</p>
                </div>

                {/* Bannière textes fondateurs */}
                {onNavigateLibrary && (
                    <button
                        onClick={onNavigateLibrary}
                        className="w-full mb-4 flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-amber-50 border border-indigo-100 rounded-2xl px-4 py-3 text-left hover:shadow-sm transition-all active:scale-[.99]"
                    >
                        <span className="text-xl flex-shrink-0">📜</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-indigo-700">Nouveau — Textes fondateurs</p>
                            <p className="text-xs text-slate-500 truncate">Proposez de moderniser la Constitution et les grandes lois →</p>
                        </div>
                    </button>
                )}

                {/* Main tabs */}
                <div className="flex gap-2 mb-5">
                    <button
                        onClick={() => setActiveTab('lois')}
                        className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'lois'
                            ? 'bg-[#002395] text-white shadow-lg shadow-blue-200'
                            : 'bg-slate-100 text-slate-500'
                            }`}
                    >
                        🏛 Lois en cours
                    </button>
                    <button
                        onClick={() => setActiveTab('propositions')}
                        className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'propositions'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                            : 'bg-slate-100 text-slate-500'
                            }`}
                    >
                        ✊ Propositions citoyennes
                    </button>
                </div>

                {/* ── TAB : Lois en cours ─────────────────────────────── */}
                {activeTab === 'lois' && (() => {
                    const nowMs = previewResults ? Infinity : Date.now()

                    const upcomingLaws = laws
                        .filter(l => l.stage === 'upcoming')
                        .sort((a, b) => parseFrDate(a.parliamentVoteDate) - parseFrDate(b.parliamentVoteDate))

                    const voterLaws = laws
                        .filter(l => l.stage !== 'upcoming' && !isCitizenVoteClosedFn(l, nowMs))
                        .sort((a, b) => citizenDeadlineMs(a) - citizenDeadlineMs(b))

                    const resultatsLaws = laws
                        .filter(l => l.stage !== 'upcoming' && isCitizenVoteClosedFn(l, nowMs))
                        .sort((a, b) => parseFrDate(b.parliamentVoteDate) - parseFrDate(a.parliamentVoteDate))

                    const tabs = [
                        { key: 'upcoming' as const, label: `🗓️ À venir`, count: upcomingLaws.length },
                        { key: 'voter' as const, label: `🗳️ À voter`, count: voterLaws.length },
                        { key: 'resultats' as const, label: `📊 Résultats`, count: resultatsLaws.length },
                    ]

                    const activeLaws =
                        lawTab === 'upcoming' ? upcomingLaws :
                            lawTab === 'voter' ? voterLaws :
                                resultatsLaws

                    return (
                        <>
                            <div className="bg-[#002395] rounded-2xl p-4 mb-4 text-white">
                                <div className="flex items-start gap-3">
                                    <Landmark size={20} className="text-blue-200 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-sm mb-0.5">Lois parlementaires — exprimez votre avis citoyen.</p>
                                        <p className="text-blue-200 text-xs leading-relaxed">Les résultats de l'Assemblée sont révélés à la clôture du vote citoyen.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-1.5 mb-4">
                                {tabs.map(t => (
                                    <button
                                        key={t.key}
                                        onClick={() => setLawTab(t.key)}
                                        className={`flex-1 py-2 rounded-xl font-semibold text-xs transition-all ${lawTab === t.key
                                            ? 'bg-[#002395] text-white shadow-md shadow-blue-200'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                            }`}
                                    >
                                        {t.label}
                                        <span className={`ml-1 font-normal ${lawTab === t.key ? 'text-blue-200' : 'text-slate-400'}`}>
                                            ({t.count})
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {lawTab === 'upcoming' && activeLaws.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
                                    <span className="text-xl flex-shrink-0 mt-0.5">🗳️</span>
                                    <div>
                                        <p className="font-bold text-amber-800 text-sm mb-0.5">Donnez votre avis avant les députés</p>
                                        <p className="text-amber-700 text-xs leading-relaxed">Ces textes n'ont pas encore été votés à l'Assemblée. C'est ici que votre voix pèse le plus.</p>
                                    </div>
                                </div>
                            )}

                            {activeLaws.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-8">Aucune loi dans cette catégorie.</p>
                            ) : (
                                <div className="space-y-4">
                                    {activeLaws.map(law => (
                                        <LawCard
                                            key={law.id}
                                            law={law}
                                            onOpen={() => setAgoraLaw(lawToProposal(law))}
                                            showAnBadge={lawTab === 'voter'}
                                            forceClose={previewResults}
                                            hasVoted={lawVotedIds.has(law.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )
                })()}

                {/* ── TAB : Propositions citoyennes ───────────────────── */}
                {activeTab === 'propositions' && (
                    <>
                        <div className="bg-indigo-600 rounded-2xl p-4 mb-5 text-white">
                            <div className="flex justify-around">
                                {[
                                    { value: proposals.length, label: 'propositions' },
                                    { value: proposals.filter(p => p.stage === 'voting').length, label: 'en vote' },
                                    { value: proposals.filter(p => p.stage === 'adopted').length, label: 'adoptées' },
                                ].map(({ value, label }) => (
                                    <div key={label} className="text-center">
                                        <div className="text-2xl font-black">{value}</div>
                                        <div className="text-indigo-200 text-xs">{label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {activeCategory && (
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs text-slate-500">Catégorie :</span>
                                <span className="flex items-center gap-1.5 bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                                    {activeCategory}
                                    <button onClick={() => setActiveCategory(null)} className="hover:text-indigo-900">
                                        <X size={11} />
                                    </button>
                                </span>
                            </div>
                        )}

                        <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: 'none' }}>
                            {filters.map(f => (
                                <button
                                    key={f.value}
                                    onClick={() => setActiveStage(f.value)}
                                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${activeStage === f.value
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 text-slate-600'
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 animate-pulse">
                                        <div className="flex gap-2">
                                            <div className="h-5 w-20 bg-slate-100 rounded-full" />
                                            <div className="h-5 w-16 bg-slate-100 rounded-full ml-auto" />
                                        </div>
                                        <div className="h-4 bg-slate-100 rounded-lg w-3/4" />
                                        <div className="h-3 bg-slate-100 rounded-lg w-full" />
                                        <div className="h-3 bg-slate-100 rounded-lg w-2/3" />
                                        <div className="h-9 bg-slate-100 rounded-xl mt-2" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {filtered.map(proposal => (
                                    <ProposalCard
                                        key={proposal.id}
                                        proposal={proposal}
                                        onOpen={() => setAgoraProposal(proposal)}
                                        currentVote={votedChoices[proposal.id]}
                                        hasAlreadyVoted={votedIds.has(proposal.id)}
                                        onRevote={() => setVotingProposal(proposal)}
                                    />
                                ))}
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
                    onNavigateSupport={onNavigateSupport}
                />
            )}
            {votingProposal && (
                <VotingBooth
                    proposal={votingProposal}
                    onVoted={(choice) => handleVoted(votingProposal.id, choice, votedChoices[votingProposal.id], votingProposal.title)}
                    onClose={() => setVotingProposal(null)}
                />
            )}

            {agoraLaw && !votingLaw && (
                <AgoraModal
                    proposal={agoraLaw}
                    onVote={() => setVotingLaw(agoraLaw)}
                    onClose={() => setAgoraLaw(null)}
                    hasVoted={lawVotedIds.has(agoraLaw.id)}
                    userHash={userHash}
                    targetType="law"
                    onNavigateSupport={onNavigateSupport}
                />
            )}
            {votingLaw && (
                <VotingBooth
                    proposal={votingLaw}
                    onVoted={(choice, hash) => { void hash; handleLawVoted(votingLaw.id, choice) }}
                    onClose={() => setVotingLaw(null)}
                />
            )}

            {resultsProposalId && (
                <ResultsModal
                    proposalId={resultsProposalId}
                    title={resultsProposalTitle}
                    onClose={() => setResultsProposalId(null)}
                />
            )}
            {resultsLaw && (
                <ResultsModal
                    proposalId={resultsLaw.id}
                    targetType="law"
                    title={resultsLaw.title}
                    onClose={() => setResultsLaw(null)}
                />
            )}
        </>
    )
}