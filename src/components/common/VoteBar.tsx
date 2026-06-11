export default function VoteBar({ votes }: { votes: { pour: number; contre: number; blanc: number } }) {
    const total = votes.pour + votes.contre + votes.blanc
    if (total === 0) return null
    const pourPct = Math.round((votes.pour / total) * 100)
    const contrePct = Math.round((votes.contre / total) * 100)
    const blancPct = 100 - pourPct - contrePct
    return (
        <div className="mt-2">
            <div className="flex h-2 rounded-full overflow-hidden">
                <div className="bg-green-500 transition-all" style={{ width: `${pourPct}%` }} />
                <div className="bg-red-400 transition-all" style={{ width: `${contrePct}%` }} />
                <div className="bg-slate-300 transition-all" style={{ width: `${blancPct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span className="text-green-600 font-medium">{pourPct}% Pour</span>
                <span className="text-slate-400">{blancPct}% Blanc</span>
                <span className="text-red-500 font-medium">{contrePct}% Contre</span>
            </div>
        </div>
    )
}
