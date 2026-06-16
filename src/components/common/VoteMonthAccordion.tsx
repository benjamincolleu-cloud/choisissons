import { useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import type { VoteRecord } from '../../types'

const INITIAL_MONTHS_SHOWN = 6

interface VoteMonthAccordionProps {
    sortedMonths: string[]
    byMonth: Record<string, VoteRecord[]>
    fmtMonth: (k: string) => string
}

export default function VoteMonthAccordion({ sortedMonths, byMonth, fmtMonth }: VoteMonthAccordionProps) {
    const [open, setOpen] = useState<Set<string>>(new Set())
    const [showAll, setShowAll] = useState(false)

    // Ouvre le mois le plus récent dès que les données arrivent (résout le problème
    // du lazy init qui ne se déclenche pas si le composant était déjà monté à vide)
    useEffect(() => {
        if (sortedMonths.length > 0) {
            setOpen(new Set([sortedMonths[0]]))
        }
    }, [sortedMonths[0]]) // eslint-disable-line react-hooks/exhaustive-deps

    const visibleMonths = showAll ? sortedMonths : sortedMonths.slice(0, INITIAL_MONTHS_SHOWN)
    const hasMore = sortedMonths.length > INITIAL_MONTHS_SHOWN

    function toggle(key: string) {
        setOpen(prev => {
            const next = new Set(prev)
            if (next.has(key)) { next.delete(key) } else { next.add(key) }
            return next
        })
    }

    return (
        <div className="space-y-1">
            {visibleMonths.map(key => {
                const count = byMonth[key].length
                const isOpen = open.has(key)
                return (
                    <div key={key}>
                        <button
                            onClick={() => toggle(key)}
                            className="w-full flex items-center justify-between py-2 px-1 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                            <span className="text-xs font-semibold text-slate-700">
                                {fmtMonth(key)}{' '}
                                <span className="font-normal text-slate-400">({count})</span>
                            </span>
                            <ChevronRight
                                size={13}
                                className={`text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                            />
                        </button>
                        {isOpen && (
                            <div className="space-y-0 pb-2 pl-2">
                                {byMonth[key].map(v => (
                                    <div
                                        key={v.proposalId}
                                        className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-0"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-700 font-medium truncate">{v.title}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {v.date
                                                    ? new Date(v.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
                                                    : '—'}
                                            </p>
                                        </div>
                                        <span className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                                            Voté
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}

            {hasMore && !showAll && (
                <button
                    onClick={() => setShowAll(true)}
                    className="w-full mt-2 py-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                    Voir les mois précédents ({sortedMonths.length - INITIAL_MONTHS_SHOWN} de plus)
                </button>
            )}
        </div>
    )
}
