import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { showToast } from '../lib/toast'
import type { Organisation, CommuneRole, LocalConsultation, TeamMember, Stage } from '../types'
import { canDo } from '../lib/utils'
import { ArrowLeft, Trash2, Plus, X, Users } from 'lucide-react'
import { STAGE_CONFIG } from '../lib/constants'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
    return (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500 leading-snug mb-1">{label}</p>
            <p className="text-2xl font-black text-slate-800">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
        </div>
    )
}

export default function ElectedDashboard({ commune, userRole, onBack }: {
    commune: Organisation
    userRole: CommuneRole
    onBack: () => void
}) {
    const [memberCount, setMemberCount] = useState<number | null>(null)
    const [consultations, setConsultations] = useState<LocalConsultation[]>([])
    const [loadingStats, setLoadingStats] = useState(true)

    const [showForm, setShowForm] = useState(false)
    const [formTitle, setFormTitle] = useState('')
    const [formDescription, setFormDescription] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [showInvite, setShowInvite] = useState(false)
    const inviteUrl = `https://choisissons.fr?commune=${encodeURIComponent(commune.name)}`

    const [loadingTeam, setLoadingTeam] = useState(false)
    const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)

    useEffect(() => {
        if (!canDo(userRole, 'manage_members')) return
        let cancelled = false
        async function fetchTeam() {
            setLoadingTeam(true)
            try {
                const { data } = await supabase
                    .from('citizen_organisations')
                    .select('id, user_hash, role, created_at')
                    .eq('organisation_id', commune.id)
                    .order('created_at', { ascending: false })
                if (!cancelled && data) setTeamMembers(data as TeamMember[])
            } catch { /* ignore */ } finally {
                if (!cancelled) setLoadingTeam(false)
            }
        }
        fetchTeam()
        return () => { cancelled = true }
    }, [commune.id, userRole])

    async function handleRoleChange(memberId: string, newRole: CommuneRole) {
        setUpdatingMemberId(memberId)
        try {
            const { error } = await supabase
                .from('citizen_organisations')
                .update({ role: newRole })
                .eq('id', memberId)
            if (error) throw error
            setTeamMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
        } catch {
            showToast('Une erreur est survenue. Réessayez.')
        }
        setUpdatingMemberId(null)
    }

    async function handleRemoveMember(memberId: string) {
        setUpdatingMemberId(memberId)
        try {
            const { error } = await supabase
                .from('citizen_organisations')
                .delete()
                .eq('id', memberId)
            if (error) throw error
            setTeamMembers(prev => prev.filter(m => m.id !== memberId))
        } catch {
            showToast('Une erreur est survenue. Réessayez.')
        }
        setUpdatingMemberId(null)
    }

    useEffect(() => {
        let cancelled = false
        async function fetchData() {
            try {
        const [membersRes, consultRes] = await Promise.all([
                    supabase.from('citizen_organisations').select('id', { count: 'exact', head: true }).eq('organisation_id', commune.id),
                    supabase.from('proposals').select('id,title,description,status,created_at,votes_pour,votes_contre,votes_blanc').eq('author', commune.name),
                ])
                if (!cancelled) {
                    if (membersRes.count !== null) setMemberCount(membersRes.count)
                    if (consultRes.data) setConsultations(consultRes.data as LocalConsultation[])
                }
            } catch {
                if (!cancelled) showToast('Une erreur est survenue. Réessayez.')
            } finally {
                if (!cancelled) setLoadingStats(false)
            }
        }
        fetchData()
        return () => { cancelled = true }
    }, [commune.id, commune.name])

    async function handleCreate() {
        if (!formTitle.trim()) return
        setSubmitting(true)
        try {
            const { data, error } = await supabase.from('proposals').insert({
                title: formTitle,
                description: formDescription,
                status: 'voting',
                author: commune.name,
                category: 'Local',
                organisation_id: commune.id,
            }).select().single()

            if (error) throw error

            setConsultations(prev => [data as LocalConsultation, ...prev])
            setShowForm(false)
            setFormTitle(''); setFormDescription('')
        } catch {
            showToast('Une erreur est survenue. Réessayez.')
        }
        setSubmitting(false)
    }

    const ROLE_LABELS: Record<CommuneRole, string> = {
        admin: 'Administrateur',
        elu: 'Élu(e)',
        agent_com: 'Agent comm.',
        lecteur_admin: 'Lecteur admin',
        member: 'Habitant',
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div style={{ backgroundColor: '#0c447c' }} className="px-5 pt-10 pb-6 text-white">
                <button onClick={onBack} className="flex items-center gap-1.5 text-blue-200 text-xs font-medium mb-5 hover:text-white transition-colors">
                    <ArrowLeft size={14} />
                    Retour à Mon Compte
                </button>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">Tableau de bord élu · {ROLE_LABELS[userRole]}</p>
                        <h1 className="text-xl font-black leading-tight">{commune.name}</h1>
                    </div>
                    {commune.population != null && (
                        <div className="text-right flex-shrink-0">
                            <p className="text-2xl font-black">{commune.population.toLocaleString('fr-FR')}</p>
                            <p className="text-blue-200 text-xs">habitants</p>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setShowInvite(true)}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 transition-colors text-sm font-semibold text-white"
                >
                    <Users size={15} />
                    Inviter mes habitants
                </button>
            </div>

            {/* Modale invitation */}
            {showInvite && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4" onClick={() => setShowInvite(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="font-black text-slate-800 text-base">Inviter mes habitants</h2>
                            <button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Partagez ce lien avec vos habitants pour qu'ils rejoignent votre espace et participent aux votes locaux.
                        </p>
                        <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-xs text-slate-600 font-mono break-all border border-slate-200">{inviteUrl}</div>
                        <button onClick={() => { navigator.clipboard.writeText(inviteUrl); showToast('Lien copié !', 'info') }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors active:scale-95">Copier le lien</button>
                    </div>
                </div>
            )}

            {/* Stat cards */}
    <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-3 mb-5">
            <StatCard label="Inscrits CHOISISSONS" value={loadingStats ? '—' : (memberCount ?? 0).toLocaleString('fr-FR')} sub="habitants enregistrés" />
            <StatCard label="Consultations" value={loadingStats ? '—' : consultations.length.toString()} sub="locales lancées" />
        </div>

        {/* Consultations */}
        <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mes consultations</h2>
                {canDo(userRole, 'create_consultation') && (
                    <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white active:scale-95 transition-all" style={{ backgroundColor: '#0c447c' }}>
                        <Plus size={12} />
                        Lancer une consultation
                    </button>
                )}
            </div>
          {loadingStats ? (
            <div className="bg-white rounded-2xl p-4 border border-slate-100 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-2/3" />
            </div>
          ) : consultations.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center">
              <p className="text-sm text-slate-400 mb-1">Aucune consultation locale</p>
              <p className="text-xs text-slate-300">Lancez la première consultation citoyenne de votre commune</p>
            </div>
          ) : (
            <div className="space-y-3">
              {consultations.map(c => {
                const s = STAGE_CONFIG[c.status as Stage] ?? { label: c.status, color: 'bg-slate-100 text-slate-600' }
                const total = (c.votes_pour ?? 0) + (c.votes_contre ?? 0) + (c.votes_blanc ?? 0)
                return (
                  <div key={c.id} className="bg-white rounded-2xl p-4 border border-slate-100">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-slate-800 flex-1 leading-snug">{c.title}</h3>
                      <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${s.color}`}>
                        {s.label}
                      </span>
                    </div>
                    {c.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-1">{c.description}</p>
                    )}
                    <p className="text-xs text-slate-300">{c.created_at?.slice(0, 10)} · {total} vote{total !== 1 ? 's' : ''}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Gestion de l'équipe */}
        {canDo(userRole, 'manage_members') && (
            <div className="mb-8">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Gestion de l'équipe</h2>
            {loadingTeam ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-12 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-5 text-center">
                <p className="text-sm text-slate-400">Aucun membre enregistré</p>
              </div>
            ) : (
              <div className="space-y-2">
                {teamMembers.map(m => (
                  <div key={m.id} className="bg-white rounded-2xl border border-slate-100 px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-slate-500 truncate">{m.user_hash.slice(0, 16)}…</p>
                      <p className="text-xs text-slate-400">{m.created_at?.slice(0, 10)}</p>
                    </div>
                    <select
                      value={m.role}
                      onChange={e => handleRoleChange(m.id, e.target.value as CommuneRole)}
                      disabled={updatingMemberId === m.id}
                      className="text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg px-2 py-1.5 outline-none cursor-pointer disabled:opacity-50"
                    >
                      {(Object.entries(ROLE_LABELS) as [CommuneRole, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      disabled={updatingMemberId === m.id}
                      className="flex-shrink-0 w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 active:scale-95 transition-all disabled:opacity-40"
                    >
                      {updatingMemberId === m.id
                        ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                        : <Trash2 size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
            </div>
        )}
    </div>

    {/* Modale de création */}
    {showForm && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-end p-4">
                <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                        <h3 className="font-bold text-slate-800 text-sm">Nouvelle consultation locale</h3>
                        <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <X size={15} className="text-slate-500" />
                        </button>
                    </div>
                    <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Titre</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Ex : Aménagement de la place centrale"
                  className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Décrivez l'objet de la consultation..."
                  rows={3}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                />
              </div>
                    </div>
                    <div className="px-5 pb-5 flex gap-3">
                        <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">Annuler</button>
                        <button onClick={handleCreate} disabled={!formTitle.trim() || submitting} className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-all" style={{ backgroundColor: '#0c447c' }}>
                            {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Lancer'}
                        </button>
                    </div>
                </div>
            </div>
    )}
        </div>
    )
}
