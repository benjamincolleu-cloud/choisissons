import { useState, useEffect, type ElementType } from 'react'
import { supabase } from '../supabaseClient'
import { Users, Vote, Sprout, CheckCircle } from 'lucide-react'
import CountUp from '../components/common/CountUp'
import { IMPACT_CATEGORIES } from '../lib/constants'

export default function ImpactPage() {
    const [citizens, setCitizens] = useState(0)
    const [votes, setVotes] = useState(0)
    const [activeProposals, setActiveProposals] = useState(0)
    const [adoptedProposals, setAdoptedProposals] = useState(0)
    const [categoryData, setCategoryData] = useState<{ name: string; count: number; color: string }[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        async function fetchStats() {
            try {
                const [citizensRes, votesRes, activeRes, adoptedRes, categoryRes] = await Promise.all([
                    Promise.resolve(supabase.rpc('get_citizen_count')).catch(() => ({ data: 0, error: null })),
                    supabase.rpc('get_votes_count'),
                    supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('status', 'voting'),
                    supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('status', 'adopted'),
                    supabase.from('proposals').select('category'),
                ])
                if (!cancelled) {
                    setCitizens((citizensRes.data as number) ?? 0)
                    setVotes((votesRes.data as number) ?? 0)
                    setActiveProposals(activeRes.count ?? 0)
                    setAdoptedProposals(adoptedRes.count ?? 0)

                    const groups: Record<string, number> = {}
                    for (const p of ((categoryRes.data ?? []) as { category: string }[])) {
                        groups[p.category] = (groups[p.category] ?? 0) + 1
                    }
                    setCategoryData(IMPACT_CATEGORIES.map(c => ({ ...c, count: groups[c.name] ?? 0 })))
                }
            } catch {
                if (!cancelled) setCategoryData(IMPACT_CATEGORIES.map(c => ({ ...c, count: 0 })))
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        fetchStats()
        return () => { cancelled = true }
    }, [])

    const maxCategoryCount = Math.max(...categoryData.map(c => c.count), 1)

    const counters: { label: string; value: number; bg: string; icon: ElementType }[] = [
        { label: 'Citoyens inscrits', value: citizens, bg: 'bg-indigo-600', icon: Users },
        { label: 'Votes exprimés', value: votes, bg: 'bg-green-600', icon: Vote },
        { label: 'Propositions en vote', value: activeProposals, bg: 'bg-amber-500', icon: Sprout },
        { label: 'Propositions adoptées', value: adoptedProposals, bg: 'bg-teal-600', icon: CheckCircle },
    ]

    return (
        <div className="p-4">
            <div className="mb-5">
                <h1 className="text-2xl font-black text-slate-800">Impact</h1>
                <p className="text-slate-500 text-sm">La démocratie citoyenne en chiffres</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
                {counters.map(({ label, value, bg, icon: Icon }) => (
                    <div key={label} className={`${bg} rounded-2xl p-4 text-white`}>
                        <Icon size={18} className="opacity-75 mb-2" />
                        <div className="text-3xl font-black leading-tight tabular-nums">
                            {loading ? <span className="opacity-40">—</span> : <CountUp value={value} />}
                        </div>
                        <div className="text-xs opacity-75 mt-1 leading-snug">{label}</div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-5">
                <h2 className="font-bold text-slate-800 text-sm mb-4">Propositions par catégorie</h2>
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="animate-pulse">
                                <div className="h-3 bg-slate-100 rounded w-1/3 mb-1.5" />
                                <div className="h-3 bg-slate-100 rounded-full" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {categoryData.map(({ name, count, color }) => (
                            <div key={name}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-semibold text-slate-600">{name}</span>
                                    <span className="text-xs font-bold text-slate-800 tabular-nums">{count}</span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${color} rounded-full transition-all duration-700 ease-out`}
                                        style={{ width: count === 0 ? '2px' : `${Math.round((count / maxCategoryCount) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <p className="text-center text-xs text-slate-300 pb-2">
                Données en temps réel · Mise à jour à chaque visite
            </p>
        </div>
    )
}
