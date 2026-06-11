import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { showToast } from '../lib/toast'
import type { Organisation, Proposal, Stage, OrgProposal, OrgComment } from '../types'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { PROPOSALS, STAGE_CONFIG } from '../lib/constants'

export default function OrgDashboard({ org, onBack }: { org: Organisation; onBack: () => void }) {
    const [followerCount, setFollowerCount] = useState<number | null>(null)
    const [proposals, setProposals] = useState<OrgProposal[]>([])
    const [nationalLaws, setNationalLaws] = useState<Proposal[]>([])
    const [comments, setComments] = useState<Record<string, OrgComment[]>>({})
    const [loadingStats, setLoadingStats] = useState(true)

    const [showPropForm, setShowPropForm] = useState(false)
    const [propTitle, setPropTitle] = useState('')
    const [propDescription, setPropDescription] = useState('')
    const [submittingProp, setSubmittingProp] = useState(false)

    const [commentingLawId, setCommentingLawId] = useState<string | null>(null)
    const [commentText, setCommentText] = useState('')
    const [submittingComment, setSubmittingComment] = useState(false)

    useEffect(() => {
        let cancelled = false
        async function fetchData() {
            try {
                const [followersRes, proposalsRes, lawsRes] = await Promise.all([
                    supabase.from('citizen_organisations').select('id', { count: 'exact', head: true }).eq('organisation_id', org.id),
                    supabase.from('proposals').select('id,title,status,votes_pour,votes_contre,votes_blanc,created_at').eq('author', org.name),
                    supabase.from('parliamentary_laws').select('id,number,title,description,category,stage,parliament_vote_date,votes_pour,votes_contre,votes_blanc,tags,official_url').eq('stage', 'voting'),
                ])
                if (!cancelled) {
                    if (followersRes.count !== null) setFollowerCount(followersRes.count)
                    if (proposalsRes.data) setProposals(proposalsRes.data as OrgProposal[])
                    if (lawsRes.data && lawsRes.data.length > 0) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        setNationalLaws((lawsRes.data as any[]).map(row => ({
                            id: row.id,
                            title: row.title,
                            description: row.description,
                            category: row.category,
                            stage: row.stage as Stage,
                            votes: { pour: row.votes_pour ?? 0, contre: row.votes_contre ?? 0, blanc: row.votes_blanc ?? 0 },
                            signatures: 0,
                            targetSignatures: 10000,
                            arguments: [],
                            author: 'Assemblée Nationale',
                            date: row.parliament_vote_date,
                            tags: row.tags ?? [],
                        })))
                    } else {
                        setNationalLaws(PROPOSALS.filter(p => p.stage === 'voting'))
                    }
                    const lawIds = (lawsRes.data ?? []).map((l: { id: string }) => l.id)
                    if (lawIds.length > 0) {
                        const { data: commentsData } = await supabase
                            .from('comments')
                            .select('id,proposal_id,content,created_at')
                            .eq('organisation_id', org.id)
                            .in('proposal_id', lawIds)
                        if (!cancelled && commentsData) {
                            const grouped: Record<string, OrgComment[]> = {}
                            for (const c of commentsData as OrgComment[]) {
                                if (!grouped[c.proposal_id]) grouped[c.proposal_id] = []
                                grouped[c.proposal_id].push(c)
                            }
                            setComments(grouped)
                        }
                    }
                }
            } catch {
                if (!cancelled) showToast('Une erreur est survenue. Réessayez.')
            } finally {
                if (!cancelled) setLoadingStats(false)
            }
        }
        fetchData()
        return () => { cancelled = true }
    }, [org.id, org.name])

    const totalVotes = proposals.reduce(
        (sum, p) => sum + (p.votes_pour ?? 0) + (p.votes_contre ?? 0) + (p.votes_blanc ?? 0), 0
    )
    const engagementRate = followerCount && followerCount > 0
        ? Math.min(Math.round((totalVotes / followerCount) * 100), 100)
        : 0

    const headerColor = org.type === 'ong' ? '#854f0b' : '#334155'
    const accentClass = org.type === 'ong' ? 'text-amber-200' : 'text-slate-300'
    const typeLabel = org.type === 'ong' ? 'ONG / Association' : 'Média'
    const typeBadge = org.type === 'ong' ? 'bg-amber-900/50 text-amber-200' : 'bg-slate-600/50 text-slate-300'

    async function handleSubmitProposal() {
        if (!propTitle.trim()) return
        setSubmittingProp(true)
        try {
            const { data, error } = await supabase.from('proposals').insert({
                title: propTitle,
                description: propDescription,
                status: 'seedling',
                author: org.name,
                category: org.type === 'ong' ? 'Social' : 'Numérique',
            }).select().single()
            if (error) throw error
            setProposals(prev => [data as OrgProposal, ...prev])
            setShowPropForm(false)
            setPropTitle(''); setPropDescription('')
        } catch {
            showToast('Une erreur est survenue. Réessayez.')
        }
        setSubmittingProp(false)
    }

    async function handleSubmitComment(lawId: string) {
        if (!commentText.trim()) return
        setSubmittingComment(true)
        try {
            const { data, error } = await supabase.from('comments').insert({
                proposal_id: lawId,
                organisation_id: org.id,
                content: commentText,
            }).select().single()
            if (error) throw error
            setComments(prev => ({ ...prev, [lawId]: [...(prev[lawId] ?? []), data as OrgComment] }))
            setCommentingLawId(null)
            setCommentText('')
        } catch {
            showToast('Une erreur est survenue. Réessayez.')
        }
        setSubmittingComment(false)
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div style={{ backgroundColor: headerColor }} className="px-5 pt-10 pb-6 text-white">
                <button onClick={onBack} className={`flex items-center gap-1.5 ${accentClass} text-xs font-medium mb-5 hover:text-white transition-colors`}>
                    <ArrowLeft size={14} />
                    Retour à Mon Compte
                </button>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <span className={`inline-block text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2 ${typeBadge}`}>
                            {typeLabel}
                        </span>
                        <h1 className="text-xl font-black leading-tight">{org.name}</h1>
                        {org.description && (
                            <p className={`text-xs mt-1 ${accentClass} line-clamp-2`}>{org.description}</p>
                        )}
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="text-2xl font-black">{loadingStats ? '—' : (followerCount ?? 0).toLocaleString('fr-FR')}</p>
                        <p className={`text-xs ${accentClass}`}>abonnés</p>
                    </div>
                </div>
            </div>

            {/* Stat cards & other UI */}
            <div className="px-4 pt-4">
                <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                        { label: 'Abonnés', value: loadingStats ? '—' : (followerCount ?? 0).toLocaleString('fr-FR'), sub: 'citoyens abonnés' },
                        { label: 'Propositions', value: loadingStats ? '—' : proposals.length.toString(), sub: 'publiées' },
                        { label: 'Votes reçus', value: loadingStats ? '—' : totalVotes.toLocaleString('fr-FR'), sub: 'sur vos propositions' },
                        { label: 'Engagement', value: loadingStats ? '—' : `${engagementRate}%`, sub: 'votes / abonnés' },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                            <p className="text-xs text-slate-500 leading-snug mb-1">{stat.label}</p>
                            <p className="text-2xl font-black text-slate-800">{stat.value}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{stat.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Proposals */}
                <div className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mes propositions</h2>
                        <button
                            onClick={() => setShowPropForm(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white active:scale-95 transition-all"
                            style={{ backgroundColor: headerColor }}
                        >
                            <Plus size={12} />
                            Soumettre
                        </button>
                    </div>

                    {loadingStats ? (
                        <div className="space-y-3">
                            {[1, 2].map(i => (
                                <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 animate-pulse">
                                    <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                                    <div className="h-2 bg-slate-100 rounded w-full" />
                                </div>
                            ))}
                        </div>
                    ) : proposals.length === 0 ? (
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center">
                            <p className="text-sm text-slate-400 mb-1">Aucune proposition soumise</p>
                            <p className="text-xs text-slate-300">Soumettez votre première proposition citoyenne</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {proposals.map(p => {
                                const total = (p.votes_pour ?? 0) + (p.votes_contre ?? 0) + (p.votes_blanc ?? 0)
                                const pourPct = total > 0 ? Math.round((p.votes_pour / total) * 100) : 0
                                const contrePct = total > 0 ? Math.round((p.votes_contre / total) * 100) : 0
                                const blancPct = 100 - pourPct - contrePct
                                const s = STAGE_CONFIG[p.status as Stage] ?? { label: p.status, color: 'bg-slate-100 text-slate-600' }
                                return (
                                    <div key={p.id} className="bg-white rounded-2xl p-4 border border-slate-100">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <p className="text-sm font-semibold text-slate-800 flex-1 leading-snug">{p.title}</p>
                                            <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${s.color}`}>
                                                {s.label}
                                            </span>
                                        </div>
                                        {total > 0 ? (
                                            <>
                                                <div className="flex h-1.5 rounded-full overflow-hidden mb-1">
                                                    <div className="bg-green-500 transition-all" style={{ width: `${pourPct}%` }} />
                                                    <div className="bg-red-400 transition-all" style={{ width: `${contrePct}%` }} />
                                                    <div className="bg-slate-200 transition-all" style={{ width: `${blancPct}%` }} />
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-green-600 font-medium">Pour {pourPct}%</span>
                                                    <span className="text-slate-400">{total.toLocaleString('fr-FR')} votes</span>
                                                    <span className="text-red-500 font-medium">Contre {contrePct}%</span>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-xs text-slate-300">{p.created_at?.slice(0, 10)} · Aucun vote</p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Comment on national laws */}
                <div className="mb-8">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Commenter une loi en cours</h2>

                    {loadingStats ? (
                        <div className="space-y-3">
                            {[1, 2].map(i => (
                                <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 animate-pulse">
                                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                                </div>
                            ))}
                        </div>
                    ) : nationalLaws.length === 0 ? (
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center">
                            <p className="text-sm text-slate-400">Aucune loi en vote actuellement</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {nationalLaws.map(law => {
                                const lawComments = comments[law.id] ?? []
                                const isCommenting = commentingLawId === law.id
                                return (
                                    <div key={law.id} className="bg-white rounded-2xl p-4 border border-slate-100">
                                        <p className="text-sm font-semibold text-slate-800 mb-2 leading-snug">{law.title}</p>
                                        {lawComments.length > 0 && (
                                            <div className="space-y-2 mb-3">
                                                {lawComments.map(c => (
                                                    <div key={c.id} className="bg-slate-50 rounded-xl px-3 py-2">
                                                        <p className="text-xs text-slate-600 leading-relaxed">{c.content}</p>
                                                        <p className="text-xs text-slate-300 mt-1">{c.created_at?.slice(0, 10)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {isCommenting ? (
                                            <div className="space-y-2">
                                                <textarea value={commentText} onChange={e => setCommentText(e.target.value.slice(0, 500))} placeholder="Votre commentaire (500 caractères max)..." rows={3} className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300 resize-none" autoFocus />
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-slate-300">{commentText.length}/500</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => { setCommentingLawId(null); setCommentText('') }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 bg-slate-100">Annuler</button>
                                                        <button onClick={() => handleSubmitComment(law.id)} disabled={!commentText.trim() || submittingComment} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 flex items-center gap-1 active:scale-95 transition-all" style={{ backgroundColor: headerColor }}>{submittingComment ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : 'Publier'}</button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <button onClick={() => { setCommentingLawId(law.id); setCommentText('') }} className="flex items-center gap-1.5 text-xs font-semibold mt-1 transition-colors hover:opacity-70" style={{ color: headerColor }}><Plus size={12} />Ajouter un commentaire</button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Submit proposal modal */}
            {showPropForm && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end p-4">
                    <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800 text-sm">Soumettre une proposition</h3>
                            <button onClick={() => setShowPropForm(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                <X size={15} className="text-slate-500" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Titre</label>
                                <input
                                    type="text"
                                    value={propTitle}
                                    onChange={e => setPropTitle(e.target.value)}
                                    placeholder="Titre de votre proposition"
                                    className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
                                <textarea
                                    value={propDescription}
                                    onChange={e => setPropDescription(e.target.value)}
                                    placeholder="Décrivez votre proposition..."
                                    rows={4}
                                    className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300 resize-none"
                                />
                            </div>
                        </div>
                        <div className="px-5 pb-5 flex gap-3">
                            <button onClick={() => setShowPropForm(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">Annuler</button>
                            <button onClick={handleSubmitProposal} disabled={!propTitle.trim() || submittingProp} className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-all" style={{ backgroundColor: headerColor }}>
                                {submittingProp ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Soumettre'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
