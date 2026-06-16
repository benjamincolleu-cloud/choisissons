import { useState, useEffect, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import type { Organisation, CommuneRole, VoteRecord, MyProposalRecord, Stage } from '../types'
import { ADMIN_EMAILS, MOCK_ORGANISATIONS } from '../lib/constants'
import { showToast } from '../lib/toast'
import { emailToDisplayName, nameToInitials, canDo } from '../lib/utils'
import {
    User, Settings, LogOut, Bell, Globe, Trash2, ExternalLink, FileText, X,
    Shield, Landmark, ChevronRight, Users, Newspaper,
} from 'lucide-react'

import StageBadge from '../components/common/StageBadge'
import VoteMonthAccordion from '../components/common/VoteMonthAccordion'

interface ProfilePageProps {
    onLogout: () => void
    onNavigateElu: (commune: Organisation, role: CommuneRole) => void
    onNavigateOrg: (org: Organisation) => void
    onNavigateAdmin: () => void
    onNavigateCommune: (commune: Organisation, role: CommuneRole) => void
}

export default function ProfilePage({ onLogout, onNavigateElu, onNavigateOrg, onNavigateAdmin, onNavigateCommune }: ProfilePageProps) {
    const { userHash, userEmail } = useAuth()
    const [showSettings, setShowSettings] = useState(false)
    const [showLegal, setShowLegal] = useState<string | null>(null)
    const [notifEnabled, setNotifEnabled] = useState(true)
    const [language, setLanguage] = useState('FR')
    const [userPlan, setUserPlan] = useState<'citoyen' | 'commune' | 'ong' | 'media'>('citoyen')
    const [subscriptionPlan, setSubscriptionPlan] = useState<string>('gratuit')
    const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive')
    const [showSuccessBanner, setShowSuccessBanner] = useState(false)

    const [votedProposals, setVotedProposals] = useState<VoteRecord[]>([])
    const [loadingVotes, setLoadingVotes] = useState(true)
    const [myProposals, setMyProposals] = useState<MyProposalRecord[]>([])
    const [loadingMyProps, setLoadingMyProps] = useState(true)

    const [fullName, setFullName] = useState<string>('')
    const [profileCommune, setProfileCommune] = useState<string | null>(null)

    const displayName = fullName || emailToDisplayName(userEmail)
    const userInitials = nameToInitials(displayName)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get('success') === 'true') {
            setShowSuccessBanner(true)
            window.history.replaceState(null, '', window.location.pathname)
        }

        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return
            const rawName = (user.user_metadata?.full_name as string | undefined)?.trim() ?? ''
            if (rawName) setFullName(rawName)
            supabase
                .from('profiles')
                .select('commune_name, subscription_plan, subscription_status')
                .eq('id', user.id)
                .single()
                .then(({ data }) => {
                    if (data?.commune_name) setProfileCommune(data.commune_name as string)
                    if (data?.subscription_plan) setSubscriptionPlan(data.subscription_plan as string)
                    if (data?.subscription_status) setSubscriptionStatus(data.subscription_status as string)
                })
        })
    }, [])

    const [communeQuery, setCommuneQuery] = useState('')
    const [communeResults, setCommuneResults] = useState<Organisation[]>([])
    const [loadingCommune, setLoadingCommune] = useState(false)
    const [joinedCommuneIds, setJoinedCommuneIds] = useState<Set<string>>(new Set())
    const [joinedCommunes, setJoinedCommunes] = useState<Organisation[]>([])
    const [joinedOrgs, setJoinedOrgs] = useState<Organisation[]>([])
    const [communeRoles, setCommuneRoles] = useState<Record<string, CommuneRole>>({})

    useEffect(() => {
        let cancelled = false
        async function fetchVotes() {
            if (!userHash) {
                if (!cancelled) setLoadingVotes(false)
                return
            }
            try {
                const { data, error } = await supabase.rpc('get_my_votes', { p_user_hash: userHash })
                if (error) throw error
                if (!cancelled && data && (data as unknown[]).length > 0) {
                    const rows = data as { proposal_id: string; title: string; voted_at: string }[]

                    // Les votes sur lois parlementaires ont proposal_id = parliamentary_laws.number
                    // La RPC ne joint que proposals, donc title revient null pour ces votes.
                    const unknownIds = rows
                        .filter(r => !r.title)
                        .map(r => r.proposal_id)

                    let lawTitles: Record<string, string> = {}
                    if (unknownIds.length > 0) {
                        const { data: laws } = await supabase
                            .from('parliamentary_laws')
                            .select('number, title')
                            .in('number', unknownIds)
                        for (const l of (laws ?? []) as { number: string; title: string }[]) {
                            lawTitles[l.number] = l.title
                        }
                    }

                    if (!cancelled) {
                        setVotedProposals(
                            rows.map(row => ({
                                proposalId: String(row.proposal_id),
                                title: row.title || lawTitles[row.proposal_id] || 'Proposition inconnue',
                                date: row.voted_at?.slice(0, 10) ?? '',
                            }))
                        )
                    }
                }
            } catch {
                if (!cancelled) showToast("Impossible de charger vos votes. Réessayez plus tard.")
            } finally {
                if (!cancelled) setLoadingVotes(false)
            }
        }
        fetchVotes()
        return () => { cancelled = true }
    }, [userHash])

    useEffect(() => {
        if (!userHash) return
        let cancelled = false
        async function fetchMyProposals() {
            try {
                const { data, error } = await supabase
                    .from('proposals')
                    .select('id, title, status, supports')
                    .eq('author_hash', userHash)
                    .order('created_at', { ascending: false })
                if (error) throw error
                if (!cancelled && data) {
                    setMyProposals(
                        (data as { id: string; title: string; status: string; supports?: number }[]).map(p => ({
                            id: p.id,
                            title: p.title,
                            stage: (p.status as Stage) ?? 'seedling',
                            supports: p.supports ?? 0,
                        }))
                    )
                }
            } catch {
                // Supabase unavailable — section stays empty
            } finally {
                if (!cancelled) setLoadingMyProps(false)
            }
        }
        fetchMyProposals()
        return () => { cancelled = true }
    }, [userHash])

    useEffect(() => {
        let cancelled = false
        async function fetchJoined() {
            try {
                const { data, error } = await supabase
                    .from('citizen_organisations')
                    .select('organisation_id, role')
                    .eq('user_hash', userHash)
                if (error) throw error
                if (!cancelled && data && data.length > 0) {
                    const rows = data as { organisation_id: string; role?: string }[]
                    const ids = rows.map(r => r.organisation_id)
                    setJoinedCommuneIds(new Set(ids))
                    const roleMap: Record<string, CommuneRole> = {}
                    for (const r of rows) {
                        const v = r.role as string
                        roleMap[r.organisation_id] = (['admin', 'elu', 'agent_com', 'lecteur_admin'] as CommuneRole[]).includes(v as CommuneRole)
                            ? (v as CommuneRole)
                            : 'member'
                    }
                    setCommuneRoles(roleMap)
                    const { data: orgData } = await supabase
                        .from('organisations')
                        .select('id,name,type,description,population,code_insee,abonnement')
                        .in('id', ids)
                    if (!cancelled) {
                        const orgs = (orgData && orgData.length > 0)
                            ? orgData as Organisation[]
                            : MOCK_ORGANISATIONS.filter(o => ids.includes(o.id))
                        setJoinedCommunes(orgs.filter(o => o.type === 'commune'))
                        setJoinedOrgs(orgs.filter(o => o.type === 'ong' || o.type === 'media'))
                    }
                }
            } catch { /* ignore */ }
        }
        fetchJoined()
        return () => { cancelled = true }
    }, [userHash])

    useEffect(() => {
        if (!communeQuery.trim()) { setCommuneResults([]); return }
        const timer = setTimeout(async () => {
            setLoadingCommune(true)
            try {
                const { data, error } = await supabase
                    .from('organisations')
                    .select('id,name,type,description,population')
                    .eq('type', 'commune')
                    .ilike('name', `%${communeQuery}%`)
                    .limit(5)
                if (error) throw error
                if (data && data.length > 0) {
                    setCommuneResults(data as Organisation[])
                } else {
                    const q = communeQuery.toLowerCase()
                    setCommuneResults(MOCK_ORGANISATIONS.filter(o => o.type === 'commune' && o.name.toLowerCase().includes(q)))
                }
            } catch {
                const q = communeQuery.toLowerCase()
                setCommuneResults(MOCK_ORGANISATIONS.filter(o => o.type === 'commune' && o.name.toLowerCase().includes(q)))
            } finally {
                setLoadingCommune(false)
            }
        }, 350)
        return () => clearTimeout(timer)
    }, [communeQuery])

    async function handleJoinCommune(orgId: string) {
        setJoinedCommuneIds(prev => { const s = new Set(prev); s.add(orgId); return s })
        setCommuneRoles(prev => ({ ...prev, [orgId]: 'member' }))
        const org = communeResults.find(o => o.id === orgId)
        if (org) setJoinedCommunes(prev => [...prev, org])
        try {
            const { error } = await supabase.from('citizen_organisations').insert({
                user_hash: userHash,
                organisation_id: orgId,
                role: 'member',
            })
            if (error) throw error
        } catch {
            showToast('Une erreur est survenue. Réessayez.')
        }
    }

    const legalDocs: Record<string, { title: string; content: ReactNode }> = {
        cgu: {
            title: "Conditions Générales d'Utilisation",
            content: (
                <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                    <p><span className="font-bold text-slate-800">Version Alpha — Mai 2026</span></p>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">1. Objet</p>
                        <p>CHOISISSONS est une plateforme de démocratie directe citoyenne permettant aux utilisateurs de consulter, soutenir et voter des propositions citoyennes. Cette version est un prototype à usage non contraignant, destiné à tester l'expérience utilisateur.</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">2. Accès au service</p>
                        <p>L'accès est libre et gratuit en version Citoyen. L'utilisation est réservée aux personnes physiques majeures résidant en France. En accédant à la plateforme, vous acceptez les présentes CGU.</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">3. Comportement attendu</p>
                        <p>Vous vous engagez à voter de manière sincère et personnelle, à ne pas créer de comptes multiples pour biaiser les votes, à ne pas publier de contenu illégal, haineux, diffamatoire ou contraire à la Constitution française.</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">4. Propriété intellectuelle</p>
                        <p>Le code source est open-source (licence à définir). Les contenus générés par les utilisateurs restent leur propriété. En les publiant sur CHOISISSONS, vous accordez une licence non exclusive d'affichage à la plateforme.</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">5. Limitation de responsabilité</p>
                        <p>CHOISISSONS est une plateforme de démocratie consultative. Les votes n'ont aucune valeur juridique contraignante dans cette version alpha. La plateforme ne peut être tenue responsable des décisions prises sur la base de ces votes.</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">6. Modification des CGU</p>
                        <p>Ces CGU peuvent être modifiées à tout moment. Les utilisateurs seront informés par notification dans l'application.</p>
                    </div>
                    <p className="text-xs text-slate-400 pt-2">Contact : contact@choisissons.fr</p>
                </div>
            ),
        },
        privacy: {
            title: 'Politique de confidentialité',
            content: (
                <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                    <p><span className="font-bold text-slate-800">Conforme au RGPD — Version Alpha Mai 2026</span></p>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">1. Responsable du traitement</p>
                        <p>Benjamin Colleu — contact@choisissons.fr. Structure juridique en cours de création (micro-entreprise / association loi 1901).</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">2. Données collectées</p>
                        <p>CHOISISSONS collecte uniquement : un identifiant de session anonyme généré localement sur votre appareil, et les empreintes SHA-256 de vos votes (irréversibles, non liées à votre identité). Aucun nom, prénom, adresse e-mail ou donnée personnelle n'est collecté dans cette version.</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">3. Finalité du traitement</p>
                        <p>Les données sont utilisées exclusivement pour garantir l'unicité des votes et afficher les statistiques agrégées. Elles ne sont jamais vendues, partagées ou utilisées à des fins publicitaires.</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">4. Hébergement</p>
                        <p>Les données sont hébergées sur Supabase (serveur Paris — West EU) et Vercel (CDN européen). Aucun transfert hors Union Européenne.</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">5. Durée de conservation</p>
                        <p>Les empreintes de vote sont conservées le temps de la session de vote. L'identifiant de session local peut être réinitialisé à tout moment depuis Mon Compte.</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">6. Vos droits</p>
                        <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et d'effacement. Pour exercer ces droits : <span className="text-indigo-600 font-medium">contact@choisissons.fr</span>. Vous pouvez également introduire une réclamation auprès de la CNIL (www.cnil.fr).</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">7. Cookies</p>
                        <p>CHOISISSONS n'utilise pas de cookies publicitaires ou de traçage. Seul un cookie technique de session est utilisé pour le bon fonctionnement de l'application.</p>
                    </div>
                </div>
            ),
        },
        legal: {
            title: 'Mentions légales',
            content: (
                <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">Éditeur de la plateforme</p>
                        <p>Benjamin Colleu<br />Micro-entrepreneur — SIRET : 445 241 649 00059<br />Adresse : Dordogne (24), France<br />Contact : contact@choisissons.fr</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">Directeur de la publication</p>
                        <p>Benjamin Colleu</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">Hébergement</p>
                        <p>Frontend : Vercel Inc. — 340 Pine Street, Suite 1600, San Francisco, CA 94104, USA<br />Base de données : Supabase — serveur région West EU (Paris, France)</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">Propriété intellectuelle</p>
                        <p>Le nom et le logo CHOISISSONS sont des marques en cours de dépôt à l'INPI. Toute reproduction sans autorisation est interdite.</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">Version</p>
                        <p>Alpha — Mai 2026. Usage consultatif, non contraignant. Les votes n'ont pas de valeur juridique dans cette version.</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700 mb-1">Médiation</p>
                        <p>En cas de litige, vous pouvez recourir à la médiation de la consommation ou saisir les juridictions françaises compétentes.</p>
                    </div>
                </div>
            ),
        },
    }

    return (
        <div className="p-4">
            <div className="mb-5">
                <h1 className="text-2xl font-black text-slate-800">Mon Compte</h1>
            </div>

            {showSuccessBanner && (
                <div className="mb-4 flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-bold text-sm">Abonnement activé</span>
                        <span className="text-emerald-500 text-sm">Bienvenue dans CHOISISSONS</span>
                    </div>
                    <button
                        onClick={() => setShowSuccessBanner(false)}
                        className="text-emerald-400 hover:text-emerald-600 flex-shrink-0"
                        aria-label="Fermer"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <div className="bg-indigo-600 rounded-2xl p-5 mb-4 text-white">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center text-xl font-black shadow-lg flex-shrink-0">
                            {userInitials || <User size={24} />}
                        </div>
                        <div>
                            <p className="font-black text-lg leading-tight">{displayName}</p>
                            <p className="text-indigo-200 text-sm mt-0.5">{userEmail}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs font-semibold bg-white/20 text-white rounded-full px-2 py-0.5">
                                    {subscriptionStatus === 'active' ? subscriptionPlan.replace(/_/g, ' ') : 'Gratuit'}
                                </span>
                                <span className="text-indigo-300 text-xs">·</span>
                                <span className="text-xs text-indigo-300">{votedProposals.length} votes</span>
                                <span className="text-indigo-300 text-xs">·</span>
                                <span className="text-xs text-indigo-300">{myProposals.length} propositions</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0"
                        aria-label="Réglages"
                    >
                        <Settings size={17} className="text-white" />
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
                <h3 className="font-bold text-slate-800 text-sm mb-3">Ma commune</h3>
                {profileCommune && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
                        <Landmark size={14} className="text-indigo-500 flex-shrink-0" />
                        <span className="text-sm font-semibold text-indigo-700">{profileCommune}</span>
                    </div>
                )}
                <div className="relative mb-3">
                    <input
                        type="text"
                        value={communeQuery}
                        onChange={e => setCommuneQuery(e.target.value)}
                        placeholder="Rechercher votre commune…"
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    {communeQuery.length > 0 && (
                        <button
                            onClick={() => { setCommuneQuery(''); setCommuneResults([]) }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
                {loadingCommune && (
                    <div className="space-y-2">
                        {[1, 2].map(i => <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />)}
                    </div>
                )}
                {!loadingCommune && communeResults.length > 0 && (
                    <div className="space-y-2">
                        {communeResults.map(org => {
                            const isJoined = joinedCommuneIds.has(org.id)
                            return (
                                <div key={org.id} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-xl">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-700 truncate">{org.name}</p>
                                        {org.population != null && (
                                            <p className="text-xs text-slate-400">{org.population.toLocaleString('fr-FR')} habitants</p>
                                        )}
                                    </div>
                                    {isJoined ? (
                                        <span className="text-xs font-semibold text-emerald-600 flex-shrink-0">Membre</span>
                                    ) : (
                                        <button
                                            onClick={() => handleJoinCommune(org.id)}
                                            className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 text-white rounded-full text-xs font-semibold active:scale-95 transition-all"
                                        >
                                            Rejoindre
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
                {!loadingCommune && communeQuery.trim() && communeResults.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-3">Aucune commune trouvée</p>
                )}
                {!communeQuery.trim() && joinedCommuneIds.size === 0 && (
                    <p className="text-sm text-slate-400 text-center py-2">Recherchez et rejoignez votre commune</p>
                )}
            </div>

            {joinedCommunes.length > 0 && (
                <div className="mb-3 space-y-2">
                    {joinedCommunes.map(commune => {
                        const role = communeRoles[commune.id] ?? 'member'
                        return (
                            <div key={commune.id} className="space-y-2">
                                {commune.abonnement ? (
                                    <button
                                        onClick={() => onNavigateCommune(commune, role)}
                                        className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-indigo-600 text-white active:scale-95 transition-all shadow-sm"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Landmark size={16} className="text-indigo-200 flex-shrink-0" />
                                            <div className="text-left">
                                                <p className="text-sm font-semibold leading-tight">Voir ma commune</p>
                                                <p className="text-indigo-200 text-xs mt-0.5">{commune.name}</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-indigo-200 flex-shrink-0" />
                                    </button>
                                ) : (
                                    <div className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-100 text-slate-400">
                                        <Landmark size={16} className="flex-shrink-0" />
                                        <div className="text-left">
                                            <p className="text-sm font-medium leading-tight">{commune.name}</p>
                                            <p className="text-xs mt-0.5">Commune non encore abonnée à CHOISISSONS</p>
                                        </div>
                                    </div>
                                )}
                                {canDo(role, 'create_consultation') && commune.abonnement && (
                                    <button
                                        onClick={() => onNavigateElu(commune, role)}
                                        className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-white active:scale-95 transition-all shadow-sm"
                                        style={{ backgroundColor: '#0c447c' }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Shield size={16} className="text-blue-200 flex-shrink-0" />
                                            <div className="text-left">
                                                <p className="text-sm font-semibold leading-tight">Tableau de bord élu</p>
                                                <p className="text-blue-200 text-xs mt-0.5">{commune.name}</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-blue-200 flex-shrink-0" />
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {joinedOrgs.filter(o =>
                (o.type === 'ong' && userPlan === 'ong') ||
                (o.type === 'media' && userPlan === 'media')
            ).length > 0 && (
                <div className="mb-4 space-y-2">
                    {joinedOrgs.filter(o =>
                        (o.type === 'ong' && userPlan === 'ong') ||
                        (o.type === 'media' && userPlan === 'media')
                    ).map(org => {
                        const bgColor = org.type === 'ong' ? '#854f0b' : '#334155'
                        const icon = org.type === 'ong'
                            ? <Users size={16} className="text-amber-200 flex-shrink-0" />
                            : <Newspaper size={16} className="text-slate-300 flex-shrink-0" />
                        const sub = org.type === 'ong' ? 'ONG / Association' : 'Média'
                        return (
                            <button
                                key={org.id}
                                onClick={() => onNavigateOrg(org)}
                                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-white active:scale-95 transition-all shadow-sm"
                                style={{ backgroundColor: bgColor }}
                            >
                                <div className="flex items-center gap-3">
                                    {icon}
                                    <div className="text-left">
                                        <p className="text-sm font-semibold leading-tight">Tableau de bord {sub}</p>
                                        <p className="text-xs mt-0.5 opacity-70">{org.name}</p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="opacity-60 flex-shrink-0" />
                            </button>
                        )
                    })}
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
                <h3 className="font-bold text-slate-800 text-sm mb-3">Mes votes ({votedProposals.length})</h3>
                {loadingVotes ? (
                    <div className="space-y-2">
                        {[1, 2].map(i => <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />)}
                    </div>
                ) : votedProposals.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">Aucun vote enregistré pour le moment.</p>
                ) : (() => {
                    const byMonth = votedProposals.reduce<Record<string, typeof votedProposals>>((acc, v) => {
                        const key = v.date?.slice(0, 7) ?? 'unknown'
                        ;(acc[key] = acc[key] ?? []).push(v)
                        return acc
                    }, {})
                    const sortedMonths = Object.keys(byMonth).sort((a, b) => b.localeCompare(a))
                    const fmtMonth = (key: string) => {
                        if (key === 'unknown') return 'Date inconnue'
                        const [y, m] = key.split('-')
                        return new Date(+y, +m - 1, 1)
                            .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                            .replace(/^./, c => c.toUpperCase())
                    }
                    return (
                        <VoteMonthAccordion
                            sortedMonths={sortedMonths}
                            byMonth={byMonth}
                            fmtMonth={fmtMonth}
                        />
                    )
                })()}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
                <h3 className="font-bold text-slate-800 text-sm mb-3">Mes propositions</h3>
                {loadingMyProps ? (
                    <div className="space-y-2">
                        {[1].map(i => (
                            <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : myProposals.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">
                        Vous n'avez pas encore soumis de proposition.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {myProposals.map(p => {
                            const stageEmoji: Record<Stage, string> = {
                                seedling: '🌱', review: '🔍', voting: '🗳️', adopted: '✅', rejected: '❌', closed: '⛓️', archived: '📚', upcoming: '🗓️'
                            }
                            const soutiens = p.supports ?? 0
                            const pct = Math.min(100, (soutiens / 10) * 100)
                            return (
                                <div key={p.id} className="py-2 border-b border-slate-50 last:border-0">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm text-slate-700 font-medium flex-1 min-w-0 truncate">
                                            <span className="mr-1">{stageEmoji[p.stage]}</span>{p.title}
                                        </p>
                                        {p.stage !== 'seedling' && <StageBadge stage={p.stage} />}
                                    </div>
                                    {p.stage === 'seedling' && (
                                        <div className="mt-1.5">
                                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                                                <span className="font-medium">{soutiens} / 10 soutiens</span>
                                                {soutiens >= 10 && <span className="text-green-600 font-semibold">Objectif atteint !</span>}
                                            </div>
                                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-emerald-400'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
                <h3 className="font-bold text-slate-800 text-sm mb-3">Informations légales</h3>
                <div className="space-y-1">
                    {[
                        { key: 'cgu', label: "Conditions Générales d'Utilisation", icon: FileText },
                        { key: 'privacy', label: 'Politique de confidentialité', icon: Shield },
                        { key: 'legal', label: 'Mentions légales', icon: Landmark },
                    ].map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setShowLegal(key)}
                            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors active:scale-95 text-left"
                        >
                            <div className="flex items-center gap-2.5">
                                <Icon size={15} className="text-slate-400" />
                                <span className="text-sm text-slate-700">{label}</span>
                            </div>
                            <ChevronRight size={14} className="text-slate-300" />
                        </button>
                    ))}
                    <a
                        href="https://github.com/benjamincolleu-cloud/choisissons"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors active:scale-95"
                    >
                        <div className="flex items-center gap-2.5">
                            <ExternalLink size={15} className="text-slate-400" />
                            <span className="text-sm text-slate-700">Code source — GitHub</span>
                        </div>
                        <ChevronRight size={14} className="text-slate-300" />
                    </a>
                </div>
            </div>

            {ADMIN_EMAILS.includes(userEmail) && (
                <button
                    onClick={onNavigateAdmin}
                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-slate-900 text-white font-semibold text-sm active:scale-95 transition-all mb-3"
                >
                    <div className="flex items-center gap-3">
                        <Shield size={16} className="text-slate-300" />
                        <span>Administration</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-500" />
                </button>
            )}

            {import.meta.env.DEV && (
                <div className="mb-4 bg-yellow-50 border border-yellow-300 rounded-2xl p-4">
                    <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-2">Dev — Simuler le plan</p>
                    <p className="text-xs text-yellow-600 mb-2">Réel Supabase : <strong>{subscriptionPlan}</strong> ({subscriptionStatus})</p>
                    <select
                        value={userPlan}
                        onChange={e => setUserPlan(e.target.value as 'citoyen' | 'commune' | 'ong' | 'media')}
                        className="w-full text-sm bg-white border border-yellow-300 rounded-xl px-3 py-2 outline-none"
                    >
                        <option value="citoyen">Citoyen (défaut)</option>
                        <option value="commune">Commune</option>
                        <option value="ong">ONG / Association</option>
                        <option value="media">Média</option>
                    </select>
                </div>
            )}

            <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-200 text-red-500 font-semibold text-sm bg-white hover:bg-red-50 active:scale-95 transition-all mb-5"
            >
                <LogOut size={16} />
                Se déconnecter
            </button>

            <p className="text-center text-xs text-slate-300 pb-2">
                CHOISISSONS v1.0 — Prototype Alpha
            </p>

            {showSettings && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-end p-4">
                    <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800 text-sm">Réglages</h3>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
                            >
                                <X size={16} className="text-slate-500" />
                            </button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Bell size={16} className="text-slate-500" />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">Notifications</p>
                                        <p className="text-xs text-slate-400">Alertes votes et propositions</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setNotifEnabled(v => !v)}
                                    className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${notifEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                    role="switch"
                                    aria-checked={notifEnabled}
                                >
                                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${notifEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Globe size={16} className="text-slate-500" />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">Langue</p>
                                        <p className="text-xs text-slate-400">Interface de l'application</p>
                                    </div>
                                </div>
                                <select
                                    value={language}
                                    onChange={e => setLanguage(e.target.value)}
                                    className="text-sm font-medium text-slate-700 bg-slate-100 rounded-lg px-3 py-1.5 outline-none cursor-pointer"
                                >
                                    <option value="FR">FR — Français</option>
                                    <option value="EN">EN — English</option>
                                </select>
                            </div>
                            <div className="pt-3 border-t border-slate-100">
                                <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors active:scale-95 text-sm font-semibold">
                                    <Trash2 size={15} />
                                    Supprimer mon compte
                                </button>
                            </div>
                        </div>
                        <div className="px-5 pb-5">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm active:scale-95 transition-all"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showLegal && legalDocs[showLegal] && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-end p-4">
                    <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
                            <h3 className="font-bold text-slate-800 text-sm leading-tight pr-4">
                                {legalDocs[showLegal].title}
                            </h3>
                            <button
                                onClick={() => setShowLegal(null)}
                                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0"
                            >
                                <X size={16} className="text-slate-500" />
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1">
                            {legalDocs[showLegal].content}
                        </div>
                        <div className="px-5 pb-5 flex-shrink-0">
                            <button
                                onClick={() => setShowLegal(null)}
                                className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm active:scale-95 transition-all"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
