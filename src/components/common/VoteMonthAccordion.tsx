import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { VoteRecord } from '../../types'

interface VoteMonthAccordionProps {
    sortedMonths: string[]
    byMonth: Record<string, VoteRecord[]>
    fmtMonth: (k: string) => string
}

export default function VoteMonthAccordion({ sortedMonths, byMonth, fmtMonth }: VoteMonthAccordionProps) {
    const [open, setOpen] = useState<Set<string>>(() => new Set(sortedMonths.slice(0, 1)))
    return (
        <div className="space-y-1">
            {sortedMonths.map(key => (
                <div key={key}>
                    <button
                        onClick={() => setOpen(prev => {
                            const next = new Set(prev)
                            if (next.has(key)) { next.delete(key) } else { next.add(key) }
                            return next
                        })}
                        className="w-full flex items-center justify-between py-2 px-1"
                    >
                        <span className="text-xs font-semibold text-slate-600">{fmtMonth(key)}</span>
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                            {byMonth[key].length} vote{byMonth[key].length > 1 ? 's' : ''}
                            <ChevronRight size={12} className={`transition-transform ${open.has(key) ? 'rotate-90' : ''}`} />
                        </span>
                    </button>
                    {open.has(key) && (
                        <div className="space-y-2 pb-2 pl-1">
                            {byMonth[key].map(v => (
                                <div key={v.proposalId} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-50 last:border-0">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-700 font-medium truncate">{v.title}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{v.date}</p>
                                    </div>
                                    <span className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">Voté</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}
