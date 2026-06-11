import { useState, useEffect, useMemo } from 'react'
import { X, BookOpen, FileText } from 'lucide-react'
import { supabase } from '../supabaseClient'
import type { LibraryEntry } from '../types'

type SortKey = 'recent' | 'votes' | 'alpha'

const CATEGORIES = ['Toutes', 'Économie', 'Social', 'Numérique', 'Institutions', 'Sécurité', 'Défense', 'Environnement', 'Justice']

export default function LibraryPage() {
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Toutes')
  const [statusFilter, setStatusFilter] = useState<'all' | 'adopted' | 'rejected' | 'closed'>('all')
  const [sortBy, setSortBy] = useState<SortKey>('recent')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [proposalsRes, lawsRes] = await Promise.all([
          supabase
            .from('proposals')
            .select('id, title, description, category, status, votes_pour, votes_contre, votes_blanc, created_at')
            .in('status', ['adopted', 'rejected', 'closed', 'archived'])
            .order('created_at', { ascending: false })
            .limit(200),
          supabase
            .from('parliamentary_laws')
            .select('id, title, description, category, stage, votes_pour, votes_contre, votes_blanc, synced_at')
            .in('stage', ['adopted', 'rejected', 'closed', 'archived'])
            .limit(200),
        ])
        if (cancelled) return

        const citizen: LibraryEntry[] = (proposalsRes.data ?? []).map(p => ({
          id: String(p.id),
          title: (p.title as string) ?? '',
          description: (p.description as string) ?? '',
          category: (p.category as string) ?? '',
          status: p.status as string,
          type: 'citizen' as const,
          votes_pour: (p.votes_pour as number) ?? 0,
          votes_contre: (p.votes_contre as number) ?? 0,
          votes_blanc: (p.votes_blanc as number) ?? 0,
          date: (p.created_at as string) ?? '',
        }))

        const laws: LibraryEntry[] = (lawsRes.data ?? []).map(l => ({
          id: String(l.id),
          title: (l.title as string) ?? '',
          description: (l.description as string) ?? '',
          category: (l.category as string) ?? '',
          status: l.stage as string,
          type: 'law' as const,
          votes_pour: (l.votes_pour as number) ?? 0,
          votes_contre: (l.votes_contre as number) ?? 0,
          votes_blanc: (l.votes_blanc as number) ?? 0,
          date: (l.synced_at as string) ?? '',
        }))

        setEntries(
          [...citizen, ...laws].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )
        )
      } catch { /* empty state */ } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    let result = entries
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
      )
    }
    if (activeCategory !== 'Toutes') result = result.filter(e => e.category === activeCategory)
    if (statusFilter !== 'all') result = result.filter(e => e.status === statusFilter || (statusFilter === 'closed' && e.status === 'archived'))
    if (sortBy === 'votes') {
      return [...result].sort(
        (a, b) => (b.votes_pour + b.votes_contre + b.votes_blanc) - (a.votes_pour + a.votes_contre + a.votes_blanc)
      )
    }
    if (sortBy === 'alpha') return [...result].sort((a, b) => a.title.localeCompare(b.title, 'fr'))
    return result
  }, [entries, search, activeCategory, statusFilter, sortBy])

  function downloadOpenData() {
    const payload = entries.map(e => ({
      proposal_id: e.id,
      title: e.title,
      type: e.type === 'law' ? 'loi_parlementaire' : 'proposition_citoyenne',
      votes_pour: e.votes_pour,
      votes_contre: e.votes_contre,
      votes_blanc: e.votes_blanc,
      closed_at: e.date,
    }))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'choisissons-donnees-publiques.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="pb-24">
      {/* Header + contrôles */}
      <div className="p-4 pb-0">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-black text-slate-800">Bibliothèque</h1>
          {!loading && (
            <span className="text-xs text-slate-400 font-medium">
              {entries.length} archive{entries.length > 1 ? 's' : ''} disponible{entries.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-slate-500 text-sm leading-relaxed mb-4">Archives des votes citoyens CHOISISSONS</p>

        {/* Recherche */}
        <div className="relative mb-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher dans les archives..."
            className="w-full bg-slate-50 rounded-xl px-3 py-2.5 pr-8 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Onglets catégories */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeCategory === cat
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Statut + tri */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {([
              { key: 'all', label: 'Tous' },
              { key: 'adopted', label: 'Adoptées' },
              { key: 'rejected', label: 'Rejetées' },
              { key: 'closed', label: 'Clôturées' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${statusFilter === key
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-500'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="flex-shrink-0 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 outline-none"
          >
            <option value="recent">Plus récentes</option>
            <option value="votes">Plus votées</option>
            <option value="alpha">Alphabétique</option>
          </select>
        </div>
      </div>

      {/* Liste */}
      <div className="px-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-full mb-1" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14">
            <BookOpen size={36} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 text-sm font-medium">
              {entries.length === 0
                ? "Aucune proposition clôturée pour l'instant"
                : 'Aucune archive ne correspond à votre recherche.'}
            </p>
            {entries.length === 0 && (
              <p className="text-slate-400 text-xs mt-1">Les résultats des votes apparaîtront ici</p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {filtered.map(entry => {
              const total = entry.votes_pour + entry.votes_contre + entry.votes_blanc
              const pctPour = total > 0 ? Math.round((entry.votes_pour / total) * 100) : 0
              const pctContre = total > 0 ? Math.round((entry.votes_contre / total) * 100) : 0
              const pctBlanc = total > 0 ? 100 - pctPour - pctContre : 0
              const isAdopted = entry.status === 'adopted'
              const isRejected = entry.status === 'rejected'
              return (
                <div key={entry.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        {entry.type === 'law' ? 'Loi parlementaire' : 'Proposition citoyenne'}
                      </p>
                      <h3 className="font-bold text-slate-800 text-sm leading-snug">{entry.title}</h3>
                    </div>
                    {(isAdopted || isRejected) && (
                      <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${isAdopted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                        }`}>
                        {isAdopted ? 'Adoptée' : 'Rejetée'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-2 line-clamp-2">{entry.description}</p>
                  <p className="text-xs text-slate-400 mb-3">
                    Clôturée le {entry.date ? new Date(entry.date).toLocaleDateString('fr-FR') : '—'}
                  </p>
                  {total === 0 ? (
                    <p className="text-xs text-slate-400">Aucun vote enregistré</p>
                  ) : (
                    <div className="space-y-1.5">
                      {([
                        { label: 'Pour', pct: pctPour, color: 'bg-green-500' },
                        { label: 'Contre', pct: pctContre, color: 'bg-red-500' },
                        { label: 'Blanc', pct: pctBlanc, color: 'bg-slate-300' },
                      ] as const).map(({ label, pct, color }) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 w-10 flex-shrink-0">{label}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                            <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-600 w-8 text-right flex-shrink-0">{pct}%</span>
                        </div>
                      ))}
                      <p className="text-xs text-slate-400 pt-0.5">
                        {total.toLocaleString('fr-FR')} vote{total > 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Open data — bas de page */}
      <div className="px-4 mt-6">
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
          <button
            onClick={downloadOpenData}
            disabled={loading || entries.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors active:scale-95"
          >
            <FileText size={15} />
            Données open source
          </button>
          <p className="text-xs text-slate-500 mt-2.5 text-center leading-relaxed">
            Ces données sont librement réutilisables (licence Creative Commons CC0).{' '}
            Pour accéder à l'API :{' '}
            <span className="text-indigo-600 font-medium">contact@choisissons.fr</span>
          </p>
        </div>
      </div>
    </div>
  )
}
