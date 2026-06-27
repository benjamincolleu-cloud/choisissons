import type { Proposal, VoteChoice } from '../../types'
import { VOTE_CHOICE_LABEL, VOTE_CHOICE_BADGE } from '../../lib/constants'
import StageBadge from '../common/StageBadge'
import VoteBar from '../common/VoteBar'
import { Building2, CheckCircle, Info, Lock, Users, Vote, ChevronRight, ExternalLink } from 'lucide-react'

interface ProposalCardProps {
    proposal: Proposal
    onOpen: () => void
    currentVote?: VoteChoice
    hasAlreadyVoted?: boolean
}

export default function ProposalCard({ proposal, onOpen, currentVote, hasAlreadyVoted }: ProposalCardProps) {
    const total = proposal.votes.pour + proposal.votes.contre + proposal.votes.blanc
    const progress = Math.min((proposal.signatures / proposal.targetSignatures) * 100, 100)

    const jurorsValidated = ((parseInt(proposal.id, 10) || proposal.id.charCodeAt(0)) % 61) + 20

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <StageBadge stage={proposal.stage} />
                    <span className="text-xs text-slate-400">{proposal.category}</span>
                </div>
                <h3 className="font-bold text-slate-800 text-base leading-snug mb-1">{proposal.title}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mb-2">{proposal.description}</p>

                {proposal.author && proposal.author !== 'Proposé par la communauté' && (
                    <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 rounded-full px-2.5 py-1 mb-3">
                        <Building2 size={11} />
                        <span className="text-xs font-medium">{proposal.author}</span>
                    </div>
                )}

                {proposal.stage === 'seedling' && (
                    <div className="mb-3">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>{proposal.signatures.toLocaleString('fr-FR')} signatures</span>
                            <span>objectif : {proposal.targetSignatures.toLocaleString('fr-FR')}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-400 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {proposal.stage === 'review' && (
                    <div className="mb-3">
                        <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <Users size={11} className="text-amber-600" />
                            </div>
                            <span className="text-xs font-semibold text-amber-700">En examen par le Jury Citoyen</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Jurés ayant validé : <strong className="text-amber-600">{jurorsValidated}</strong> / 100</span>
                            <span>{jurorsValidated}%</span>
                        </div>
                        <div className="h-1.5 bg-amber-50 rounded-full overflow-hidden border border-amber-100">
                            <div
                                className="h-full bg-amber-400 rounded-full transition-all"
                                style={{ width: `${jurorsValidated}%` }}
                            />
                        </div>
                    </div>
                )}

                {total > 0 && <VoteBar votes={proposal.votes} />}
                {total > 0 && (
                    <p className="text-xs text-slate-400 mt-1">{total.toLocaleString('fr-FR')} votes exprimés</p>
                )}
            </div>

            <div className="px-4 pb-4">
                {proposal.stage === 'closed' ? (
                    proposal.blockchainProof ? (
                        <a
                            href={proposal.blockchainProof}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors"
                        >
                            <Lock size={15} />
                            Ancré sur Ethereum
                            <ExternalLink size={13} />
                        </a>
                    ) : (
                        <button
                            disabled
                            className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-slate-100 text-slate-400 cursor-not-allowed"
                        >
                            <Lock size={15} />
                            Vote clôturé
                        </button>
                    )
                ) : proposal.stage === 'review' ? (
                    <button
                        disabled
                        className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-amber-50 text-amber-500 border border-amber-200 cursor-not-allowed"
                    >
                        <Users size={15} />
                        Vote disponible après validation du Jury
                    </button>
                ) : proposal.stage === 'voting' && (currentVote || hasAlreadyVoted) ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                            {currentVote ? (
                                <span className="text-sm text-slate-600">
                                    Vous avez voté{' '}
                                    <span className={`font-semibold px-1.5 py-0.5 rounded-full text-xs ${VOTE_CHOICE_BADGE[currentVote]}`}>
                                        {VOTE_CHOICE_LABEL[currentVote]}
                                    </span>
                                </span>
                            ) : (
                                <span className="text-sm text-slate-500">Vous avez déjà voté sur cette proposition</span>
                            )}
                        </div>
                        <button
                            onClick={onOpen}
                            className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors active:scale-95"
                        >
                            <Info size={15} />
                            Voir les résultats →
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onOpen}
                        className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${proposal.stage === 'voting'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                            : 'bg-slate-100 text-slate-700'
                            }`}
                    >
                        {proposal.stage === 'voting' ? <Vote size={15} /> : <Info size={15} />}
                        {proposal.stage === 'voting' ? "S'informer & Voter" : "S'informer"}
                        <ChevronRight size={14} />
                    </button>
                )}
            </div>
        </div>
    )
}
