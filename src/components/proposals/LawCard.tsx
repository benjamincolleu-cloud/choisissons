import type { ParliamentaryLaw } from '../../types'
import { parseFrDate, isCitizenVoteClosedFn } from '../../lib/utils'
import { CITIZEN_VOTE_DAYS, MIN_VOTES_FOR_PCT } from '../../lib/constants'
import VoteBar from '../common/VoteBar'
import { Calendar, Lock, Vote, Landmark, ArrowLeft, Info, ChevronRight, CheckCircle } from 'lucide-react'

interface LawCardProps {
    law: ParliamentaryLaw
    onOpen: () => void
    onShowResult?: () => void
    showAnBadge?: boolean
    forceClose?: boolean
    hasVoted?: boolean
}

export default function LawCard({ law, onOpen, onShowResult, forceClose, hasVoted }: LawCardProps) {
    const citizenTotal = law.votes.pour + law.votes.contre + law.votes.blanc
    const assembleeTotal = law.assembleePour + law.assembleeContre + law.assembleeAbstention

    const parliamentMs = parseFrDate(law.parliamentVoteDate)
    const isValidDate = parliamentMs !== Infinity
    const voteDate = isValidDate ? new Date(parliamentMs) : null

    let daysLeft = -1
    if (isValidDate) {
        daysLeft = Math.ceil(
            // eslint-disable-next-line react-hooks/purity
            (parliamentMs + CITIZEN_VOTE_DAYS * 24 * 3600 * 1000 - Date.now()) / (1000 * 3600 * 24)
        )
    }

    const isCitizenVoteClosed = forceClose || isCitizenVoteClosedFn(law)
    const parliamentHasVoted =
        law.stage === 'adopted' || law.stage === 'rejected' || assembleeTotal > 0

    const parliamentLabel = (() => {
        const dateStr = isValidDate ? voteDate!.toLocaleDateString('fr-FR') : law.parliamentVoteDate || ''
        if (law.stage === 'upcoming') return dateStr ? `Séance prévue le ${dateStr}` : 'Date à confirmer'
        if (law.stage === 'rejected') return dateStr ? `Rejetée par l'Assemblée le ${dateStr}` : 'Rejetée par l\'Assemblée'
        if (parliamentHasVoted && dateStr) return `Adoptée par l'Assemblée le ${dateStr}`
        if (parliamentHasVoted) return 'Adoptée par l\'Assemblée'
        return 'En cours de débat au Parlement'
    })()

    const linkLabel = (() => {
        if (parliamentHasVoted) return 'Voir le scrutin'
        if (law.stage === 'upcoming') return 'Voir le dossier'
        return 'Texte officiel'
    })()

    const assembleePourPct = assembleeTotal > 0 ? Math.round((law.assembleePour / assembleeTotal) * 100) : 0
    const assembleeContrePct = assembleeTotal > 0 ? Math.round((law.assembleeContre / assembleeTotal) * 100) : 0
    const assembleeAbstPct = assembleeTotal > 0 ? 100 - assembleePourPct - assembleeContrePct : 0

    const citizenHasEnoughVotes = citizenTotal >= MIN_VOTES_FOR_PCT

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {law.stage === 'upcoming' ? (
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2.5 py-0.5 flex items-center gap-1">
                            <Calendar size={12} /> À venir
                        </span>
                    ) : isCitizenVoteClosed ? (
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-0.5 flex items-center gap-1">
                            <Lock size={12} /> Vote citoyen terminé
                        </span>
                    ) : (
                        <span className="text-xs font-bold text-white bg-[#002395] rounded-full px-2.5 py-0.5 flex items-center gap-1">
                            <Vote size={12} /> Vote citoyen ouvert {daysLeft >= 0 && `(J-${daysLeft})`}
                        </span>
                    )}
                    {hasVoted && (
                        <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                            ✓ Voté
                        </span>
                    )}
                    <span className="text-xs font-semibold text-slate-400">{law.number}</span>
                    <span className="ml-auto text-xs text-slate-400">{law.category}</span>
                </div>

                <h3 className="font-bold text-slate-800 text-base leading-snug mb-1">{law.title}</h3>
                {law.resume && (
                    <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mb-3">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1.5" title="Résumé simplifié, non officiel">En clair —</span>
                        {law.resume}
                    </p>
                )}

                <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Landmark size={12} className="text-slate-400" />
                        <strong className="text-slate-700">{parliamentLabel}</strong>
                    </div>
                    <a
                        href={law.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-xs text-[#002395] font-semibold border border-[#002395]/30 rounded-full px-2 py-0.5 hover:bg-blue-50 transition-colors active:scale-95"
                    >
                        <ArrowLeft size={10} className="rotate-[135deg]" />
                        {linkLabel}
                    </a>
                </div>
                <p className="text-xs text-slate-400 mb-3">Source : Assemblée Nationale officielle</p>

                {isCitizenVoteClosed ? (
                    <div className="flex gap-3 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">🏛️ Assemblée</p>
                            {assembleeTotal > 0 ? (
                                <>
                                    <div className="flex h-1.5 rounded-full overflow-hidden mb-1">
                                        <div className="bg-green-500 transition-all" style={{ width: `${assembleePourPct}%` }} />
                                        <div className="bg-slate-300 transition-all" style={{ width: `${assembleeAbstPct}%` }} />
                                        <div className="bg-red-400 transition-all" style={{ width: `${assembleeContrePct}%` }} />
                                    </div>
                                    <div className="flex flex-col gap-0.5 text-[10px]">
                                        <span className="text-green-600 font-semibold">{assembleePourPct}% pour ({law.assembleePour.toLocaleString('fr-FR')})</span>
                                        <span className="text-red-500 font-semibold">{assembleeContrePct}% contre ({assembleeContrePct.toLocaleString('fr-FR')})</span>
                                        {law.assembleeAbstention > 0 && (
                                            <span className="text-slate-400">{assembleeAbstPct}% abstention ({law.assembleeAbstention.toLocaleString('fr-FR')})</span>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <p className="text-xs text-slate-400">Non communiqué</p>
                            )}
                        </div>
                        <div className="w-px bg-slate-200 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">👥 Citoyens ({citizenTotal.toLocaleString('fr-FR')})</p>
                            {citizenTotal === 0 ? (
                                <p className="text-xs text-slate-400">Aucun vote</p>
                            ) : citizenHasEnoughVotes ? (
                                <VoteBar votes={law.votes} />
                            ) : (
                                <p className="text-xs text-slate-400">{citizenTotal} premier{citizenTotal > 1 ? 's' : ''} avis — résultats à {MIN_VOTES_FOR_PCT} votes</p>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {citizenTotal > 0 && citizenHasEnoughVotes && <VoteBar votes={law.votes} />}
                        {citizenTotal > 0 && (
                            <p className="text-xs text-slate-400 mt-1">
                                {citizenHasEnoughVotes
                                    ? `${citizenTotal.toLocaleString('fr-FR')} avis citoyens`
                                    : `${citizenTotal} premier${citizenTotal > 1 ? 's' : ''} avis — résultats à ${MIN_VOTES_FOR_PCT} votes`}
                            </p>
                        )}
                        <p className="text-xs text-slate-400 mt-2 italic">
                            🏛️ Résultat de l'Assemblée dévoilé à la clôture du vote
                        </p>
                    </>
                )}
            </div>

            <div className="px-4 pb-4">
                {hasVoted && !isCitizenVoteClosed && onShowResult ? (
                    <button
                        onClick={onShowResult}
                        className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                    >
                        <CheckCircle size={15} />
                        Voir le résultat
                        <ChevronRight size={14} />
                    </button>
                ) : (
                    <button
                        onClick={onOpen}
                        className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${isCitizenVoteClosed
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            : 'bg-[#002395] text-white shadow-md shadow-blue-200'
                            }`}
                    >
                        {isCitizenVoteClosed ? <Info size={15} /> : <Vote size={15} />}
                        {isCitizenVoteClosed ? 'Voir les résultats' : 'Lire & Voter'}
                        <ChevronRight size={14} />
                    </button>
                )}
            </div>
        </div>
    )
}