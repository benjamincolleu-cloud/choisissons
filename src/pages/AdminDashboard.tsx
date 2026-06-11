import { useState, useEffect } from 'react'
import { ArrowLeft, Shield, CheckCircle, XCircle, Users, Vote, Trash2, Lock, ExternalLink } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { showToast } from '../lib/toast'
import { computeUrneRootHash, anchorHash } from '../lib/blockchain'
import type { AdminProposal } from '../types'

export default function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [proposals, setProposals] = useState<AdminProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [urneCount, setUrneCount] = useState<number | null>(null)
  const [registreCount, setRegistreCount] = useState<number | null>(null)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'review' | 'all' | 'stats'>('review')

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        const [propsRes, urneRes, registreRes] = await Promise.all([
          supabase.from('proposals')
            .select('id,title,description,status,supports,created_at,blockchain_proof')
            .order('created_at', { ascending: false }),
          supabase.from('urne_electronique').select('id', { count: 'exact', head: true }),
          supabase.from('registre_scrutin').select('id', { count: 'exact', head: true }),
        ])
        if (!cancelled) {
          if (propsRes.data) setProposals(propsRes.data as AdminProposal[])
          if (urneRes.count !== null) setUrneCount(urneRes.count)
          if (registreRes.count !== null) setRegistreCount(registreRes.count)
        }
      } catch {
        showToast('Une erreur est survenue. Réessayez.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  async function handleStatusChange(id: string, newStatus: string) {
    setActioningId(id)
    try {
      const { error } = await supabase.from('proposals').update({ status: newStatus }).eq('id', id)
      if (error) throw error
      setProposals(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p))
    } catch {
      showToast('Une erreur est survenue. Réessayez.')
    }
    setActioningId(null)
  }

  async function handleDelete(id: string) {
    setActioningId(id)
    try {
      const { error } = await supabase.from('proposals').delete().eq('id', id)
      if (error) throw error
      setProposals(prev => prev.filter(p => p.id !== id))
    } catch {
      showToast('Une erreur est survenue. Réessayez.')
    }
    setActioningId(null)
  }

  async function handleAnchor(id: string) {
    setActioningId(id)
    try {
      const rootHash = await computeUrneRootHash(id)
      const txUrl = await anchorHash(id, rootHash)
      const { error } = await supabase.from('proposals')
        .update({ status: 'closed', blockchain_proof: txUrl }).eq('id', id)
      if (error) throw error
      setProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'closed', blockchain_proof: txUrl } : p))
      showToast('Vote clôturé et ancré sur Ethereum.', 'info')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Une erreur est survenue. Réessayez.')
    }
    setActioningId(null)
  }

  const reviewProposals = proposals.filter(p => p.status === 'review')

  const statusCounts = proposals.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1
    return acc
  }, {})

  const statusLabel: Record<string, { text: string; color: string }> = {
    seedling: { text: 'Pépinière', color: 'bg-emerald-100 text-emerald-700' },
    review: { text: 'En examen', color: 'bg-amber-100 text-amber-700' },
    voting: { text: 'Vote', color: 'bg-indigo-100 text-indigo-700' },
    adopted: { text: 'Adoptée', color: 'bg-green-100 text-green-700' },
    rejected: { text: 'Rejetée', color: 'bg-red-100 text-red-600' },
    closed: { text: 'Clôturé', color: 'bg-teal-100 text-teal-700' },
    archived: { text: 'Archivée', color: 'bg-slate-100 text-slate-600' },
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 px-5 pt-10 pb-6 text-white">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-400 text-xs font-medium mb-5 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Retour à Mon Compte
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
            <Shield size={20} className="text-slate-300" />
          </div>
          <div>
            <h1 className="text-xl font-black">Administration</h1>
            <p className="text-slate-400 text-xs">Accès restreint</p>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 bg-slate-200 mx-4 mt-4 rounded-xl p-1">
        {([
          { key: 'review' as const, label: `En attente (${reviewProposals.length})` },
          { key: 'all' as const, label: 'Toutes' },
          { key: 'stats' as const, label: 'Stats' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${activeSection === tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* Section 1 — Propositions en attente de validation */}
        {activeSection === 'review' && (
          loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                </div>
              ))}
            </div>
          ) : reviewProposals.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-100 text-center">
              <CheckCircle size={32} className="text-green-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aucune proposition en attente de validation.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviewProposals.map(p => (
                <div key={p.id} className="bg-white rounded-2xl border border-amber-200 p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-800 flex-1 leading-snug">{p.title}</h3>
                    <span className="text-xs text-slate-400 flex-shrink-0">{p.created_at?.slice(0, 10)}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-2 line-clamp-3">{p.description}</p>
                  <p className="text-xs text-emerald-600 font-medium mb-3">🌱 {p.supports ?? 0} soutiens</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusChange(p.id, 'voting')}
                      disabled={actioningId === p.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500 text-white text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                    >
                      {actioningId === p.id
                        ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        : <><CheckCircle size={13} /> Valider</>}
                    </button>
                    <button
                      onClick={() => handleStatusChange(p.id, 'rejected')}
                      disabled={actioningId === p.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500 text-white text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                    >
                      {actioningId === p.id
                        ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        : <><XCircle size={13} /> Rejeter</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Section 2 — Toutes les propositions */}
        {activeSection === 'all' && (
          loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl p-3 border border-slate-100 animate-pulse">
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : proposals.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Aucune proposition</p>
          ) : (
            <div className="space-y-2">
              {proposals.map(p => {
                const s = statusLabel[p.status] ?? { text: p.status, color: 'bg-slate-100 text-slate-600' }
                return (
                  <div key={p.id} className="bg-white rounded-xl border border-slate-100 px-3 py-2.5 flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{p.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{p.created_at?.slice(0, 10)}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${s.color}`}>
                        {s.text}
                      </span>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={actioningId === p.id}
                        className="flex-shrink-0 w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 active:scale-95 transition-all disabled:opacity-40"
                        title="Supprimer"
                      >
                        {actioningId === p.id
                          ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                          : <Trash2 size={13} />}
                      </button>
                    </div>
                    {p.status === 'seedling' && (
                      <button
                        onClick={() => handleStatusChange(p.id, 'review')}
                        disabled={actioningId === p.id}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                      >
                        {actioningId === p.id
                          ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                          : <><Users size={12} /> → Jury</>}
                      </button>
                    )}
                    {p.status === 'review' && (
                      <button
                        onClick={() => handleStatusChange(p.id, 'voting')}
                        disabled={actioningId === p.id}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-indigo-500 text-white text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                      >
                        {actioningId === p.id
                          ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                          : <><Vote size={12} /> → Isoloir</>}
                      </button>
                    )}
                    {p.status === 'voting' && (
                      <>
                        <div className="flex gap-2 mb-1.5">
                          <button
                            onClick={() => handleStatusChange(p.id, 'adopted')}
                            disabled={actioningId === p.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-green-500 text-white text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                          >
                            <CheckCircle size={12} /> Adopter
                          </button>
                          <button
                            onClick={() => handleStatusChange(p.id, 'rejected')}
                            disabled={actioningId === p.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-red-500 text-white text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                          >
                            <XCircle size={12} /> Rejeter
                          </button>
                        </div>
                        <button
                          onClick={() => handleAnchor(p.id)}
                          disabled={actioningId === p.id}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                        >
                          {actioningId === p.id
                            ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Action en cours…</>
                            : <><Lock size={12} /> Clôturer et ancrer sur Ethereum</>}
                        </button>
                      </>
                    )}
                    {p.status === 'closed' && p.blockchain_proof && (
                      <a
                        href={p.blockchain_proof}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 text-xs font-semibold hover:bg-teal-100 transition-colors"
                      >
                        <Lock size={12} />
                        Voir sur Etherscan
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* Section 3 — Statistiques */}
        {activeSection === 'stats' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Propositions par statut</h3>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-8 bg-slate-50 rounded-xl animate-pulse" />)}
                </div>
              ) : (
                <div className="space-y-1">
                  {Object.entries(statusLabel).map(([key, { text, color }]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color}`}>{text}</span>
                      <span className="text-lg font-black text-slate-800">{statusCounts[key] ?? 0}</span>
                    </div>
                  ))}
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Total</span>
                    <span className="text-lg font-black text-slate-800">{proposals.length}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Activité de vote</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Bulletins déposés</p>
                    <p className="text-xs text-slate-400">urne_electronique</p>
                  </div>
                  <span className="text-2xl font-black text-slate-800">
                    {urneCount === null ? '—' : urneCount.toLocaleString('fr-FR')}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Votants uniques</p>
                    <p className="text-xs text-slate-400">registre_scrutin</p>
                  </div>
                  <span className="text-2xl font-black text-slate-800">
                    {registreCount === null ? '—' : registreCount.toLocaleString('fr-FR')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
