import { useState, useCallback, useEffect, useMemo } from 'react'
import type { ElementType } from 'react'
import { supabase } from './supabaseClient'
import CommuneRegistration from './CommuneRegistration'
import AssociationRegistration from './AssociationRegistration'
import { getSupabaseIdentity, generateVoteProof } from './lib/identity'
import { computeUrneRootHash, anchorHash } from './lib/blockchain'
import { fetchDossiersLegislatifs } from './lib/assemblee'
import {
  Home, Compass, User, Heart, Plus, ChevronRight,
  ThumbsUp, ThumbsDown, Minus, X, CheckCircle, XCircle,
  Sprout, Users, Vote, Shield, BookOpen,
  Lock, Star, Newspaper,
  Building2, ArrowLeft, Info, Landmark,
  Settings, LogOut, Bell, Globe, Trash2, ExternalLink, FileText, ArrowUpDown, TrendingUp,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────
type Stage = 'seedling' | 'review' | 'voting' | 'adopted' | 'rejected' | 'closed' | 'archived'
type VoteChoice = 'pour' | 'contre' | 'blanc'
type NavPage = 'home' | 'explore' | 'profile' | 'support' | 'impact' | 'library' | 'elu' | 'org' | 'admin' | 'commune' | 'commune-register' | 'assoc-register'

interface Argument {
  id: string
  type: 'pour' | 'contre'
  text: string
  author: string
  likes: number
}

interface Proposal {
  id: string
  title: string
  description: string
  category: string
  stage: Stage
  votes: { pour: number; contre: number; blanc: number }
  signatures: number
  targetSignatures: number
  arguments: Argument[]
  author: string
  date: string
  tags: string[]
  blockchainProof?: string
}

// ── Supabase row shape ─────────────────────────────────────────
interface ProposalRow {
  id: string
  title: string
  description: string
  category: string
  status: string
  supports: number
  votes_pour: number
  votes_contre: number
  votes_blanc: number
  tags: string[] | null
  created_at: string
  blockchain_proof?: string | null
}

function mapRowToProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    stage: (row.status as Stage) ?? 'seedling',
    votes: { pour: row.votes_pour ?? 0, contre: row.votes_contre ?? 0, blanc: row.votes_blanc ?? 0 },
    signatures: row.supports ?? 0,
    targetSignatures: 10000,
    arguments: [],
    author: 'Proposé par la communauté',
    date: row.created_at?.slice(0, 10) ?? '',
    tags: row.tags ?? [],
    blockchainProof: row.blockchain_proof ?? undefined,
  }
}

// ── Mock data ──────────────────────────────────────────────────
const PROPOSALS: Proposal[] = [
  {
    id: '1',
    title: 'Revenu universel de base à 800€/mois',
    description: "Instaurer un revenu universel de base de 800€ mensuels pour tous les citoyens français majeurs, financé par une réforme fiscale progressive.",
    category: 'Économie',
    stage: 'voting',
    votes: { pour: 0, contre: 0, blanc: 0 },
    signatures: 15000,
    targetSignatures: 10000,
    arguments: [
      { id: 'a1', type: 'pour', text: 'Élimine la pauvreté et donne à chacun la liberté de choisir son travail.', author: 'Marie L.', likes: 342 },
      { id: 'a2', type: 'pour', text: 'Soutient les artistes, entrepreneurs et aidants familiaux non rémunérés.', author: 'Thomas B.', likes: 289 },
      { id: 'a3', type: 'contre', text: 'Le coût estimé à 600 milliards pourrait déstabiliser les finances publiques.', author: 'Jean-Pierre M.', likes: 198 },
      { id: 'a4', type: 'contre', text: 'Risque de désincentiver le travail et créer une inflation sur les loyers.', author: 'Sophie R.', likes: 156 },
    ],
    author: 'Collectif RUB',
    date: '2026-01-15',
    tags: ['économie', 'social', 'travail'],
  },
  {
    id: '2',
    title: "Interdiction des pesticides en zones urbaines",
    description: "Interdire l'utilisation de pesticides chimiques à moins de 500 mètres des habitations et dans tous les espaces verts publics.",
    category: 'Environnement',
    stage: 'review',
    votes: { pour: 0, contre: 0, blanc: 0 },
    signatures: 4200,
    targetSignatures: 10000,
    arguments: [
      { id: 'b1', type: 'pour', text: 'Protège la santé des enfants et des personnes vulnérables vivant près des zones traitées.', author: 'Association Santé Verte', likes: 412 },
      { id: 'b2', type: 'pour', text: 'Favorise la biodiversité urbaine et le retour des pollinisateurs.', author: 'Dr. Camille F.', likes: 267 },
      { id: 'b3', type: 'contre', text: 'Les alternatives bio sont plus coûteuses et moins efficaces pour les communes.', author: 'Fédération Jardins', likes: 89 },
    ],
    author: 'Alliance Écologie Urbaine',
    date: '2026-02-03',
    tags: ['environnement', 'santé', 'biodiversité'],
  },
  {
    id: '3',
    title: 'Vote obligatoire avec option "Aucun des candidats"',
    description: 'Rendre le vote obligatoire en ajoutant une case "Aucun des candidats ne me convient" comptabilisée officiellement.',
    category: 'Démocratie',
    stage: 'seedling',
    votes: { pour: 0, contre: 0, blanc: 0 },
    signatures: 1840,
    targetSignatures: 10000,
    arguments: [
      { id: 'c1', type: 'pour', text: "Oblige les partis à proposer de meilleurs candidats face à un rejet officiel.", author: 'Mouvement Citoyen', likes: 534 },
      { id: 'c2', type: 'contre', text: "Le vote obligatoire est contraire à la liberté individuelle.", author: 'Collectif Libertés', likes: 201 },
    ],
    author: 'Forum Démocratie',
    date: '2026-03-10',
    tags: ['démocratie', 'élections', 'réforme'],
  },
  {
    id: '4',
    title: 'Semaine de 4 jours dans la fonction publique',
    description: "Expérimenter la semaine de travail de 4 jours dans tous les services publics pendant 2 ans avec évaluation.",
    category: 'Travail',
    stage: 'adopted',
    votes: { pour: 0, contre: 0, blanc: 0 },
    signatures: 28000,
    targetSignatures: 10000,
    arguments: [
      { id: 'd1', type: 'pour', text: "Améliore le bien-être des agents et réduit l'absentéisme de 25% selon les expériences étrangères.", author: 'Syndicat CFDT', likes: 678 },
      { id: 'd2', type: 'contre', text: "Risque de perturber la continuité du service public pour les usagers.", author: "Association Usagers", likes: 234 },
    ],
    author: 'Collectif Travail Demain',
    date: '2025-11-20',
    tags: ['travail', 'fonction publique', 'bien-être'],
  },
  {
    id: '5',
    title: 'Transparence totale des budgets municipaux',
    description: "Obligation pour toutes les communes de plus de 5 000 habitants de publier en temps réel leurs budgets et dépenses sur une plateforme unifiée.",
    category: 'Transparence',
    stage: 'voting',
    votes: { pour: 0, contre: 0, blanc: 0 },
    signatures: 12000,
    targetSignatures: 10000,
    arguments: [
      { id: 'e1', type: 'pour', text: "Lutte contre la corruption et renforce la confiance des citoyens envers leurs élus.", author: 'Transparence France', likes: 892 },
      { id: 'e2', type: 'pour', text: "Permet à chaque citoyen de comprendre où vont ses impôts locaux.", author: 'Lucas V.', likes: 445 },
      { id: 'e3', type: 'contre', text: "Coût de mise en œuvre estimé à 200 M€ pour les petites communes.", author: 'AMF', likes: 123 },
    ],
    author: 'Observatoire Citoyen',
    date: '2026-01-28',
    tags: ['transparence', 'démocratie', 'budget'],
  },
]

// ── Utilities ──────────────────────────────────────────────────

// ── Toast system ───────────────────────────────────────────────
interface ToastEntry { id: number; message: string; type: 'error' | 'warning' | 'info' }
let _toastHandler: ((entry: ToastEntry) => void) | null = null
let _toastCounter = 0
function showToast(message: string, type: 'error' | 'warning' | 'info' = 'error') {
  _toastHandler?.({ id: ++_toastCounter, message, type })
}

// ── Pending votes ──────────────────────────────────────────────
interface PendingVote { proposalId: string; userHash: string; choice: string; timestamp?: number }
function loadPendingVotes(): PendingVote[] {
  try { const raw = localStorage.getItem('pending_votes'); return raw ? (JSON.parse(raw) as PendingVote[]) : [] }
  catch { return [] }
}
function savePendingVotes(votes: PendingVote[]) {
  localStorage.setItem('pending_votes', JSON.stringify(votes))
}
async function flushPendingVotes() {
  const pending = loadPendingVotes()
  if (pending.length === 0) return
  const remaining: PendingVote[] = []
  for (const v of pending) {
    try {
      const proof = await generateVoteProof(v.proposalId, v.choice)
      const flushParams = {
        p_proposal_id: String(v.proposalId),
        p_user_hash: v.userHash,
        p_choice: v.choice,
        p_proof_hash: proof,
      }
      console.log('[deposer_bulletin] flush params:', flushParams)
      const { data, error } = await supabase.rpc('deposer_bulletin', flushParams)
      if (error) console.log('[deposer_bulletin] flush error:', error)
      // already_voted ou succès → ne pas réessayer
      if (error || (data as { error?: string } | null)?.error === 'already_voted') {
        // drop silently
      } else if (data && (data as { error?: string }).error) {
        remaining.push(v)
      }
    } catch (e) { console.log('[deposer_bulletin] flush exception:', e); remaining.push(v) }
  }
  savePendingVotes(remaining)
  if (remaining.length < pending.length) {
    showToast(`${pending.length - remaining.length} vote(s) en attente synchronisé(s).`, 'info')
  }
}

const ADMIN_EMAILS: string[] = ['benjamin@choisissons.fr', 'benjamin.colleu@gmail.com']

const VOTE_CHOICE_LABEL: Record<VoteChoice, string> = { pour: 'Pour', contre: 'Contre', blanc: 'Blanc' }
const VOTE_CHOICE_BADGE: Record<VoteChoice, string> = {
  pour: 'bg-green-100 text-green-700',
  contre: 'bg-red-100 text-red-600',
  blanc: 'bg-slate-100 text-slate-600',
}

const STAGE_CONFIG: Record<Stage, { label: string; color: string; icon: ElementType; description: string }> = {
  seedling: { label: 'Pépinière', color: 'bg-emerald-100 text-emerald-700', icon: Sprout, description: 'En cours de signatures' },
  review: { label: 'Jury citoyen', color: 'bg-amber-100 text-amber-700', icon: Users, description: 'Examinée par le jury' },
  voting: { label: 'Vote ouvert', color: 'bg-indigo-100 text-indigo-700', icon: Vote, description: 'Votez maintenant' },
  adopted: { label: 'Adoptée', color: 'bg-green-100 text-green-700', icon: CheckCircle, description: 'Proposition adoptée' },
  rejected: { label: 'Rejetée', color: 'bg-red-100 text-red-700', icon: XCircle, description: 'Proposition rejetée' },
  closed: { label: 'Clôturé', color: 'bg-teal-100 text-teal-700', icon: Lock, description: 'Vote clôturé et ancré' },
  archived: { label: 'Archivée', color: 'bg-slate-100 text-slate-700', icon: BookOpen, description: 'Proposition archivée' },
}

// ── Shared Components ──────────────────────────────────────────
function StageBadge({ stage }: { stage: Stage }) {
  const { label, color, icon: Icon } = STAGE_CONFIG[stage]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Icon size={10} />
      {label}
    </span>
  )
}

function VoteBar({ votes }: { votes: { pour: number; contre: number; blanc: number } }) {
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

// ── Toast Container ────────────────────────────────────────────
function ToastItem({ entry, onDone }: { entry: ToastEntry; onDone: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(entry.id), 4000)
    return () => clearTimeout(t)
  }, [entry.id, onDone])
  const base = 'flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg pointer-events-auto'
  const colors =
    entry.type === 'error' ? 'bg-red-600 text-white' :
      entry.type === 'warning' ? 'bg-orange-500 text-white' :
        'bg-slate-800 text-white'
  const Icon = entry.type === 'error' ? XCircle : entry.type === 'warning' ? XCircle : CheckCircle
  return (
    <div className={`${base} ${colors}`}>
      <Icon size={18} className="flex-shrink-0 mt-0.5" />
      <p className="text-sm leading-snug flex-1">{entry.message}</p>
      <button onClick={() => onDone(entry.id)} className="opacity-70 hover:opacity-100 flex-shrink-0">
        <X size={16} />
      </button>
    </div>
  )
}

function ToastContainer({ toasts, onDismiss }: { toasts: ToastEntry[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed top-4 left-0 right-0 max-w-md mx-auto px-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => <ToastItem key={t.id} entry={t} onDone={onDismiss} />)}
    </div>
  )
}

// ── Login Screen ───────────────────────────────────────────────
const WORKFLOW_STEPS = [
  {
    label: 'Pépinière',
    description: 'Proposez une idée. Elle devient publique après 10 soutiens citoyens.',
  },
  {
    label: 'Jury',
    description: '100 citoyens tirés au sort vérifient la neutralité et la légalité du texte.',
  },
  {
    label: 'Isoloir',
    description: 'Votez Pour, Contre ou Blanc. Votre vote est anonyme et chiffré SHA-256.',
  },
  {
    label: 'Décision',
    description: 'Si le quorum est atteint, la proposition devient une décision citoyenne officielle.',
  },
]

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-indigo-600 p-5 text-white text-center">
          <img src="/logo.png" alt="CHOISISSONS" className="w-16 h-16 object-contain mb-3" />
          <h2 className="text-xl font-black tracking-tight">CHOISISSONS</h2>
          <p className="text-indigo-200 text-xs mt-1">La démocratie directe citoyenne</p>
        </div>
        <div className="p-5">
          <p className="text-slate-600 text-sm leading-relaxed mb-5">
            CHOISISSONS est une plateforme indépendante qui permet à chaque citoyen de proposer,
            débattre et voter des décisions publiques. Sans partis, sans publicité, sans algorithme
            de manipulation — juste la voix du peuple.
          </p>
          <div className="space-y-3 mb-6">
            {[
              { icon: BookOpen, label: 'Transparence', desc: 'Toutes les décisions et les votes agrégés sont publics.' },
              { icon: Lock, label: 'Anonymat', desc: 'Votre vote individuel est chiffré et ne peut être tracé.' },
              { icon: Shield, label: 'Souveraineté', desc: 'Aucun acteur privé ni politique ne contrôle la plateforme.' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={14} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{label}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold text-sm active:scale-95 transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

function sha256Hex(text: string): Promise<string> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(buf =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  )
}

function isAtLeast18(dateStr: string): boolean {
  const birth = new Date(dateStr)
  const limit = new Date(birth.getFullYear() + 18, birth.getMonth(), birth.getDate())
  return new Date() >= limit
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [dateNaissance, setDateNaissance] = useState('')
  const [certifie, setCertifie] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [showAbout, setShowAbout] = useState(false)

  const formValid = email.trim() && /^\d{5}$/.test(codePostal) && dateNaissance && certifie

  const handleSendLink = async () => {
    if (!email.trim() || sending) return
    if (!/^\d{5}$/.test(codePostal)) {
      showToast('Le code postal doit contenir exactement 5 chiffres.')
      return
    }
    if (!dateNaissance) {
      showToast('Veuillez entrer votre date de naissance.')
      return
    }
    if (!isAtLeast18(dateNaissance)) {
      showToast('Vous devez avoir 18 ans minimum pour vous inscrire.')
      return
    }
    if (!certifie) {
      showToast('Vous devez cocher la case de certification.')
      return
    }
    setSending(true)
    const dateHash = await sha256Hex(dateNaissance)
    localStorage.setItem('pending_profile', JSON.stringify({
      code_postal: codePostal,
      date_naissance_hash: dateHash,
    }))
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        // No emailRedirectTo → Supabase sends a 6-digit OTP code instead of a magic link.
        // This keeps the user inside the PWA and avoids the Safari/PWA localStorage split on iPhone.
      },
    })
    if (error) {
      showToast("Impossible d'envoyer le code. Vérifiez votre adresse email.")
      setSending(false)
    } else {
      setSent(true)
      setSending(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (otp.length < 6 || verifying) return
    setVerifying(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp,
      type: 'email',
    })
    if (error) {
      showToast('Code invalide ou expiré. Vérifiez votre email.')
      setVerifying(false)
    }
    // On success, onAuthStateChange fires SIGNED_IN → login flow completes automatically
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <img src="/logo.png" alt="" className="h-32 w-auto" />
          <div className="text-left">
            <h1 className="text-4xl font-black text-white m-0">CHOISISSONS</h1>
            <p className="text-white/70 m-0 text-sm">La démocratie directe citoyenne</p>
          </div>
        </div>

        {/* Value props */}
        <div className="space-y-3 mb-8">
          {[
            { icon: Shield, text: 'Vote anonyme et vérifié cryptographiquement' },
            { icon: Users, text: 'Jury citoyen indépendant' },
            { icon: Sprout, text: 'Propositions du peuple, pour le peuple' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-indigo-200 text-sm">
              <div className="w-8 h-8 rounded-full bg-indigo-700/50 flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-indigo-300" />
              </div>
              {text}
            </div>
          ))}
        </div>

        {/* OTP form */}
        {sent ? (
          <div className="bg-white/10 rounded-2xl p-5 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={20} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">Code envoyé !</p>
                <p className="text-indigo-200 text-xs mt-0.5">
                  Consultez <span className="font-semibold text-white">{email}</span>
                </p>
              </div>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && void handleVerifyOtp()}
              placeholder="• • • • • •"
              maxLength={6}
              autoFocus
              className="w-full bg-white/10 border border-white/20 text-white placeholder-indigo-400 rounded-xl px-4 py-3.5 text-center text-2xl font-bold tracking-[0.4em] outline-none focus:ring-2 focus:ring-indigo-300 mb-3"
            />
            <button
              onClick={() => void handleVerifyOtp()}
              disabled={otp.length < 6 || verifying}
              className="w-full bg-indigo-500 text-white rounded-xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2 shadow-xl hover:bg-indigo-400 active:scale-95 transition-all disabled:opacity-50 mb-3"
            >
              {verifying
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'Vérifier le code'}
            </button>
            <button
              onClick={() => { setSent(false); setOtp('') }}
              className="w-full text-indigo-300 text-xs underline underline-offset-2 hover:text-indigo-100 transition-colors"
            >
              Changer d'adresse email
            </button>
          </div>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleSendLink()}
              placeholder="votre@email.fr"
              autoComplete="email"
              className="w-full bg-white/10 border border-white/20 text-white placeholder-indigo-300 rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 mb-3"
            />
            <input
              type="text"
              value={codePostal}
              onChange={e => setCodePostal(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="Code postal (ex : 75011)"
              inputMode="numeric"
              maxLength={5}
              className="w-full bg-white/10 border border-white/20 text-white placeholder-indigo-300 rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 mb-3"
            />
            <div className="mb-3">
              <label className="block text-indigo-200 text-xs font-medium mb-1.5">
                Date de naissance <span className="text-indigo-400">(18 ans minimum)</span>
              </label>
              <input
                type="date"
                value={dateNaissance}
                onChange={e => setDateNaissance(e.target.value)}
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().slice(0, 10)}
                className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 [color-scheme:dark]"
              />
            </div>
            <label className="flex items-start gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={certifie}
                onChange={e => setCertifie(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-indigo-400 flex-shrink-0"
              />
              <span className="text-indigo-200 text-xs leading-relaxed">
                Je certifie résider dans cette commune et voter en mon nom propre.
              </span>
            </label>
            <button
              onClick={() => void handleSendLink()}
              disabled={!formValid || sending}
              className="w-full bg-indigo-500 text-white rounded-xl py-4 px-6 font-semibold text-base flex items-center justify-center gap-3 shadow-xl hover:bg-indigo-400 active:scale-95 transition-all disabled:opacity-70"
            >
              {sending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Recevoir mon code de connexion'
              )}
            </button>
            <p className="text-center text-indigo-300/80 text-xs mt-3 leading-relaxed">
              Si vous avez déjà un compte, entrez votre email pour recevoir un nouveau code à 6 chiffres.
              Le code est valable 1 heure et fonctionne une seule fois.
            </p>
          </>
        )}

        <p className="text-center text-indigo-400 text-xs mt-3">
          Connexion sécurisée sans mot de passe · Phase 2 : FranceConnect
        </p>

        <button
          onClick={() => setShowAbout(true)}
          className="w-full text-center text-indigo-300 text-xs mt-2 underline underline-offset-2 hover:text-indigo-100 transition-colors"
        >
          En savoir plus sur CHOISISSONS
        </button>

        {/* Workflow steps */}
        <div className="mt-8 bg-white/5 rounded-2xl p-4">
          <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-3">Comment ça marche</p>
          <div className="flex items-center justify-between text-xs text-indigo-200 mb-2">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <button
                  onClick={() => setActiveStep(activeStep === i ? null : i)}
                  className="text-center group"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-1 transition-colors ${activeStep === i ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white group-hover:bg-indigo-400'
                    }`}>
                    {i + 1}
                  </div>
                  <span className={activeStep === i ? 'text-white font-semibold' : ''}>{step.label}</span>
                </button>
                {i < 3 && <ChevronRight size={12} className="text-indigo-500 mx-1" />}
              </div>
            ))}
          </div>
          {activeStep !== null && (
            <div className="mt-3 bg-indigo-900/60 rounded-xl px-3 py-2.5 border border-indigo-700/50">
              <p className="text-indigo-100 text-xs leading-relaxed">
                <span className="font-semibold text-white">{WORKFLOW_STEPS[activeStep].label} — </span>
                {WORKFLOW_STEPS[activeStep].description}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-indigo-600 text-xs mt-8">
          © 2026 CHOISISSONS — Mentions légales · Confidentialité
        </p>
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  )
}

// ── Agora Modal ────────────────────────────────────────────────
function AgoraModal({ proposal, onVote, onClose, hasVoted }: {
  proposal: Proposal
  onVote: () => void
  onClose: () => void
  hasVoted?: boolean
}) {
  const pourArgs = proposal.arguments.filter(a => a.type === 'pour')
  const contreArgs = proposal.arguments.filter(a => a.type === 'contre')

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-100 flex-shrink-0">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
          <X size={18} className="text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Agora — Débat citoyen</p>
          <h2 className="font-bold text-slate-800 text-sm leading-tight truncate">{proposal.title}</h2>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0">
        <p className="text-sm text-slate-600 leading-relaxed">{proposal.description}</p>
        <div className="flex gap-2 mt-2 flex-wrap">
          {proposal.tags.map(tag => (
            <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">#{tag}</span>
          ))}
        </div>
      </div>

      {/* Arguments */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Pour */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
              <ThumbsUp size={12} className="text-green-600" />
            </div>
            <h3 className="font-semibold text-green-700 text-sm">Arguments Pour ({pourArgs.length})</h3>
          </div>
          <div className="space-y-2">
            {pourArgs.map(arg => (
              <div key={arg.id} className="bg-green-50 border border-green-100 rounded-xl p-3">
                <p className="text-sm text-slate-700 leading-relaxed">{arg.text}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-slate-400">{arg.author}</span>
                  <span className="text-xs text-green-600 font-medium">+{arg.likes}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contre */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
              <ThumbsDown size={12} className="text-red-500" />
            </div>
            <h3 className="font-semibold text-red-600 text-sm">Arguments Contre ({contreArgs.length})</h3>
          </div>
          <div className="space-y-2">
            {contreArgs.map(arg => (
              <div key={arg.id} className="bg-red-50 border border-red-100 rounded-xl p-3">
                <p className="text-sm text-slate-700 leading-relaxed">{arg.text}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-slate-400">{arg.author}</span>
                  <span className="text-xs text-red-500 font-medium">+{arg.likes}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      {proposal.stage === 'voting' && (
        <div className="p-4 border-t border-slate-100 bg-white flex-shrink-0">
          {hasVoted ? (
            <div className="w-full bg-slate-100 text-slate-400 rounded-xl py-4 font-semibold flex items-center justify-center gap-2">
              <Vote size={18} />
              Vous avez déjà voté
            </div>
          ) : (
            <button
              onClick={onVote}
              className="w-full bg-indigo-600 text-white rounded-xl py-4 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all"
            >
              <Vote size={18} />
              Entrer dans l'isoloir
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Voting Booth ───────────────────────────────────────────────
function VotingBooth({ proposal, onVoted, onClose }: {
  proposal: Proposal
  onVoted: (choice: VoteChoice, hash: string) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<VoteChoice | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [voted, setVoted] = useState(false)
  const [hash, setHash] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!selected) return
    setLoading(true)
    const voteHash = await generateVoteProof(proposal.id, selected)
    setHash(voteHash)
    setVoted(true)
    setLoading(false)
    setTimeout(() => onVoted(selected, voteHash), 2500)
  }

  const voteOptions: {
    choice: VoteChoice
    label: string
    icon: React.ReactNode
    selectedColor: string
    selectedBg: string
    selectedBorder: string
  }[] = [
      { choice: 'pour', label: 'Pour', icon: <ThumbsUp size={28} />, selectedColor: 'text-green-600', selectedBg: 'bg-green-50', selectedBorder: 'border-green-400' },
      { choice: 'contre', label: 'Contre', icon: <ThumbsDown size={28} />, selectedColor: 'text-red-500', selectedBg: 'bg-red-50', selectedBorder: 'border-red-400' },
      { choice: 'blanc', label: 'Blanc', icon: <Minus size={28} />, selectedColor: 'text-slate-500', selectedBg: 'bg-slate-50', selectedBorder: 'border-slate-400' },
    ]

  if (voted) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-8">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <CheckCircle size={40} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Vote enregistré</h2>
        <p className="text-slate-500 text-sm text-center mb-6">
          Votre bulletin est anonyme et cryptographiquement signé.
        </p>
        <div className="w-full bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-400 mb-1 font-mono">Preuve de vote (SHA-256)</p>
          <p className="text-xs font-mono text-slate-600 break-all">{hash}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-100 flex-shrink-0">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Isoloir</p>
          <h2 className="font-bold text-slate-800 text-sm leading-tight truncate">{proposal.title}</h2>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
          <Lock size={22} className="text-indigo-600" />
        </div>
        <h3 className="text-xl font-black text-slate-800 mb-1">Votre vote est secret</h3>
        <p className="text-slate-500 text-sm text-center mb-8">
          Aucune donnée personnelle n'est associée à votre bulletin.
        </p>

        <div className="w-full max-w-xs space-y-3">
          {voteOptions.map(({ choice, label, icon, selectedColor, selectedBg, selectedBorder }) => {
            const active = selected === choice
            return (
              <button
                key={choice}
                onClick={() => setSelected(choice)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-95 ${active
                  ? `${selectedBg} ${selectedBorder} ${selectedColor}`
                  : 'bg-white border-slate-200 text-slate-400'
                  }`}
              >
                <span className={active ? selectedColor : 'text-slate-300'}>{icon}</span>
                <span className={`text-lg font-bold ${active ? selectedColor : 'text-slate-500'}`}>{label}</span>
                {active && <CheckCircle size={20} className="ml-auto" />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4 border-t border-slate-100 flex-shrink-0">
        <button
          onClick={() => selected && setConfirming(true)}
          disabled={!selected || loading}
          className="w-full bg-indigo-600 text-white rounded-xl py-4 font-semibold disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
        >
          Confirmer mon vote
        </button>
      </div>

      {/* Confirmation sheet */}
      {confirming && (
        <div className="fixed inset-0 bg-black/50 flex items-end p-4" style={{ zIndex: 60 }}>
          <div className="w-full bg-white rounded-3xl p-6">
            <h3 className="text-xl font-black text-slate-800 mb-2">Confirmer ?</h3>
            <p className="text-slate-500 text-sm mb-1">
              Vous votez{' '}
              <strong className={
                selected === 'pour' ? 'text-green-600' :
                  selected === 'contre' ? 'text-red-500' : 'text-slate-500'
              }>
                {selected?.toUpperCase()}
              </strong>{' '}
              pour :
            </p>
            <p className="text-slate-700 font-medium text-sm mb-4">{proposal.title}</p>
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-5">
              Ce vote est définitif et ne peut pas être modifié.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold flex items-center justify-center gap-2"
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : 'Voter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Results Modal ─────────────────────────────────────────────
function ResultsModal({ proposalId, onClose }: { proposalId: string; onClose: () => void }) {
  const [votes, setVotes] = useState({ pour: 0, contre: 0, blanc: 0 })
  const [loading, setLoading] = useState(true)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchResults() {
      try {
        const { data, error } = await supabase
          .from('proposals')
          .select('votes_pour, votes_contre, votes_blanc')
          .eq('id', proposalId)
          .single()
        if (error) throw error
        if (!cancelled && data) {
          setVotes({
            pour: (data as { votes_pour: number }).votes_pour ?? 0,
            contre: (data as { votes_contre: number }).votes_contre ?? 0,
            blanc: (data as { votes_blanc: number }).votes_blanc ?? 0,
          })
        }
      } catch { /* keep zeros */ }
      finally {
        if (!cancelled) {
          setLoading(false)
          setTimeout(() => setAnimated(true), 60)
        }
      }
    }
    fetchResults()
    return () => { cancelled = true }
  }, [proposalId])

  const total = votes.pour + votes.contre + votes.blanc
  const pourPct = total > 0 ? Math.round((votes.pour / total) * 100) : 0
  const contrePct = total > 0 ? Math.round((votes.contre / total) * 100) : 0
  const blancPct = 100 - pourPct - contrePct

  const bars = [
    { label: 'Pour', pct: pourPct, color: 'bg-green-500', textColor: 'text-green-600', count: votes.pour },
    { label: 'Contre', pct: contrePct, color: 'bg-red-400', textColor: 'text-red-500', count: votes.contre },
    { label: 'Vote blanc', pct: blancPct, color: 'bg-slate-300', textColor: 'text-slate-500', count: votes.blanc },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={18} className="text-green-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Votre vote a été enregistré</p>
              <p className="text-xs text-slate-400">Résultats en temps réel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* Bars */}
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="space-y-5">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2 animate-pulse">
                  <div className="flex justify-between">
                    <div className="h-3 bg-slate-100 rounded w-16" />
                    <div className="h-3 bg-slate-100 rounded w-8" />
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {bars.map(({ label, pct, color, textColor, count }) => (
                <div key={label}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className={`text-sm font-semibold ${textColor}`}>{label}</span>
                    <span className={`text-xl font-black ${textColor}`}>{pct}%</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full transition-all duration-700 ease-out`}
                      style={{ width: animated ? `${pct}%` : '0%' }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {count.toLocaleString('fr-FR')} vote{count !== 1 ? 's' : ''}
                  </p>
                </div>
              ))}

              <div className="pt-3 border-t border-slate-100 text-center">
                <p className="text-sm text-slate-500">
                  <span className="font-bold text-slate-700">{total.toLocaleString('fr-FR')}</span>{' '}
                  vote{total !== 1 ? 's' : ''} exprimé{total !== 1 ? 's' : ''} au total
                </p>
              </div>
            </>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm active:scale-95 transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Proposal Card ──────────────────────────────────────────────
function ProposalCard({ proposal, onOpen, currentVote, onRevote, hasAlreadyVoted }: {
  proposal: Proposal
  onOpen: () => void
  currentVote?: VoteChoice
  onRevote?: () => void
  hasAlreadyVoted?: boolean
}) {
  const total = proposal.votes.pour + proposal.votes.contre + proposal.votes.blanc
  const progress = Math.min((proposal.signatures / proposal.targetSignatures) * 100, 100)

  // Stable pseudo-random juror count derived from proposal id (20–80)
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

        {/* Organisation author badge */}
        {proposal.author && proposal.author !== 'Proposé par la communauté' && (
          <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 rounded-full px-2.5 py-1 mb-3">
            <Building2 size={11} />
            <span className="text-xs font-medium">{proposal.author}</span>
          </div>
        )}

        {/* Signatures progress — seedling only */}
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

        {/* Jury validation progress — review only */}
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

        {/* Vote results */}
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
            {currentVote && (
              <button
                onClick={onRevote}
                className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors active:scale-95"
              >
                Changer mon vote
              </button>
            )}
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

// ── Parliamentary Laws data ────────────────────────────────────
interface ParliamentaryLaw {
  id: string
  number: string
  title: string
  description: string
  category: string
  stage: Stage
  parliamentVoteDate: string
  votes: { pour: number; contre: number; blanc: number }
  tags: string[]
  officialUrl: string
}

const PARLIAMENTARY_LAWS_INITIAL: ParliamentaryLaw[] = [
  {
    id: 'law-1',
    number: 'n°324',
    title: 'PLF 2026 — Projet de Loi de Finances',
    description: "Définit le budget de l'État pour 2026 : dépenses publiques, recettes fiscales et réforme de la TVA sur les produits de première nécessité. Enveloppe totale : 492 milliards d'euros.",
    category: 'Économie',
    stage: 'voting',
    parliamentVoteDate: '22 avril 2026',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['budget', 'fiscalité', 'économie'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/16/textes/l16b0324_projet-loi',
  },
  {
    id: 'law-2',
    number: 'n°187',
    title: "Loi sur l'IA et la souveraineté numérique",
    description: "Encadre l'intelligence artificielle dans les services publics et les entreprises. Crée une autorité nationale de régulation des algorithmes et impose la transparence des modèles d'IA utilisés par l'État.",
    category: 'Numérique',
    stage: 'voting',
    parliamentVoteDate: '8 mai 2026',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['IA', 'numérique', 'souveraineté'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/16/textes/l16b0187_projet-loi',
  },
  {
    id: 'law-3',
    number: 'n°256',
    title: 'Réforme des retraites complémentaires',
    description: "Modernise le système AGIRC-ARRCO. Révise les règles de cotisation et d'acquisition de points pour les salariés du secteur privé, avec un ajustement de l'âge de liquidation à taux plein.",
    category: 'Social',
    stage: 'review',
    parliamentVoteDate: '17 juin 2026',
    votes: { pour: 0, contre: 0, blanc: 0 },
    tags: ['retraites', 'social', 'travail'],
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/16/dossiers/retraites_complementaires',
  },
]

function lawToProposal(law: ParliamentaryLaw): Proposal {
  return {
    id: law.id,
    title: law.title,
    description: law.description,
    category: law.category,
    stage: law.stage,
    votes: law.votes,
    signatures: 0,
    targetSignatures: 10000,
    arguments: [],
    author: 'Assemblée Nationale',
    date: law.parliamentVoteDate,
    tags: law.tags,
  }
}

// ── Law Card ───────────────────────────────────────────────────
function LawCard({ law, onOpen }: { law: ParliamentaryLaw; onOpen: () => void }) {
  const total = law.votes.pour + law.votes.contre + law.votes.blanc

  const voteDate = law.parliamentVoteDate ? new Date(law.parliamentVoteDate) : null
  let daysLeft = -1
  if (voteDate && !isNaN(voteDate.getTime())) {
    const deadline = new Date(voteDate)
    deadline.setDate(deadline.getDate() + 7)
    daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 3600 * 24))
  }

  const isClosed = law.stage === 'closed' || law.stage === 'archived'

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-4">
        {/* Badges row */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {isClosed ? (
            <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-0.5 flex items-center gap-1">
              <Lock size={12} /> Vote terminé
            </span>
          ) : (
            <span className="text-xs font-bold text-white bg-[#002395] rounded-full px-2.5 py-0.5 flex items-center gap-1">
              <Vote size={12} /> Vote ouvert {daysLeft >= 0 && `(J-${daysLeft})`}
            </span>
          )}
          <span className="text-xs font-semibold text-slate-400">{law.number}</span>
          <span className="ml-auto text-xs text-slate-400">{law.category}</span>
        </div>

        <h3 className="font-bold text-slate-800 text-base leading-snug mb-1">{law.title}</h3>
        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mb-3">{law.description}</p>

        {/* Vote date + texte officiel */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <BookOpen size={12} className="text-slate-400" />
            <span>Vote Parlement : <strong className="text-slate-700">{
              law.parliamentVoteDate && !isNaN(voteDate?.getTime() ?? NaN)
                ? voteDate!.toLocaleDateString('fr-FR')
                : (law.parliamentVoteDate || 'À venir')
            }</strong></span>
          </div>
          <a
            href={law.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-[#002395] font-semibold border border-[#002395]/30 rounded-full px-2 py-0.5 hover:bg-blue-50 transition-colors active:scale-95"
          >
            <ArrowLeft size={10} className="rotate-[135deg]" />
            Texte officiel
          </a>
        </div>
        <p className="text-xs text-slate-400 mb-3">Source : Assemblée Nationale officielle</p>

        {/* Results */}
        {isClosed ? (
          <div className="flex gap-4 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="flex-[0.8]">
              <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Assemblée Nat.</p>
              <div className="flex items-center gap-2 mt-1">
                <Landmark size={14} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-700">Texte voté</span>
              </div>
            </div>
            <div className="w-px bg-slate-200" />
            <div className="flex-[1.2]">
              <p className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Citoyens ({total.toLocaleString('fr-FR')})</p>
              {total > 0 ? <VoteBar votes={law.votes} /> : <p className="text-xs text-slate-400 mt-2">Aucun vote</p>}
            </div>
          </div>
        ) : (
          <>
            {total > 0 && <VoteBar votes={law.votes} />}
            {total > 0 && (
              <p className="text-xs text-slate-400 mt-1">{total.toLocaleString('fr-FR')} avis citoyens</p>
            )}
          </>
        )}
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={onOpen}
          className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${isClosed
            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            : 'bg-[#002395] text-white shadow-md shadow-blue-200'
            }`}
        >
          {isClosed ? <Info size={15} /> : <Vote size={15} />}
          {isClosed ? "Voir les résultats" : "Lire & Voter"}
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Home Page ──────────────────────────────────────────────────
function HomePage({ initialCategory, userHash }: { initialCategory?: string; userHash: string }) {
  // ── Tab state ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'lois' | 'propositions'>(
    initialCategory ? 'propositions' : 'lois'
  )

  // ── Propositions citoyennes state ──────────────────────────────
  const [proposals, setProposals] = useState<Proposal[]>(PROPOSALS)
  const [loading, setLoading] = useState(true)
  const [activeStage, setActiveStage] = useState<Stage | 'all'>('all')
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory ?? null)
  const [agoraProposal, setAgoraProposal] = useState<Proposal | null>(null)
  const [votingProposal, setVotingProposal] = useState<Proposal | null>(null)
  const [votedChoices, setVotedChoices] = useState<Record<string, VoteChoice>>({})
  const [resultsProposalId, setResultsProposalId] = useState<string | null>(null)

  // ── Lois en cours state ────────────────────────────────────────
  const [laws, setLaws] = useState<ParliamentaryLaw[]>(PARLIAMENTARY_LAWS_INITIAL)
  const [lawVotedIds, setLawVotedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('law_voted_ids')
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch { return new Set() }
  })
  const [agoraLaw, setAgoraLaw] = useState<Proposal | null>(null)
  const [votingLaw, setVotingLaw] = useState<Proposal | null>(null)
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())

  // Fetch lois from Assemblée Nationale API, fall back to hardcoded data silently
  useEffect(() => {
    let cancelled = false
    fetchDossiersLegislatifs().then(anLaws => {
      if (!cancelled && anLaws.length > 0) {
        setLaws(anLaws as ParliamentaryLaw[])
      }
    })
    return () => { cancelled = true }
  }, [])

  // Fetch from Supabase, fall back to mock data on error
  useEffect(() => {
    let cancelled = false
    async function fetchProposals() {
      try {
        const { data, error } = await supabase
          .from('proposals')
          .select('id,title,description,category,status,supports,votes_pour,votes_contre,votes_blanc,tags,created_at,blockchain_proof')
          .order('created_at', { ascending: false })
          .limit(100)
        if (error) throw error
        if (!cancelled && data && data.length > 0) {
          setProposals((data as ProposalRow[]).map(mapRowToProposal))
        }
      } catch {
        showToast('Impossible de charger les propositions. Vérifiez votre connexion.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchProposals()
    return () => { cancelled = true }
  }, [])

  // Hydrate voted IDs on mount so the "already voted" state survives page reloads.
  // Choices are not fetched — votes are anonymous by design.
  useEffect(() => {
    if (!userHash) return
    let cancelled = false
    supabase.rpc('get_my_votes', { p_user_hash: userHash }).then(({ data }) => {
      if (!cancelled && data) {
        setVotedIds(new Set((data as { proposal_id: string | number }[]).map(r => String(r.proposal_id))))
      }
    })
    return () => { cancelled = true }
  }, [userHash])

  const filtered = useMemo(() =>
    proposals.filter(p => {
      const stageOk = activeStage === 'all' || p.stage === activeStage
      const categoryOk = !activeCategory || p.category === activeCategory
      return stageOk && categoryOk
    }),
    [proposals, activeStage, activeCategory])

  const handleVoted = useCallback(async (proposalId: string, choice: VoteChoice, oldChoice?: VoteChoice) => {
    const isRevote = oldChoice !== undefined
    setVotingProposal(null)
    setAgoraProposal(null)

    const choiceMap: Record<VoteChoice, string> = {
      pour: 'YES', contre: 'NO', blanc: 'ABSTAIN',
    }
    const mappedChoice = choiceMap[choice]

    // Optimistic UI update — applies immediately so the user gets instant feedback
    // even if the network is slow or offline.
    setVotedChoices(prev => ({ ...prev, [proposalId]: choice }))
    setProposals(prev =>
      prev.map(p => {
        if (p.id !== proposalId) return p
        const newVotes = { ...p.votes, [choice]: p.votes[choice] + 1 }
        if (isRevote && oldChoice) newVotes[oldChoice] = Math.max(0, newVotes[oldChoice] - 1)
        return { ...p, votes: newVotes }
      })
    )

    const proof = await generateVoteProof(proposalId, mappedChoice)
    const voteParams = {
      p_proposal_id: String(proposalId),
      p_user_hash: userHash,
      p_choice: mappedChoice,
      p_proof_hash: proof,
    }
    console.log('[deposer_bulletin] params:', voteParams)

    try {
      const { error } = await supabase.rpc('deposer_bulletin', voteParams)
      if (error) console.log('[deposer_bulletin] error:', error)

      if (error) {
        // DB failed — queue for later sync. UI stays updated (optimistic).
        const pending = loadPendingVotes()
        if (!pending.some(v => v.proposalId === proposalId)) {
          savePendingVotes([...pending, { proposalId, userHash, choice: mappedChoice, timestamp: Date.now() }])
        }
        showToast('Réseau faible. Vote sauvegardé et synchronisé à la prochaine connexion.', 'warning')
        return
      }

      // DB confirmed — show bonus feedback
      if (isRevote) {
        showToast('Vote mis à jour ✓', 'info')
      } else {
        setResultsProposalId(proposalId)
      }
    } catch (e) {
      console.log('[deposer_bulletin] exception:', e)
      const pending = loadPendingVotes()
      if (!pending.some(v => v.proposalId === proposalId)) {
        savePendingVotes([...pending, { proposalId, userHash, choice: mappedChoice, timestamp: Date.now() }])
      }
      showToast('Réseau faible. Vote sauvegardé et synchronisé à la prochaine connexion.', 'warning')
    }
  }, [userHash])

  const handleLawVoted = useCallback(async (lawId: string, choice: VoteChoice) => {
    const targetLaw = laws.find(l => l.id === lawId)
    const anId = (targetLaw as any)?.uid || (targetLaw as any)?.reference || targetLaw?.number || lawId

    // 1. Mise à jour Optimiste immédiate
    setLawVotedIds(prev => {
      const next = new Set([...prev, lawId])
      try { localStorage.setItem('law_voted_ids', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })

    setLaws(prev =>
      prev.map(l =>
        (l.id === lawId || l.number === lawId)
          ? { ...l, votes: { ...l.votes, [choice]: l.votes[choice] + 1 } }
          : l
      )
    )

    setVotingLaw(null)
    setAgoraLaw(null)

    // 2. Préparation des données pour Supabase
    const choiceMap: Record<VoteChoice, string> = {
      pour: 'YES', contre: 'NO', blanc: 'ABSTAIN',
    }
    const mappedChoice = choiceMap[choice]

    try {
      const proof = await generateVoteProof(anId, mappedChoice)

      const voteParams = {
        p_proposal_id: String(anId),
        p_user_hash: userHash,
        p_choice: mappedChoice,
        p_proof_hash: proof,
      }

      console.log('[deposer_bulletin_loi] params:', voteParams)

      // 3. Envoi sécurisé
      const { error } = await supabase.rpc('deposer_bulletin', voteParams)

      if (error) {
        console.log('[deposer_bulletin_loi] error:', error)
        showToast('Réseau faible. Vote sauvegardé localement.', 'warning')
        return
      }

      showToast('Votre avis a bien été enregistré ✓', 'info')

    } catch (e) {
      console.log('[deposer_bulletin_loi] exception:', e)
      showToast('Erreur de connexion. Vote sauvegardé localement.', 'warning')
    }
  }, [userHash, laws])

  const filters: { value: Stage | 'all'; label: string }[] = [
    { value: 'all', label: 'Toutes' },
    { value: 'seedling', label: 'Pépinière' },
    { value: 'review', label: 'Jury' },
    { value: 'voting', label: 'Vote' },
    { value: 'adopted', label: 'Adoptées' },
  ]

  return (
    <>
      <div className="p-4">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-black text-slate-800">Démocratie</h1>
          <p className="text-slate-500 text-sm">Citoyenne, citoyen — votre voix compte.</p>
        </div>

        {/* Main tabs */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setActiveTab('lois')}
            className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'lois'
              ? 'bg-[#002395] text-white shadow-lg shadow-blue-200'
              : 'bg-slate-100 text-slate-500'
              }`}
          >
            🏛 Lois en cours
          </button>
          <button
            onClick={() => setActiveTab('propositions')}
            className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'propositions'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
              : 'bg-slate-100 text-slate-500'
              }`}
          >
            ✊ Propositions citoyennes
          </button>
        </div>

        {/* ── TAB : Lois en cours ─────────────────────────────── */}
        {activeTab === 'lois' && (
          <>
            {/* Parliament banner */}
            <div className="bg-[#002395] rounded-2xl p-4 mb-5 text-white">
              <div className="flex items-start gap-3">
                <Landmark size={20} className="text-blue-200 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm mb-0.5">Ces lois sont actuellement débattues au Parlement.</p>
                  <p className="text-blue-200 text-xs leading-relaxed">Votre avis compte. Exprimez-vous avant le vote.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {laws.filter(l => l.stage !== 'archived').map(law => (
                <LawCard
                  key={law.id}
                  law={law}
                  onOpen={() => setAgoraLaw(lawToProposal(law))}
                />
              ))}
            </div>
          </>
        )}

        {/* ── TAB : Propositions citoyennes ───────────────────── */}
        {activeTab === 'propositions' && (
          <>
            {/* Stats banner */}
            <div className="bg-indigo-600 rounded-2xl p-4 mb-5 text-white">
              <div className="flex justify-around">
                {[
                  { value: proposals.length, label: 'propositions' },
                  { value: proposals.filter(p => p.stage === 'voting').length, label: 'en vote' },
                  { value: proposals.filter(p => p.stage === 'adopted').length, label: 'adoptées' },
                ].map(({ value, label }) => (
                  <div key={label} className="text-center">
                    <div className="text-2xl font-black">{value}</div>
                    <div className="text-indigo-200 text-xs">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active category badge */}
            {activeCategory && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-500">Catégorie :</span>
                <span className="flex items-center gap-1.5 bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                  {activeCategory}
                  <button onClick={() => setActiveCategory(null)} className="hover:text-indigo-900">
                    <X size={11} />
                  </button>
                </span>
              </div>
            )}

            {/* Stage filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: 'none' }}>
              {filters.map(f => (
                <button
                  key={f.value}
                  onClick={() => setActiveStage(f.value)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${activeStage === f.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* List */}
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 animate-pulse">
                    <div className="flex gap-2">
                      <div className="h-5 w-20 bg-slate-100 rounded-full" />
                      <div className="h-5 w-16 bg-slate-100 rounded-full ml-auto" />
                    </div>
                    <div className="h-4 bg-slate-100 rounded-lg w-3/4" />
                    <div className="h-3 bg-slate-100 rounded-lg w-full" />
                    <div className="h-3 bg-slate-100 rounded-lg w-2/3" />
                    <div className="h-9 bg-slate-100 rounded-xl mt-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map(proposal => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    onOpen={() => setAgoraProposal(proposal)}
                    currentVote={votedChoices[proposal.id]}
                    hasAlreadyVoted={votedIds.has(proposal.id)}
                    onRevote={() => setVotingProposal(proposal)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modales Propositions citoyennes ─────────────────────── */}
      {agoraProposal && !votingProposal && (
        <AgoraModal
          proposal={agoraProposal}
          onVote={() => setVotingProposal(agoraProposal)}
          onClose={() => setAgoraProposal(null)}
          hasVoted={agoraProposal.id in votedChoices}
        />
      )}
      {votingProposal && (
        <VotingBooth
          proposal={votingProposal}
          onVoted={(choice) => handleVoted(votingProposal.id, choice, votedChoices[votingProposal.id])}
          onClose={() => setVotingProposal(null)}
        />
      )}

      {/* ── Modales Lois en cours ────────────────────────────────── */}
      {agoraLaw && !votingLaw && (
        <AgoraModal
          proposal={agoraLaw}
          onVote={() => setVotingLaw(agoraLaw)}
          onClose={() => setAgoraLaw(null)}
          hasVoted={lawVotedIds.has(agoraLaw.id)}
        />
      )}
      {votingLaw && (
        <VotingBooth
          proposal={votingLaw}
          onVoted={(choice, hash) => { void hash; handleLawVoted(votingLaw.id, choice) }}
          onClose={() => setVotingLaw(null)}
        />
      )}

      {/* ── Résultats après vote ────────────────────────────────── */}
      {resultsProposalId && (
        <ResultsModal
          proposalId={resultsProposalId}
          onClose={() => setResultsProposalId(null)}
        />
      )}
    </>
  )
}

// ── Organisation types ─────────────────────────────────────────
interface Organisation {
  id: string
  name: string
  type: 'commune' | 'ong' | 'media'
  description: string
  population?: number
  code_insee?: string
  abonnement?: boolean
}

type CommuneRole = 'member' | 'admin' | 'elu' | 'agent_com' | 'lecteur_admin'
type CommuneAction = 'create_consultation' | 'publish_news' | 'publish_agenda' | 'publish_editorial' | 'upload_bulletin' | 'manage_members' | 'view_stats'

function canDo(role: CommuneRole, action: CommuneAction): boolean {
  const matrix: Record<CommuneAction, CommuneRole[]> = {
    create_consultation: ['admin', 'elu'],
    publish_news: ['admin', 'elu', 'agent_com'],
    publish_agenda: ['admin', 'elu', 'agent_com'],
    publish_editorial: ['admin', 'elu'],
    upload_bulletin: ['admin', 'agent_com'],
    manage_members: ['admin'],
    view_stats: ['admin', 'elu', 'agent_com', 'lecteur_admin'],
  }
  return matrix[action]?.includes(role) ?? false
}

interface CommuneNews {
  id: string
  organisation_id: string
  title: string
  content: string
  category: 'info' | 'travaux' | 'evenement' | 'urgence'
  author_name?: string
  published_at: string
  created_by?: string
  is_published: boolean
}

interface CommuneEvent {
  id: string
  organisation_id: string
  title: string
  description?: string
  event_date: string
  end_date?: string
  location?: string
  category: 'conseil' | 'fete' | 'marche' | 'reunion' | 'autre'
  created_by?: string
  is_published: boolean
}

const MOCK_ORGANISATIONS: Organisation[] = [
  { id: 'org-1', name: 'Paris 11e', type: 'commune', description: 'Mairie du 11e arrondissement de Paris', population: 152000 },
  { id: 'org-2', name: 'Lyon 3e', type: 'commune', description: 'Mairie du 3e arrondissement de Lyon', population: 47000 },
  { id: 'org-3', name: 'Bordeaux Centre', type: 'commune', description: 'Mairie centrale de Bordeaux', population: 62000 },
  { id: 'org-4', name: 'Greenpeace France', type: 'ong', description: "Organisation internationale de protection de l'environnement" },
  { id: 'org-5', name: 'Amnesty International France', type: 'ong', description: 'Défense des droits humains à travers le monde' },
  { id: 'org-6', name: 'Le Monde', type: 'media', description: 'Quotidien national de référence' },
  { id: 'org-7', name: 'Mediapart', type: 'media', description: 'Journal d\'investigation en ligne' },
]

function ExplorePage({ onSelectCategory: _onSelectCategory, userHash, onNavigateCommuneRegister, onNavigateAssocRegister }: {
  onSelectCategory: (cat: string) => void
  userHash: string
  onNavigateCommuneRegister: () => void
  onNavigateAssocRegister: () => void
}) {
  const [exploreTab, setExploreTab] = useState<'discover' | 'organisations'>('discover')

  // Discover tab state
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<Stage | null>('voting')
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent')
  const [loadingData, setLoadingData] = useState(true)
  const [allProposals, setAllProposals] = useState<Proposal[]>(PROPOSALS)

  // Voting flow state
  const [agoraProposal, setAgoraProposal] = useState<Proposal | null>(null)
  const [votingProposal, setVotingProposal] = useState<Proposal | null>(null)
  const [votedChoices, setVotedChoices] = useState<Record<string, VoteChoice>>({})
  const [resultsProposalId, setResultsProposalId] = useState<string | null>(null)
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())

  // Organisations tab state
  const [orgSubTab, setOrgSubTab] = useState<'commune' | 'ong' | 'media'>('commune')
  const [organisations, setOrganisations] = useState<Organisation[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [followedOrgIds, setFollowedOrgIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function fetchExploreData() {
      try {
        const { data, error } = await supabase
          .from('proposals')
          .select('id,title,description,category,status,supports,votes_pour,votes_contre,votes_blanc,tags,created_at,blockchain_proof')
          .order('created_at', { ascending: false })
          .limit(100)
        if (error) throw error
        if (!cancelled && data && data.length > 0) {
          setAllProposals((data as ProposalRow[]).map(mapRowToProposal))
        }
      } catch {
        // keep PROPOSALS fallback
      } finally {
        if (!cancelled) setLoadingData(false)
      }
    }
    fetchExploreData()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!userHash) return
    let cancelled = false
    supabase.rpc('get_my_votes', { p_user_hash: userHash }).then(({ data }) => {
      if (!cancelled && data) {
        setVotedIds(new Set((data as { proposal_id: string | number }[]).map(r => String(r.proposal_id))))
      }
    })
    return () => { cancelled = true }
  }, [userHash])

  // Fetch organisations by sub-tab type + existing follows
  useEffect(() => {
    if (exploreTab !== 'organisations') return
    let cancelled = false
    async function fetchOrgs() {
      setLoadingOrgs(true)
      try {
        const [orgsRes, followsRes] = await Promise.all([
          supabase.from('organisations').select('id,name,type,description,population').eq('type', orgSubTab),
          supabase.from('citizen_organisations').select('organisation_id').eq('user_hash', userHash),
        ])
        if (orgsRes.error) throw orgsRes.error
        if (!cancelled) {
          if (orgsRes.data && orgsRes.data.length > 0) {
            setOrganisations(orgsRes.data as Organisation[])
          } else {
            setOrganisations(MOCK_ORGANISATIONS.filter(o => o.type === orgSubTab))
          }
          if (followsRes.data) {
            setFollowedOrgIds(new Set(followsRes.data.map((r: { organisation_id: string }) => r.organisation_id)))
          }
        }
      } catch {
        if (!cancelled) showToast('Une erreur est survenue. Réessayez.')
      } finally {
        if (!cancelled) setLoadingOrgs(false)
      }
    }
    fetchOrgs()
    return () => { cancelled = true }
  }, [exploreTab, orgSubTab])

  async function handleFollowOrg(orgId: string) {
    setFollowedOrgIds(prev => {
      const next = new Set(prev)
      next.add(orgId)
      return next
    })
    try {
      const { error } = await supabase.from('citizen_organisations').insert({
        user_hash: userHash,
        organisation_id: orgId,
      })
      if (error) throw error
    } catch {
      showToast('Une erreur est survenue. Réessayez.')
    }
  }

  async function handleVoted(proposalId: string, choice: VoteChoice, oldChoice?: VoteChoice) {
    const isRevote = oldChoice !== undefined
    setVotingProposal(null)
    setAgoraProposal(null)

    const choiceMap: Record<VoteChoice, string> = {
      pour: 'YES', contre: 'NO', blanc: 'ABSTAIN',
    }
    const mappedChoice = choiceMap[choice]

    setVotedChoices(prev => ({ ...prev, [proposalId]: choice }))
    setAllProposals(prev => prev.map(p => {
      if (p.id !== proposalId) return p
      const newVotes = { ...p.votes, [choice]: p.votes[choice] + 1 }
      if (oldChoice) newVotes[oldChoice] = Math.max(0, newVotes[oldChoice] - 1)
      return { ...p, votes: newVotes }
    }))

    const proof = await generateVoteProof(proposalId, mappedChoice)
    const voteParams = {
      p_proposal_id: String(proposalId),
      p_user_hash: userHash,
      p_choice: mappedChoice,
      p_proof_hash: proof,
    }

    try {
      const { error } = await supabase.rpc('deposer_bulletin', voteParams)

      if (error) throw new Error('DB Error')

      if (isRevote) {
        showToast('Vote mis à jour ✓', 'info')
      } else {
        setResultsProposalId(proposalId)
      }
    } catch (e) {
      const pending = loadPendingVotes()
      if (!pending.some(v => v.proposalId === proposalId)) {
        savePendingVotes([...pending, { proposalId, userHash, choice: mappedChoice, timestamp: Date.now() }])
      }
      showToast('Réseau faible. Vote sauvegardé et synchronisé à la prochaine connexion.', 'warning')
    }
  }

  const EXPLORE_CATEGORIES = ['Toutes', 'Économie', 'Social', 'Numérique', 'Institutions', 'Environnement', 'Justice']

  const STATUS_TABS: { key: Stage; label: string }[] = [
    { key: 'voting', label: 'En vote' },
    { key: 'review', label: 'En examen' },
    { key: 'adopted', label: 'Adoptées' },
  ]

  const filteredProposals = useMemo(() => {
    let list = allProposals
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      )
    }
    if (activeCategory && activeCategory !== 'Toutes') {
      list = list.filter(p => p.category === activeCategory)
    }
    if (activeStatus) {
      list = list.filter(p => p.stage === activeStatus)
    }
    if (sortBy === 'popular') {
      list = [...list].sort(
        (a, b) => (b.votes.pour + b.votes.contre + b.votes.blanc) - (a.votes.pour + a.votes.contre + a.votes.blanc)
      )
    } else {
      list = [...list].sort(
        (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
      )
    }
    return list
  }, [allProposals, query, activeCategory, activeStatus, sortBy])

  const orgSubTabLabel: Record<'commune' | 'ong' | 'media', string> = {
    commune: 'Communes',
    ong: 'ONG',
    media: 'Médias',
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-black text-slate-800">Explorer</h1>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5">
        {(['discover', 'organisations'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setExploreTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${exploreTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
          >
            {tab === 'discover' ? 'Propositions' : 'Organisations'}
          </button>
        ))}
      </div>

      {/* ── Discover tab ── */}
      {exploreTab === 'discover' && (
        <>
          {/* Search */}
          <div className="relative mb-3">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher une proposition…"
              className="w-full bg-slate-100 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300"
            />
            {query.length > 0 && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
            {EXPLORE_CATEGORIES.map(cat => {
              const isActive = cat === 'Toutes' ? !activeCategory || activeCategory === 'Toutes' : activeCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat === 'Toutes' ? null : cat)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 active:scale-95'
                    }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          {/* Status tabs + sort */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1">
              {STATUS_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveStatus(activeStatus === key ? null : key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeStatus === key
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-500 active:scale-95'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSortBy(s => s === 'recent' ? 'popular' : 'recent')}
              className="flex items-center gap-1 text-xs text-indigo-600 font-semibold whitespace-nowrap"
            >
              <ArrowUpDown size={12} />
              {sortBy === 'recent' ? 'Récentes' : 'Populaires'}
            </button>
          </div>

          {/* Results */}
          {loadingData ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-1/3 mb-3" />
                  <div className="h-5 bg-slate-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-full mb-1" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : filteredProposals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm font-medium">Aucun résultat</p>
              {query && <p className="text-slate-300 text-xs mt-1">pour « {query} »</p>}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProposals.map(proposal => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onOpen={() => setAgoraProposal(proposal)}
                  currentVote={votedChoices[proposal.id]}
                  hasAlreadyVoted={votedIds.has(proposal.id)}
                  onRevote={() => setVotingProposal(proposal)}
                />
              ))}
            </div>
          )}

          {/* Voting modals */}
          {agoraProposal && !votingProposal && (
            <AgoraModal
              proposal={agoraProposal}
              onVote={() => setVotingProposal(agoraProposal)}
              onClose={() => setAgoraProposal(null)}
              hasVoted={agoraProposal.id in votedChoices}
            />
          )}
          {votingProposal && (
            <VotingBooth
              proposal={votingProposal}
              onVoted={(choice) => handleVoted(votingProposal.id, choice, votedChoices[votingProposal.id])}
              onClose={() => setVotingProposal(null)}
            />
          )}
          {resultsProposalId && (
            <ResultsModal
              proposalId={resultsProposalId}
              onClose={() => setResultsProposalId(null)}
            />
          )}
        </>
      )}

      {/* ── Organisations tab ── */}
      {exploreTab === 'organisations' && (
        <>
          {/* CTA inscription commune */}
          <button
            onClick={onNavigateCommuneRegister}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-indigo-600 text-white active:scale-95 transition-all shadow-sm mb-3"
          >
            <div className="flex items-center gap-3">
              <Building2 size={16} className="text-indigo-200 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-semibold leading-tight">Inscrire ma commune</p>
                <p className="text-indigo-200 text-xs mt-0.5">Rejoindre la démocratie directe locale</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-indigo-200 flex-shrink-0" />
          </button>

          {/* CTA inscription association */}
          <button
            onClick={onNavigateAssocRegister}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-emerald-600 text-white active:scale-95 transition-all shadow-sm mb-4"
          >
            <div className="flex items-center gap-3">
              <Users size={16} className="text-emerald-200 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-semibold leading-tight">Inscrire mon association</p>
                <p className="text-emerald-200 text-xs mt-0.5">Rejoindre le réseau associatif citoyen</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-emerald-200 flex-shrink-0" />
          </button>

          {/* Sub-tabs */}
          <div className="flex gap-2 mb-4">
            {(['commune', 'ong', 'media'] as const).map(sub => (
              <button
                key={sub}
                onClick={() => setOrgSubTab(sub)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${orgSubTab === sub
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600'
                  }`}
              >
                {orgSubTabLabel[sub]}
              </button>
            ))}
          </div>

          {loadingOrgs ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : organisations.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Aucune organisation dans cette catégorie</p>
          ) : (
            <div className="space-y-3">
              {organisations.map(org => {
                const isFollowed = followedOrgIds.has(org.id)
                return (
                  <div key={org.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      {org.type === 'commune' && <Landmark size={18} className="text-indigo-500" />}
                      {org.type === 'ong' && <Users size={18} className="text-emerald-500" />}
                      {org.type === 'media' && <Newspaper size={18} className="text-amber-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{org.name}</p>
                      {org.population != null && (
                        <p className="text-xs text-slate-400">{org.population.toLocaleString('fr-FR')} habitants</p>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{org.description}</p>
                    </div>
                    <button
                      onClick={() => !isFollowed && handleFollowOrg(org.id)}
                      disabled={isFollowed}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${isFollowed
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-indigo-600 text-white active:scale-95'
                        }`}
                    >
                      {isFollowed ? '✓ Suivi' : 'Suivre'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Account Page ───────────────────────────────────────────────
// Note: avec l'architecture anonymat réel, le choix n'est plus
// stocké côté serveur avec le user_hash — on affiche seulement
// les propositions sur lesquelles l'utilisateur a voté.
interface VoteRecord {
  proposalId: string
  title: string
  date: string
  // choice n'est plus disponible : votes anonymes par conception (has_voted ne stocke pas le choix)
}

interface MyProposalRecord {
  id: string
  title: string
  stage: Stage
  supports?: number
}

function emailToDisplayName(email: string): string {
  const local = email.split('@')[0] ?? email
  return local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function nameToInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')
}

function ProfilePage({ onLogout, onNavigateElu, onNavigateOrg, onNavigateAdmin, onNavigateCommune, userHash, userEmail }: {
  onLogout: () => void
  onNavigateElu: (commune: Organisation, role: CommuneRole) => void
  onNavigateOrg: (org: Organisation) => void
  onNavigateAdmin: () => void
  onNavigateCommune: (commune: Organisation, role: CommuneRole) => void
  userHash: string
  userEmail: string
}) {
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

  // "Ma commune" state
  const [communeQuery, setCommuneQuery] = useState('')
  const [communeResults, setCommuneResults] = useState<Organisation[]>([])
  const [loadingCommune, setLoadingCommune] = useState(false)
  const [joinedCommuneIds, setJoinedCommuneIds] = useState<Set<string>>(new Set())
  const [joinedCommunes, setJoinedCommunes] = useState<Organisation[]>([])
  const [joinedOrgs, setJoinedOrgs] = useState<Organisation[]>([])
  const [communeRoles, setCommuneRoles] = useState<Record<string, CommuneRole>>({})



  // Fetch "Mes votes" via RPC get_my_votes
  // (lecture directe de votes interdite par RLS — les totaux viennent de proposals)
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
          setVotedProposals(
            (data as { proposal_id: string; title: string; voted_at: string }[]).map(row => ({
              proposalId: String(row.proposal_id),
              title: row.title ?? 'Proposition inconnue',
              date: row.voted_at?.slice(0, 10) ?? '',
            }))
          )
        }
      } catch {
        if (!cancelled) showToast("Impossible d'enregistrer le vote. Réessayez plus tard.")
      } finally {
        if (!cancelled) setLoadingVotes(false)
      }
    }
    fetchVotes()
    return () => { cancelled = true }
  }, [userHash])

  // Fetch "Mes propositions" from Supabase (filtré par author_hash)
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

  // Load joined organisations + roles on mount
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
          // Build role map (default: 'member' if column absent)
          const roleMap: Record<string, CommuneRole> = {}
          for (const r of rows) {
            const v = r.role as string
            roleMap[r.organisation_id] = (['admin', 'elu', 'agent_com', 'lecteur_admin'] as CommuneRole[]).includes(v as CommuneRole)
              ? (v as CommuneRole)
              : 'member'
          }
          setCommuneRoles(roleMap)
          // Fetch full org objects for all types in one query, then split
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

  // Debounced commune search
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

  const legalDocs: Record<string, { title: string; content: React.ReactNode }> = {
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
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-800">Mon Compte</h1>
      </div>

      {/* Bandeau succès abonnement */}
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

      {/* User card */}
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

      {/* Ma commune */}
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

      {/* Bouton "Voir ma commune" — rôle member ou admin, commune abonnée uniquement */}
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

      {/* Accès tableau de bord ONG / Média — abonnement correspondant requis */}
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
              const icon = org.type === 'ong' ? <Users size={16} className="text-amber-200 flex-shrink-0" /> : <Newspaper size={16} className="text-slate-300 flex-shrink-0" />
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

      {/* Mes votes */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
        <h3 className="font-bold text-slate-800 text-sm mb-3">Mes votes</h3>
        {loadingVotes ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : votedProposals.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            Aucun vote enregistré pour le moment.
          </p>
        ) : (
          <div className="space-y-2">
            {votedProposals.map(v => (
              <div key={v.proposalId} className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 font-medium truncate">{v.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{v.date}</p>
                </div>
                <span className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                  Voté
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mes propositions */}
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
                seedling: '🌱', review: '🔍', voting: '🗳️', adopted: '✅', rejected: '❌', closed: '⛓️', archived: '📚'
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

      {/* Informations légales */}
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

      {/* Administration — visible uniquement pour les admins */}
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

      {/* DEV ONLY — simulateur de plan (retiré en prod) */}
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

      {/* Déconnexion */}
      <button
        onClick={onLogout}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-200 text-red-500 font-semibold text-sm bg-white hover:bg-red-50 active:scale-95 transition-all mb-5"
      >
        <LogOut size={16} />
        Se déconnecter
      </button>

      {/* Version */}
      <p className="text-center text-xs text-slate-300 pb-2">
        CHOISISSONS v1.0 — Prototype Alpha
      </p>

      {/* ── Réglages modal ──────────────────────────────────────── */}
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
              {/* Notifications */}
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
              {/* Langue */}
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
              {/* Supprimer le compte */}
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

      {/* ── Mentions légales modal ───────────────────────────────── */}
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

// ── Org Dashboard ─────────────────────────────────────────────
interface OrgProposal {
  id: string
  title: string
  status: string
  votes_pour: number
  votes_contre: number
  votes_blanc: number
  created_at: string
}

interface OrgComment {
  id: string
  proposal_id: string
  content: string
  created_at: string
}

function OrgDashboard({ org, onBack }: { org: Organisation; onBack: () => void }) {
  const [followerCount, setFollowerCount] = useState<number | null>(null)
  const [proposals, setProposals] = useState<OrgProposal[]>([])
  const [nationalLaws, setNationalLaws] = useState<Proposal[]>([])
  const [comments, setComments] = useState<Record<string, OrgComment[]>>({})
  const [loadingStats, setLoadingStats] = useState(true)

  const [showPropForm, setShowPropForm] = useState(false)
  const [propTitle, setPropTitle] = useState('')
  const [propDescription, setPropDescription] = useState('')
  const [submittingProp, setSubmittingProp] = useState(false)

  const [commentingLawId, setCommentingLawId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        const [followersRes, proposalsRes, lawsRes] = await Promise.all([
          supabase.from('citizen_organisations').select('id', { count: 'exact', head: true }).eq('organisation_id', org.id),
          supabase.from('proposals').select('id,title,status,votes_pour,votes_contre,votes_blanc,created_at').eq('author', org.name),
          supabase.from('parliamentary_laws').select('id,number,title,description,category,stage,parliament_vote_date,votes_pour,votes_contre,votes_blanc,tags,official_url').eq('stage', 'voting'),
        ])
        if (!cancelled) {
          if (followersRes.count !== null) setFollowerCount(followersRes.count)
          if (proposalsRes.data) setProposals(proposalsRes.data as OrgProposal[])
          if (lawsRes.data && lawsRes.data.length > 0) {
            setNationalLaws((lawsRes.data as any[]).map(row => ({
              id: row.id,
              title: row.title,
              description: row.description,
              category: row.category,
              stage: row.stage as Stage,
              votes: { pour: row.votes_pour ?? 0, contre: row.votes_contre ?? 0, blanc: row.votes_blanc ?? 0 },
              signatures: 0,
              targetSignatures: 10000,
              arguments: [],
              author: 'Assemblée Nationale',
              date: row.parliament_vote_date,
              tags: row.tags ?? [],
            })))
          } else {
            setNationalLaws(PROPOSALS.filter(p => p.stage === 'voting'))
          }
          // Load existing comments by this org on any of those laws
          const lawIds = (lawsRes.data ?? []).map((l: { id: string }) => l.id)
          if (lawIds.length > 0) {
            const { data: commentsData } = await supabase
              .from('comments')
              .select('id,proposal_id,content,created_at')
              .eq('organisation_id', org.id)
              .in('proposal_id', lawIds)
            if (!cancelled && commentsData) {
              const grouped: Record<string, OrgComment[]> = {}
              for (const c of commentsData as OrgComment[]) {
                if (!grouped[c.proposal_id]) grouped[c.proposal_id] = []
                grouped[c.proposal_id].push(c)
              }
              setComments(grouped)
            }
          }
        }
      } catch {
        if (!cancelled) showToast('Une erreur est survenue. Réessayez.')
      } finally {
        if (!cancelled) setLoadingStats(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [org.id, org.name])

  const totalVotes = proposals.reduce(
    (sum, p) => sum + (p.votes_pour ?? 0) + (p.votes_contre ?? 0) + (p.votes_blanc ?? 0), 0
  )
  const engagementRate = followerCount && followerCount > 0
    ? Math.min(Math.round((totalVotes / followerCount) * 100), 100)
    : 0

  const headerColor = org.type === 'ong' ? '#854f0b' : '#334155'
  const accentClass = org.type === 'ong' ? 'text-amber-200' : 'text-slate-300'
  const typeLabel = org.type === 'ong' ? 'ONG / Association' : 'Média'
  const typeBadge = org.type === 'ong' ? 'bg-amber-900/50 text-amber-200' : 'bg-slate-600/50 text-slate-300'

  async function handleSubmitProposal() {
    if (!propTitle.trim()) return
    setSubmittingProp(true)
    const draft: OrgProposal = {
      id: `org-prop-${Date.now()}`,
      title: propTitle,
      status: 'seedling',
      votes_pour: 0, votes_contre: 0, votes_blanc: 0,
      created_at: new Date().toISOString(),
    }
    setProposals(prev => [draft, ...prev])
    setShowPropForm(false)
    setPropTitle(''); setPropDescription('')
    try {
      const { error } = await supabase.from('proposals').insert({
        title: propTitle,
        description: propDescription,
        status: 'seedling',
        author: org.name,
        category: org.type === 'ong' ? 'Social' : 'Numérique',
        supports: 0,
        votes_pour: 0, votes_contre: 0, votes_blanc: 0,
        tags: [],
      })
      if (error) throw error
    } catch {
      showToast('Une erreur est survenue. Réessayez.')
    }
    setSubmittingProp(false)
  }

  async function handleSubmitComment(lawId: string) {
    if (!commentText.trim()) return
    setSubmittingComment(true)
    const draft: OrgComment = {
      id: `comment-${Date.now()}`,
      proposal_id: lawId,
      content: commentText,
      created_at: new Date().toISOString(),
    }
    setComments(prev => ({ ...prev, [lawId]: [...(prev[lawId] ?? []), draft] }))
    setCommentingLawId(null)
    setCommentText('')
    try {
      const { error } = await supabase.from('comments').insert({
        proposal_id: lawId,
        organisation_id: org.id,
        content: commentText,
      })
      if (error) throw error
    } catch {
      showToast('Une erreur est survenue. Réessayez.')
    }
    setSubmittingComment(false)
  }

  const statusTag: Record<string, { text: string; color: string }> = {
    voting: { text: 'En vote', color: 'bg-indigo-100 text-indigo-700' },
    seedling: { text: 'Pépinière', color: 'bg-emerald-100 text-emerald-700' },
    review: { text: 'Jury', color: 'bg-amber-100 text-amber-700' },
    adopted: { text: 'Adoptée', color: 'bg-green-100 text-green-700' },
    rejected: { text: 'Rejetée', color: 'bg-red-100 text-red-600' },
    closed: { text: 'Clôturé', color: 'bg-teal-100 text-teal-700' },
    archived: { text: 'Archivée', color: 'bg-slate-100 text-slate-600' },
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div style={{ backgroundColor: headerColor }} className="px-5 pt-10 pb-6 text-white">
        <button
          onClick={onBack}
          className={`flex items-center gap-1.5 ${accentClass} text-xs font-medium mb-5 hover:text-white transition-colors`}
        >
          <ArrowLeft size={14} />
          Retour à Mon Compte
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span className={`inline-block text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2 ${typeBadge}`}>
              {typeLabel}
            </span>
            <h1 className="text-xl font-black leading-tight">{org.name}</h1>
            {org.description && (
              <p className={`text-xs mt-1 ${accentClass} line-clamp-2`}>{org.description}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-black">{loadingStats ? '—' : (followerCount ?? 0).toLocaleString('fr-FR')}</p>
            <p className={`text-xs ${accentClass}`}>abonnés</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: 'Abonnés', value: loadingStats ? '—' : (followerCount ?? 0).toLocaleString('fr-FR'), sub: 'citoyens abonnés' },
            { label: 'Propositions', value: loadingStats ? '—' : proposals.length.toString(), sub: 'publiées' },
            { label: 'Votes reçus', value: loadingStats ? '—' : totalVotes.toLocaleString('fr-FR'), sub: 'sur vos propositions' },
            { label: 'Engagement', value: loadingStats ? '—' : `${engagementRate}%`, sub: 'votes / abonnés' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-500 leading-snug mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-slate-800">{stat.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Proposals */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mes propositions</h2>
            <button
              onClick={() => setShowPropForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white active:scale-95 transition-all"
              style={{ backgroundColor: headerColor }}
            >
              <Plus size={12} />
              Soumettre
            </button>
          </div>

          {loadingStats ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                  <div className="h-2 bg-slate-100 rounded w-full" />
                </div>
              ))}
            </div>
          ) : proposals.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center">
              <p className="text-sm text-slate-400 mb-1">Aucune proposition soumise</p>
              <p className="text-xs text-slate-300">Soumettez votre première proposition citoyenne</p>
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map(p => {
                const total = (p.votes_pour ?? 0) + (p.votes_contre ?? 0) + (p.votes_blanc ?? 0)
                const pourPct = total > 0 ? Math.round((p.votes_pour / total) * 100) : 0
                const contrePct = total > 0 ? Math.round((p.votes_contre / total) * 100) : 0
                const blancPct = 100 - pourPct - contrePct
                const s = statusTag[p.status] ?? { text: p.status, color: 'bg-slate-100 text-slate-600' }
                return (
                  <div key={p.id} className="bg-white rounded-2xl p-4 border border-slate-100">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-slate-800 flex-1 leading-snug">{p.title}</p>
                      <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${s.color}`}>
                        {s.text}
                      </span>
                    </div>
                    {total > 0 ? (
                      <>
                        <div className="flex h-1.5 rounded-full overflow-hidden mb-1">
                          <div className="bg-green-500 transition-all" style={{ width: `${pourPct}%` }} />
                          <div className="bg-red-400 transition-all" style={{ width: `${contrePct}%` }} />
                          <div className="bg-slate-200 transition-all" style={{ width: `${blancPct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-green-600 font-medium">Pour {pourPct}%</span>
                          <span className="text-slate-400">{total.toLocaleString('fr-FR')} votes</span>
                          <span className="text-red-500 font-medium">Contre {contrePct}%</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-300">{p.created_at?.slice(0, 10)} · Aucun vote</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Comment on national laws */}
        <div className="mb-8">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Commenter une loi en cours</h2>

          {loadingStats ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : nationalLaws.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center">
              <p className="text-sm text-slate-400">Aucune loi en vote actuellement</p>
            </div>
          ) : (
            <div className="space-y-3">
              {nationalLaws.map(law => {
                const lawComments = comments[law.id] ?? []
                const isCommenting = commentingLawId === law.id
                return (
                  <div key={law.id} className="bg-white rounded-2xl p-4 border border-slate-100">
                    <p className="text-sm font-semibold text-slate-800 mb-2 leading-snug">{law.title}</p>
                    {lawComments.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {lawComments.map(c => (
                          <div key={c.id} className="bg-slate-50 rounded-xl px-3 py-2">
                            <p className="text-xs text-slate-600 leading-relaxed">{c.content}</p>
                            <p className="text-xs text-slate-300 mt-1">{c.created_at?.slice(0, 10)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {isCommenting ? (
                      <div className="space-y-2">
                        <textarea
                          value={commentText}
                          onChange={e => setCommentText(e.target.value.slice(0, 500))}
                          placeholder="Votre commentaire (500 caractères max)..."
                          rows={3}
                          className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300 resize-none"
                          autoFocus
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-300">{commentText.length}/500</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setCommentingLawId(null); setCommentText('') }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 bg-slate-100"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={() => handleSubmitComment(law.id)}
                              disabled={!commentText.trim() || submittingComment}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 flex items-center gap-1 active:scale-95 transition-all"
                              style={{ backgroundColor: headerColor }}
                            >
                              {submittingComment
                                ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                : 'Publier'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setCommentingLawId(law.id); setCommentText('') }}
                        className="flex items-center gap-1.5 text-xs font-semibold mt-1 transition-colors hover:opacity-70"
                        style={{ color: headerColor }}
                      >
                        <Plus size={12} />
                        Ajouter un commentaire
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Submit proposal modal */}
      {showPropForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end p-4">
          <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Soumettre une proposition</h3>
              <button
                onClick={() => setShowPropForm(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
              >
                <X size={15} className="text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Titre</label>
                <input
                  type="text"
                  value={propTitle}
                  onChange={e => setPropTitle(e.target.value)}
                  placeholder="Titre de votre proposition"
                  className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
                <textarea
                  value={propDescription}
                  onChange={e => setPropDescription(e.target.value)}
                  placeholder="Décrivez votre proposition..."
                  rows={4}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300 resize-none"
                />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setShowPropForm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitProposal}
                disabled={!propTitle.trim() || submittingProp}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-all"
                style={{ backgroundColor: headerColor }}
              >
                {submittingProp
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : 'Soumettre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Elected Dashboard ──────────────────────────────────────────
interface LocalConsultation {
  id: string
  title: string
  description: string
  status: string
  created_at: string
  votes_pour: number
  votes_contre: number
  votes_blanc: number
}

function ElectedDashboard({ commune, userRole, onBack }: { commune: Organisation; userRole: CommuneRole; onBack: () => void }) {
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [nationalLaws, setNationalLaws] = useState<Proposal[]>([])
  const [consultations, setConsultations] = useState<LocalConsultation[]>([])
  const [loadingStats, setLoadingStats] = useState(true)

  const [showInvite, setShowInvite] = useState(false)
  const inviteUrl = `https://choisissons.fr?commune=${encodeURIComponent(commune.name)}`

  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDuration, setFormDuration] = useState(30)
  const [submitting, setSubmitting] = useState(false)

  // Member management (admin only)
  interface TeamMember { id: string; user_hash: string; role: CommuneRole; created_at: string }
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
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
        const [membersRes, lawsRes, consultRes] = await Promise.all([
          supabase.from('citizen_organisations').select('id', { count: 'exact', head: true }).eq('organisation_id', commune.id),
          supabase.from('parliamentary_laws').select('id,number,title,description,category,stage,parliament_vote_date,votes_pour,votes_contre,votes_blanc,tags,official_url').eq('stage', 'voting'),
          supabase.from('proposals').select('id,title,description,status,created_at,votes_pour,votes_contre,votes_blanc').eq('author', commune.name),
        ])
        if (!cancelled) {
          if (membersRes.count !== null) setMemberCount(membersRes.count)
          if (lawsRes.data && lawsRes.data.length > 0) {
            setNationalLaws((lawsRes.data as any[]).map(row => ({
              id: row.id,
              title: row.title,
              description: row.description,
              category: row.category,
              stage: row.stage as Stage,
              votes: { pour: row.votes_pour ?? 0, contre: row.votes_contre ?? 0, blanc: row.votes_blanc ?? 0 },
              signatures: 0,
              targetSignatures: 10000,
              arguments: [],
              author: 'Assemblée Nationale',
              date: row.parliament_vote_date,
              tags: row.tags ?? [],
            })))
          } else {
            setNationalLaws(PROPOSALS.filter(p => p.stage === 'voting'))
          }
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

  const totalVotes = nationalLaws.reduce(
    (sum, l) => sum + l.votes.pour + l.votes.contre + l.votes.blanc, 0
  )
  const participationRate = memberCount && memberCount > 0
    ? Math.min(Math.round((totalVotes / memberCount) * 100), 100)
    : 0
  const activeConsultations = consultations.filter(c => c.status === 'voting').length

  async function handleCreate() {
    if (!formTitle.trim()) return
    setSubmitting(true)
    const draft: LocalConsultation = {
      id: `local-${Date.now()}`,
      title: formTitle,
      description: formDescription,
      status: 'voting',
      created_at: new Date().toISOString(),
      votes_pour: 0, votes_contre: 0, votes_blanc: 0,
    }
    setConsultations(prev => [draft, ...prev])
    setShowForm(false)
    setFormTitle(''); setFormDescription(''); setFormDuration(30)
    try {
      const { error } = await supabase.from('proposals').insert({
        title: formTitle,
        description: formDescription,
        status: 'voting',
        author: commune.name,
        category: 'Local',
        supports: 0,
        votes_pour: 0, votes_contre: 0, votes_blanc: 0,
        tags: [],
      })
      if (error) throw error
    } catch {
      showToast('Une erreur est survenue. Réessayez.')
    }
    setSubmitting(false)
  }

  const statusTag: Record<string, { text: string; color: string }> = {
    voting: { text: 'En vote', color: 'bg-indigo-100 text-indigo-700' },
    seedling: { text: 'Brouillon', color: 'bg-slate-100 text-slate-600' },
    review: { text: 'En révision', color: 'bg-amber-100 text-amber-700' },
    adopted: { text: 'Terminée', color: 'bg-green-100 text-green-700' },
    rejected: { text: 'Clôturée', color: 'bg-red-100 text-red-600' },
    closed: { text: 'Clôturé', color: 'bg-teal-100 text-teal-700' },
    archived: { text: 'Archivée', color: 'bg-slate-100 text-slate-600' },
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div style={{ backgroundColor: '#0c447c' }} className="px-5 pt-10 pb-6 text-white">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-blue-200 text-xs font-medium mb-5 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Retour à Mon Compte
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">Tableau de bord élu · Accès administrateur</p>
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
            <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-xs text-slate-600 font-mono break-all border border-slate-200">
              {inviteUrl}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(inviteUrl)
                showToast('Lien copié !', 'info')
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors active:scale-95"
            >
              Copier le lien
            </button>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: 'Inscrits CHOISISSONS', value: loadingStats ? '—' : (memberCount ?? 0).toLocaleString('fr-FR'), sub: 'habitants enregistrés' },
            { label: 'Taux de participation', value: loadingStats ? '—' : `${participationRate}%`, sub: 'aux votes nationaux' },
            { label: 'Consultations actives', value: loadingStats ? '—' : activeConsultations.toString(), sub: 'consultations locales' },
            { label: 'Lois en vote', value: loadingStats ? '—' : nationalLaws.length.toString(), sub: 'actuellement au Parlement' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-500 leading-snug mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-slate-800">{stat.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* National laws */}
        <div className="mb-5">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Lois nationales — avis de la commune
          </h2>
          {loadingStats ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-3/4 mb-3" />
                  <div className="h-2 bg-slate-100 rounded w-full" />
                </div>
              ))}
            </div>
          ) : nationalLaws.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center">
              <p className="text-sm text-slate-400">Aucune loi en vote actuellement</p>
            </div>
          ) : (
            <div className="space-y-3">
              {nationalLaws.map(law => {
                const total = law.votes.pour + law.votes.contre + law.votes.blanc
                const pourPct = total > 0 ? Math.round((law.votes.pour / total) * 100) : 0
                const contrePct = total > 0 ? Math.round((law.votes.contre / total) * 100) : 0
                const blancPct = 100 - pourPct - contrePct
                return (
                  <div key={law.id} className="bg-white rounded-2xl p-4 border border-slate-100">
                    <p className="text-sm font-semibold text-slate-800 mb-0.5">{law.title}</p>
                    <p className="text-xs text-slate-400 mb-3">{total.toLocaleString('fr-FR')} avis exprimés</p>
                    {total > 0 ? (
                      <>
                        <div className="flex h-2 rounded-full overflow-hidden mb-1.5">
                          <div className="bg-green-500 transition-all" style={{ width: `${pourPct}%` }} />
                          <div className="bg-red-400 transition-all" style={{ width: `${contrePct}%` }} />
                          <div className="bg-slate-200 transition-all" style={{ width: `${blancPct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-green-600 font-semibold">Pour {pourPct}%</span>
                          <span className="text-slate-400">Blanc {blancPct}%</span>
                          <span className="text-red-500 font-semibold">Contre {contrePct}%</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-300 italic">Aucun avis enregistré pour cette commune</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Local consultations */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Consultations locales</h2>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white active:scale-95 transition-all"
              style={{ backgroundColor: '#0c447c' }}
            >
              <Plus size={12} />
              Lancer une consultation
            </button>
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
                const s = statusTag[c.status] ?? { text: c.status, color: 'bg-slate-100 text-slate-600' }
                const total = (c.votes_pour ?? 0) + (c.votes_contre ?? 0) + (c.votes_blanc ?? 0)
                return (
                  <div key={c.id} className="bg-white rounded-2xl p-4 border border-slate-100">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-slate-800 flex-1 leading-snug">{c.title}</p>
                      <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${s.color}`}>
                        {s.text}
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
          {/* Member management — admin only */}
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
                  {teamMembers.map(m => {
                    const ROLE_LABELS: Record<CommuneRole, string> = {
                      admin: 'Administrateur',
                      elu: 'Élu(e)',
                      agent_com: 'Agent comm.',
                      lecteur_admin: 'Lecteur admin',
                      member: 'Habitant',
                    }
                    return (
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
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create consultation modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end p-4">
          <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Nouvelle consultation locale</h3>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
              >
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
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Durée (jours)</label>
                <input
                  type="number"
                  value={formDuration}
                  onChange={e => setFormDuration(Math.max(1, Number(e.target.value)))}
                  min={1}
                  max={365}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={!formTitle.trim() || submitting}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-all"
                style={{ backgroundColor: '#0c447c' }}
              >
                {submitting
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : 'Lancer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Support Page ──────────────────────────────────────────────
const COMMUNE_TIERS = [
  { value: 'small', label: 'Moins de 5 000 habitants', price: '49€' },
  { value: 'medium', label: 'De 5 000 à 50 000 habitants', price: '149€' },
  { value: 'large', label: 'Plus de 50 000 habitants', price: '499€' },
] as const
type CommuneTier = typeof COMMUNE_TIERS[number]['value']

const COMMUNE_PLAN_MAP: Record<CommuneTier, string> = {
  small: 'commune_petite',
  medium: 'commune_moyenne',
  large: 'commune_grande',
}

const ASSOC_TIERS = [
  { value: 's', label: "Jusqu'à 50 adhérents", price: '9€' },
  { value: 'm', label: "Jusqu'à 200 adhérents", price: '19€' },
  { value: 'l', label: 'Adhérents illimités', price: '49€' },
] as const
type AssocTier = typeof ASSOC_TIERS[number]['value']

const ASSOC_PLAN_MAP: Record<AssocTier, string> = {
  s: 'assoc_s',
  m: 'assoc_m',
  l: 'assoc_l',
}

const STRIPE_PRODUCT_IDS: Record<string, string> = {
  citoyen: 'prod_UarythbFH8E5hs',
  media: 'prod_UarzuwtLFr24b3',
  ong: 'prod_UarzdtYPKStpea',
  assoc_s: 'prod_Uas37yPOMHouwu',
  assoc_m: 'prod_Uas4bJ3ZTxSv9i',
  assoc_l: 'prod_Uas5VkdubNnzPK',
  commune_petite: 'prod_Uas0rN3qtJiScl',
  commune_moyenne: 'prod_Uas1PSHZycVXkh',
  commune_grande: 'prod_Uas2pkPYdwxQ1h',
}

function SupportPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [communeSize, setCommuneSize] = useState<CommuneTier>('small')
  const [assocSize, setAssocSize] = useState<AssocTier>('s')
  const [expanded, setExpanded] = useState<'commune' | 'assoc' | null>(null)
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null)

  async function handleCheckout(plan: string) {
    const productId = STRIPE_PRODUCT_IDS[plan]
    if (!productId) {
      showToast("Plan inconnu. Contactez le support.", 'error')
      return
    }
    setLoadingCheckout(plan)
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan, productId },
      })
      // La fonction retourne toujours 200 ; les erreurs sont dans data.error
      if (error) {
        const msg = (error as { message?: string }).message ?? String(error)
        console.error('[checkout] FunctionsError:', msg)
        showToast(`Erreur paiement : ${msg}`, 'error')
        return
      }
      const d = data as { url?: string; error?: string }
      if (d?.error) {
        console.error('[checkout] Function error:', d.error)
        showToast(`Erreur : ${d.error}`, 'error')
        return
      }
      if (!d?.url) {
        showToast("Impossible de lancer le paiement. Réessayez plus tard.", 'error')
        return
      }
      window.location.href = d.url
    } catch (err) {
      console.error('[checkout] catch:', err)
      showToast("Impossible de lancer le paiement. Réessayez plus tard.", 'error')
    } finally {
      setLoadingCheckout(null)
    }
  }

  return (
    <div className="p-4">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-800">Soutenir</h1>
        <p className="text-slate-500 text-sm leading-relaxed">
          Choisissons est indépendant. Votre soutien garantit notre neutralité.
        </p>
      </div>

      {/* Mission banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-4 mb-6 text-white">
        <div className="flex items-start gap-3">
          <Star size={20} className="text-yellow-300 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm mb-1">Notre engagement</p>
            <p className="text-indigo-100 text-xs leading-relaxed">
              Aucune publicité, aucun financement politique. 100% des revenus financent l'infrastructure et la sécurité.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">

        {/* ── Citoyen ── */}
        <div className={`rounded-2xl border-2 overflow-hidden transition-all border-indigo-300 ${selected === 'citoyen' ? 'shadow-lg' : ''}`}>
          <div className="bg-indigo-600 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User size={20} />
              <span className="font-black text-lg">Citoyen</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black">2€</span>
              <span className="text-xs opacity-75 ml-0.5">/mois</span>
            </div>
          </div>
          <div className="p-4 bg-white">
            <ul className="space-y-2 mb-4">
              {['Accès complet sans publicité', 'Badge citoyen soutenant', 'Newsletter mensuelle', 'Vote prioritaire'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle size={14} className="text-green-500 flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => selected === 'citoyen' ? void handleCheckout('citoyen') : setSelected('citoyen')}
              disabled={loadingCheckout === 'citoyen'}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 ${selected === 'citoyen' ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white'
                }`}
            >
              {loadingCheckout === 'citoyen' ? 'Redirection…' : selected === 'citoyen' ? '✓ Sélectionné — Passer au paiement →' : 'Soutenir la démocratie'}
            </button>
          </div>
        </div>

        {/* ── Commune & Collectivité (accordion) ── */}
        <div className={`rounded-2xl border-2 overflow-hidden transition-all border-teal-300 ${selected === 'commune' ? 'shadow-lg' : ''}`}>
          <button
            className="w-full bg-teal-700 p-4 text-white flex items-center justify-between"
            onClick={() => setExpanded(expanded === 'commune' ? null : 'commune')}
          >
            <div className="flex items-center gap-3">
              <Landmark size={20} />
              <span className="font-black text-lg">Commune &amp; Collectivité</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xl font-black">49€–499€</span>
                <span className="text-xs opacity-75 ml-0.5">/mois</span>
              </div>
              <ChevronRight size={16} className={`transition-transform ${expanded === 'commune' ? 'rotate-90' : ''}`} />
            </div>
          </button>
          {expanded === 'commune' && (
            <div className="p-4 bg-white">
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Tranche d'habitants
                </label>
                <div className="space-y-2">
                  {COMMUNE_TIERS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setCommuneSize(t.value)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${communeSize === t.value
                        ? 'border-teal-500 bg-teal-50 text-teal-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                    >
                      <span>{t.label}</span>
                      <span className={`font-black ${communeSize === t.value ? 'text-teal-700' : 'text-slate-400'}`}>
                        {t.price}/mois
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <ul className="space-y-2 mb-4">
                {['Accès API données', 'Tableau de bord pour les élus', 'Consultation citoyenne intégrée', "Rapport d'engagement mensuel", 'Support prioritaire'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => selected === 'commune' ? void handleCheckout(COMMUNE_PLAN_MAP[communeSize]) : setSelected('commune')}
                disabled={loadingCheckout === 'commune'}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 ${selected === 'commune' ? 'bg-slate-800 text-white' : 'bg-teal-700 text-white'
                  }`}
              >
                {loadingCheckout === 'commune' ? 'Redirection…' : selected === 'commune' ? '✓ Sélectionné — Passer au paiement →' : 'Équiper ma commune'}
              </button>
            </div>
          )}
        </div>

        {/* ── Association (accordion) ── */}
        <div className={`rounded-2xl border-2 overflow-hidden transition-all border-emerald-300 ${selected === 'assoc' ? 'shadow-lg' : ''}`}>
          <button
            className="w-full bg-emerald-700 p-4 text-white flex items-center justify-between"
            onClick={() => setExpanded(expanded === 'assoc' ? null : 'assoc')}
          >
            <div className="flex items-center gap-3">
              <Users size={20} />
              <span className="font-black text-lg">Association</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xl font-black">9€–49€</span>
                <span className="text-xs opacity-75 ml-0.5">/mois</span>
              </div>
              <ChevronRight size={16} className={`transition-transform ${expanded === 'assoc' ? 'rotate-90' : ''}`} />
            </div>
          </button>
          {expanded === 'assoc' && (
            <div className="p-4 bg-white">
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Taille de l'association
                </label>
                <div className="space-y-2">
                  {ASSOC_TIERS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setAssocSize(t.value)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${assocSize === t.value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                    >
                      <span>{t.label}</span>
                      <span className={`font-black ${assocSize === t.value ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {t.price}/mois
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <ul className="space-y-2 mb-4">
                {['Page association publique', 'Propositions co-sponsorisées', 'Tableau de bord membres', "Rapport d'impact mensuel", 'Support prioritaire'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => selected === 'assoc' ? void handleCheckout(ASSOC_PLAN_MAP[assocSize]) : setSelected('assoc')}
                disabled={loadingCheckout === 'assoc'}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 ${selected === 'assoc' ? 'bg-slate-800 text-white' : 'bg-emerald-700 text-white'
                  }`}
              >
                {loadingCheckout === 'assoc' ? 'Redirection…' : selected === 'assoc' ? '✓ Sélectionné — Passer au paiement →' : 'Rejoindre en association'}
              </button>
            </div>
          )}
        </div>

        {/* ── ONG / Fondation ── */}
        <div className={`rounded-2xl border-2 overflow-hidden transition-all border-amber-300 ${selected === 'ong' ? 'shadow-lg' : ''}`}>
          <div className="bg-amber-600 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe size={20} />
              <span className="font-black text-lg">ONG / Fondation</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black">49€</span>
              <span className="text-xs opacity-75 ml-0.5">/mois</span>
            </div>
          </div>
          <div className="p-4 bg-white">
            <ul className="space-y-2 mb-4">
              {["Tout l'offre Association L", 'Page organisation dédiée', '10 comptes membres', 'Propositions co-sponsorisées', "Rapport d'impact trimestriel"].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle size={14} className="text-green-500 flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => selected === 'ong' ? void handleCheckout('ong') : setSelected('ong')}
              disabled={loadingCheckout === 'ong'}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 ${selected === 'ong' ? 'bg-slate-800 text-white' : 'bg-amber-600 text-white'
                }`}
            >
              {loadingCheckout === 'ong' ? 'Redirection…' : selected === 'ong' ? '✓ Sélectionné — Passer au paiement →' : 'Rejoindre en ONG'}
            </button>
          </div>
        </div>

        {/* ── Média ── */}
        <div className={`rounded-2xl border-2 overflow-hidden transition-all border-slate-300 ${selected === 'media' ? 'shadow-lg' : ''}`}>
          <div className="bg-slate-600 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Newspaper size={20} />
              <span className="font-black text-lg">Média</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black">29€</span>
              <span className="text-xs opacity-75 ml-0.5">/mois</span>
            </div>
          </div>
          <div className="p-4 bg-white">
            <ul className="space-y-2 mb-4">
              {['API accès données', 'Tableau de bord analytics', 'Export CSV / JSON', 'Badge média partenaire', 'Support prioritaire'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle size={14} className="text-green-500 flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => selected === 'media' ? void handleCheckout('media') : setSelected('media')}
              disabled={loadingCheckout === 'media'}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 ${selected === 'media' ? 'bg-slate-800 text-white' : 'bg-slate-600 text-white'
                }`}
            >
              {loadingCheckout === 'media' ? 'Redirection…' : selected === 'media' ? '✓ Sélectionné — Passer au paiement →' : 'Accès média'}
            </button>
          </div>
        </div>

      </div>

      <p className="text-center text-xs text-slate-400 mt-4 pb-2">
        Paiement sécurisé par Stripe · Sans engagement · Annulation en 1 clic
      </p>
    </div>
  )
}

// ── Impact Page ────────────────────────────────────────────────
function CountUp({ value, duration = 1800 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (value === 0) { setCount(0); return }
    const start = performance.now()
    let rafId: number
    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * value))
      if (progress < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [value, duration])
  return <>{count.toLocaleString('fr-FR')}</>
}

const IMPACT_CATEGORIES: { name: string; color: string }[] = [
  { name: 'Économie', color: 'bg-yellow-400' },
  { name: 'Social', color: 'bg-blue-400' },
  { name: 'Numérique', color: 'bg-purple-400' },
  { name: 'Institutions', color: 'bg-indigo-400' },
  { name: 'Environnement', color: 'bg-green-400' },
  { name: 'Justice', color: 'bg-violet-400' },
]

function ImpactPage() {
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
          supabase.from('registre_scrutin').select('id', { count: 'exact', head: true }),
          supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('status', 'voting'),
          supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('status', 'adopted'),
          supabase.from('proposals').select('category'),
        ])
        if (!cancelled) {
          setCitizens((citizensRes.data as number) ?? 0)
          setVotes(votesRes.count ?? 0)
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

      {/* 4 stat counters */}
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

      {/* Category bar chart */}
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

// ── Propose Modal ──────────────────────────────────────────────
function ProposeModal({ onClose, userHash }: { onClose: () => void; userHash: string }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const categories = ['Économie', 'Environnement', 'Démocratie', 'Travail', 'Éducation', 'Santé', 'Logement', 'Justice', 'Autre']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim() || !category) return
    setSubmitting(true)

    try {
      const { error } = await supabase.from('proposals').insert({
        title: title.trim(),
        description: description.trim(),
        category: category,
        status: 'seedling',
        author_hash: userHash,
        votes_pour: 0,
        votes_contre: 0,
        votes_blanc: 0
      })
      if (error) throw error
      setSubmitted(true)
      setTimeout(onClose, 2500)
    } catch (error) {
      showToast("Une erreur est survenue lors de l'envoi de la proposition.", 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-8">
        <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mb-6">
          <Sprout size={40} className="text-indigo-600" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Proposition envoyée !</h2>
        <p className="text-slate-500 text-sm text-center">
          Elle sera examinée avant d'entrer en Pépinière. Merci pour votre engagement citoyen.
        </p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-3 p-4 border-b border-slate-100 flex-shrink-0">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
          <X size={18} className="text-slate-600" />
        </button>
        <div>
          <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Nouvelle proposition</p>
          <h2 className="font-bold text-slate-800 text-sm">Faites entendre votre voix</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Titre *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Résumez votre proposition en une phrase"
            maxLength={120}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <p className="text-xs text-slate-400 mt-1 text-right">{title.length}/120</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description *</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Expliquez votre proposition, son objectif et ses bénéfices pour la société…"
            rows={5}
            maxLength={1000}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />
          <p className="text-xs text-slate-400 mt-1 text-right">{description.length}/1000</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catégorie *</label>
          <div className="grid grid-cols-2 gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`py-2 px-3 rounded-xl text-sm font-medium border transition-all ${category === cat
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-2">
          <button
            type="submit"
            disabled={!title.trim() || !description.trim() || !category || submitting}
            className="w-full bg-indigo-600 text-white rounded-xl py-4 font-semibold disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {submitting ? 'Envoi en cours...' : 'Soumettre ma proposition'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Admin Dashboard ───────────────────────────────────────────
interface AdminProposal {
  id: string
  title: string
  description: string
  status: string
  supports: number
  created_at: string
  blockchain_proof?: string | null
}

function AdminDashboard({ onBack }: { onBack: () => void }) {
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
                    {p.status === 'voting' && (
                      <button
                        onClick={() => handleAnchor(p.id)}
                        disabled={actioningId === p.id}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                      >
                        {actioningId === p.id
                          ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Ancrage en cours…</>
                          : <><Lock size={12} /> Clôturer et ancrer sur Ethereum</>}
                      </button>
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

// ── Main App ───────────────────────────────────────────────────
// ── Bibliothèque ──────────────────────────────────────────────
function LibraryPage() {
  type LibraryEntry = {
    id: string
    title: string
    description: string
    category: string
    status: string
    type: 'citizen' | 'law'
    votes_pour: number
    votes_contre: number
    votes_blanc: number
    date: string
  }
  type SortKey = 'recent' | 'votes' | 'alpha'

  const CATEGORIES = ['Toutes', 'Économie', 'Social', 'Numérique', 'Institutions', 'Sécurité', 'Défense', 'Environnement', 'Justice']

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

// ── Commune Page ───────────────────────────────────────────────
function CommunePage({ commune, userRole, userHash, onBack }: {
  commune: Organisation
  userRole: CommuneRole
  userHash: string
  onBack: () => void
}) {
  const [tab, setTab] = useState<'consultations' | 'archives' | 'actus' | 'agenda'>('consultations')

  // Consultations / archives
  const [activeProposals, setActiveProposals] = useState<Proposal[]>([])
  const [archivedProposals, setArchivedProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [agoraProposal, setAgoraProposal] = useState<Proposal | null>(null)
  const [votingProposal, setVotingProposal] = useState<Proposal | null>(null)
  const [votedChoices, setVotedChoices] = useState<Record<string, VoteChoice>>({})
  const [resultsProposalId, setResultsProposalId] = useState<string | null>(null)

  // Actualités (news)
  const [news, setNews] = useState<CommuneNews[]>([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [showNewsForm, setShowNewsForm] = useState(false)
  const [newsTitle, setNewsTitle] = useState('')
  const [newsContent, setNewsContent] = useState('')
  const [newsCategory, setNewsCategory] = useState<CommuneNews['category']>('info')
  const [submittingNews, setSubmittingNews] = useState(false)

  // Agenda
  const [events, setEvents] = useState<CommuneEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [showEventForm, setShowEventForm] = useState(false)
  const [evTitle, setEvTitle] = useState('')
  const [evDesc, setEvDesc] = useState('')
  const [evDate, setEvDate] = useState('')
  const [evEndDate, setEvEndDate] = useState('')
  const [evLocation, setEvLocation] = useState('')
  const [evCategory, setEvCategory] = useState<CommuneEvent['category']>('reunion')
  const [submittingEvent, setSubmittingEvent] = useState(false)

  // Fetch proposals
  useEffect(() => {
    let cancelled = false
    async function fetchProposals() {
      try {
        const [activeRes, archiveRes] = await Promise.all([
          supabase
            .from('proposals')
            .select('id,title,description,category,status,supports,votes_pour,votes_contre,votes_blanc,tags,created_at,blockchain_proof')
            .eq('organisation_id', commune.id)
            .in('status', ['seedling', 'review', 'voting'])
            .order('created_at', { ascending: false }),
          supabase
            .from('proposals')
            .select('id,title,description,category,status,supports,votes_pour,votes_contre,votes_blanc,tags,created_at,blockchain_proof')
            .eq('organisation_id', commune.id)
            .in('status', ['adopted', 'rejected', 'closed'])
            .order('created_at', { ascending: false }),
        ])
        if (!cancelled) {
          if (activeRes.data) setActiveProposals((activeRes.data as ProposalRow[]).map(mapRowToProposal))
          if (archiveRes.data) setArchivedProposals((archiveRes.data as ProposalRow[]).map(mapRowToProposal))
        }
      } catch { /* fallback vide */ } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchProposals()
    return () => { cancelled = true }
  }, [commune.id])

  // Fetch news
  useEffect(() => {
    let cancelled = false
    supabase
      .from('commune_news')
      .select('*')
      .eq('organisation_id', commune.id)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled && data) setNews(data as CommuneNews[])
        if (!cancelled) setLoadingNews(false)
      })
    return () => { cancelled = true }
  }, [commune.id])

  // Fetch events (upcoming first)
  useEffect(() => {
    let cancelled = false
    supabase
      .from('commune_agenda')
      .select('*')
      .eq('organisation_id', commune.id)
      .eq('is_published', true)
      .gte('event_date', new Date().toISOString())
      .order('event_date', { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) setEvents(data as CommuneEvent[])
        if (!cancelled) setLoadingEvents(false)
      })
    return () => { cancelled = true }
  }, [commune.id])

  const handleVoted = useCallback(async (proposalId: string, choice: VoteChoice, oldChoice?: VoteChoice) => {
    const isRevote = oldChoice !== undefined
    setVotingProposal(null)
    setAgoraProposal(null)

    const choiceMap: Record<VoteChoice, string> = {
      pour: 'YES', contre: 'NO', blanc: 'ABSTAIN',
    }
    const mappedChoice = choiceMap[choice]

    setVotedChoices(prev => ({ ...prev, [proposalId]: choice }))
    setActiveProposals(prev => prev.map(p => {
      if (p.id !== proposalId) return p
      const v = { ...p.votes, [choice]: p.votes[choice] + 1 }
      if (oldChoice) v[oldChoice] = Math.max(0, v[oldChoice] - 1)
      return { ...p, votes: v }
    }))

    const proof = await generateVoteProof(proposalId, mappedChoice)
    const voteParams = {
      p_proposal_id: String(proposalId),
      p_user_hash: userHash,
      p_choice: mappedChoice,
      p_proof_hash: proof,
    }

    try {
      const { error } = await supabase.rpc('deposer_bulletin', voteParams)

      if (error) throw new Error('DB Error')

      if (isRevote) {
        showToast('Vote mis à jour ✓', 'info')
      } else {
        setResultsProposalId(proposalId)
      }
    } catch (e) {
      const pending = loadPendingVotes()
      if (!pending.some(v => v.proposalId === proposalId)) {
        savePendingVotes([...pending, { proposalId, userHash, choice: mappedChoice, timestamp: Date.now() }])
      }
      showToast('Réseau faible. Vote sauvegardé et synchronisé à la prochaine connexion.', 'warning')
    }
  }, [userHash])

  async function handlePublishNews() {
    if (!newsTitle.trim() || !newsContent.trim()) return
    setSubmittingNews(true)
    const draft: CommuneNews = {
      id: `draft-${Date.now()}`,
      organisation_id: commune.id,
      title: newsTitle,
      content: newsContent,
      category: newsCategory,
      published_at: new Date().toISOString(),
      is_published: true,
      created_by: userHash,
    }
    setNews(prev => [draft, ...prev])
    setShowNewsForm(false)
    setNewsTitle(''); setNewsContent('')
    try {
      const { error } = await supabase.from('commune_news').insert({
        organisation_id: commune.id,
        title: newsTitle,
        content: newsContent,
        category: newsCategory,
        is_published: true,
        created_by: userHash,
      })
      if (error) throw error
    } catch {
      showToast('Une erreur est survenue. Réessayez.')
    }
    setSubmittingNews(false)
  }

  async function handlePublishEvent() {
    if (!evTitle.trim() || !evDate) return
    setSubmittingEvent(true)
    const draft: CommuneEvent = {
      id: `draft-${Date.now()}`,
      organisation_id: commune.id,
      title: evTitle,
      description: evDesc || undefined,
      event_date: evDate,
      end_date: evEndDate || undefined,
      location: evLocation || undefined,
      category: evCategory,
      is_published: true,
      created_by: userHash,
    }
    setEvents(prev => [...prev, draft].sort((a, b) => a.event_date.localeCompare(b.event_date)))
    setShowEventForm(false)
    setEvTitle(''); setEvDesc(''); setEvDate(''); setEvEndDate(''); setEvLocation('')
    try {
      const { error } = await supabase.from('commune_agenda').insert({
        organisation_id: commune.id,
        title: evTitle,
        description: evDesc || null,
        event_date: evDate,
        end_date: evEndDate || null,
        location: evLocation || null,
        category: evCategory,
        is_published: true,
        created_by: userHash,
      })
      if (error) throw error
    } catch {
      showToast('Une erreur est survenue. Réessayez.')
    }
    setSubmittingEvent(false)
  }

  const NEWS_CATEGORY_STYLE: Record<CommuneNews['category'], { label: string; bg: string; text: string }> = {
    info: { label: 'Info', bg: 'bg-blue-100', text: 'text-blue-700' },
    travaux: { label: 'Travaux', bg: 'bg-orange-100', text: 'text-orange-700' },
    evenement: { label: 'Événement', bg: 'bg-green-100', text: 'text-green-700' },
    urgence: { label: 'Urgence', bg: 'bg-red-100', text: 'text-red-700' },
  }

  const EVENT_CATEGORY_STYLE: Record<CommuneEvent['category'], { label: string; bg: string; text: string }> = {
    conseil: { label: 'Conseil', bg: 'bg-indigo-100', text: 'text-indigo-700' },
    fete: { label: 'Fête', bg: 'bg-purple-100', text: 'text-purple-700' },
    marche: { label: 'Marché', bg: 'bg-amber-100', text: 'text-amber-700' },
    reunion: { label: 'Réunion', bg: 'bg-slate-100', text: 'text-slate-700' },
    autre: { label: 'Autre', bg: 'bg-gray-100', text: 'text-gray-600' },
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-indigo-700 px-5 pt-10 pb-6 text-white">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-indigo-200 text-xs font-medium mb-5 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Retour à Mon Compte
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span className="inline-block text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/50 text-indigo-100 mb-2">
              Commune partenaire CHOISISSONS
            </span>
            <h1 className="text-xl font-black leading-tight">{commune.name}</h1>
            {commune.code_insee && (
              <p className="text-indigo-300 text-xs mt-0.5">Code INSEE : {commune.code_insee}</p>
            )}
          </div>
          {commune.population != null && (
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black">{commune.population.toLocaleString('fr-FR')}</p>
              <p className="text-indigo-300 text-xs">habitants</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs — scrollable so 4 items fit on mobile */}
      <div className="flex gap-1 overflow-x-auto px-4 mt-4 pb-1" style={{ scrollbarWidth: 'none' }}>
        {([
          { key: 'consultations' as const, label: 'Consultations' },
          { key: 'archives' as const, label: 'Archives' },
          { key: 'actus' as const, label: 'Actualités' },
          { key: 'agenda' as const, label: 'Agenda' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${tab === t.key
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-200 text-slate-500'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* ── Consultations actives ── */}
        {tab === 'consultations' && (
          loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                </div>
              ))}
            </div>
          ) : activeProposals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
              <Vote size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">Aucune consultation en cours</p>
              <p className="text-xs text-slate-300 mt-1">Les prochaines consultations apparaîtront ici</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {activeProposals.map(proposal => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onOpen={() => setAgoraProposal(proposal)}
                  currentVote={votedChoices[proposal.id]}
                  onRevote={() => setVotingProposal(proposal)}
                />
              ))}
            </div>
          )
        )}

        {/* ── Archives ── */}
        {tab === 'archives' && (
          loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                  <div className="h-2 bg-slate-100 rounded w-full" />
                </div>
              ))}
            </div>
          ) : archivedProposals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
              <BookOpen size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">Aucune consultation archivée</p>
            </div>
          ) : (
            <div className="space-y-3">
              {archivedProposals.map(p => {
                const total = p.votes.pour + p.votes.contre + p.votes.blanc
                const pourPct = total > 0 ? Math.round((p.votes.pour / total) * 100) : 0
                const contrePct = total > 0 ? Math.round((p.votes.contre / total) * 100) : 0
                const blancPct = 100 - pourPct - contrePct
                return (
                  <div key={p.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-slate-800 flex-1 leading-snug">{p.title}</h3>
                      <StageBadge stage={p.stage} />
                    </div>
                    <p className="text-xs text-slate-400 mb-3">
                      {p.date} · {total.toLocaleString('fr-FR')} vote{total !== 1 ? 's' : ''}
                    </p>
                    {total > 0 ? (
                      <>
                        <div className="flex h-2 rounded-full overflow-hidden mb-1.5">
                          <div className="bg-green-500" style={{ width: `${pourPct}%` }} />
                          <div className="bg-red-400" style={{ width: `${contrePct}%` }} />
                          <div className="bg-slate-200" style={{ width: `${blancPct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-green-600 font-semibold">Pour {pourPct}%</span>
                          <span className="text-slate-400">Blanc {blancPct}%</span>
                          <span className="text-red-500 font-semibold">Contre {contrePct}%</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-300 italic">Aucun vote enregistré</p>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── Actualités ── */}
        {tab === 'actus' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-700">Actualités de {commune.name}</h2>
              {canDo(userRole, 'publish_news') && (
                <button
                  onClick={() => setShowNewsForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white active:scale-95 transition-all"
                >
                  <Plus size={12} />
                  Publier
                </button>
              )}
            </div>

            {loadingNews ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                    <div className="h-3 bg-slate-100 rounded w-1/3 mb-2" />
                    <div className="h-4 bg-slate-100 rounded w-3/4 mb-1" />
                    <div className="h-3 bg-slate-100 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : news.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <Newspaper size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">Aucune actualité publiée</p>
                {canDo(userRole, 'publish_news') && (
                  <p className="text-xs text-slate-300 mt-1">Publiez la première actualité de votre commune</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {news.map(item => {
                  const style = NEWS_CATEGORY_STYLE[item.category]
                  return (
                    <div key={item.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                        <span className="text-xs text-slate-400 ml-auto">
                          {new Date(item.published_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-800 text-sm leading-snug mb-1">{item.title}</h3>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{item.content}</p>
                      {item.author_name && (
                        <p className="text-xs text-slate-400 mt-2">— {item.author_name}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Formulaire publication */}
            {showNewsForm && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-end p-4">
                <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-sm">Publier une actualité</h3>
                    <button onClick={() => setShowNewsForm(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <X size={15} className="text-slate-500" />
                    </button>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Catégorie</label>
                      <div className="flex gap-2 flex-wrap">
                        {(Object.entries(NEWS_CATEGORY_STYLE) as [CommuneNews['category'], { label: string; bg: string; text: string }][]).map(([k, v]) => (
                          <button
                            key={k}
                            onClick={() => setNewsCategory(k)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${newsCategory === k ? `${v.bg} ${v.text} border-current` : 'border-slate-200 text-slate-500 bg-white'
                              }`}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Titre</label>
                      <input
                        type="text"
                        value={newsTitle}
                        onChange={e => setNewsTitle(e.target.value)}
                        placeholder="Titre de l'actualité"
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Contenu</label>
                      <textarea
                        value={newsContent}
                        onChange={e => setNewsContent(e.target.value)}
                        placeholder="Rédigez votre actualité..."
                        rows={4}
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                      />
                    </div>
                  </div>
                  <div className="px-5 pb-5 flex gap-3">
                    <button onClick={() => setShowNewsForm(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">Annuler</button>
                    <button
                      onClick={handlePublishNews}
                      disabled={!newsTitle.trim() || !newsContent.trim() || submittingNews}
                      className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      {submittingNews
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : 'Publier'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Agenda ── */}
        {tab === 'agenda' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-700">Agenda de {commune.name}</h2>
              {canDo(userRole, 'publish_agenda') && (
                <button
                  onClick={() => setShowEventForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white active:scale-95 transition-all"
                >
                  <Plus size={12} />
                  Ajouter
                </button>
              )}
            </div>

            {loadingEvents ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                    <div className="h-8 bg-slate-100 rounded w-1/4 mb-3" />
                    <div className="h-4 bg-slate-100 rounded w-2/3 mb-1" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <Info size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">Aucun événement à venir</p>
                {canDo(userRole, 'publish_agenda') && (
                  <p className="text-xs text-slate-300 mt-1">Ajoutez le premier événement de votre commune</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {events.map(ev => {
                  const style = EVENT_CATEGORY_STYLE[ev.category]
                  const d = new Date(ev.event_date)
                  const dayStr = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
                  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={ev.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex gap-4">
                      <div className="flex-shrink-0 text-center w-14">
                        <p className="text-2xl font-black text-indigo-600 leading-none">{d.getDate()}</p>
                        <p className="text-xs text-slate-400 font-medium uppercase">
                          {d.toLocaleDateString('fr-FR', { month: 'short' })}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm leading-snug">{ev.title}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {dayStr} · {timeStr}
                          {ev.location && ` · ${ev.location}`}
                        </p>
                        {ev.description && (
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{ev.description}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Formulaire agenda */}
            {showEventForm && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-end p-4">
                <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
                    <h3 className="font-bold text-slate-800 text-sm">Ajouter un événement</h3>
                    <button onClick={() => setShowEventForm(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <X size={15} className="text-slate-500" />
                    </button>
                  </div>
                  <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Catégorie</label>
                      <div className="flex gap-2 flex-wrap">
                        {(Object.entries(EVENT_CATEGORY_STYLE) as [CommuneEvent['category'], { label: string; bg: string; text: string }][]).map(([k, v]) => (
                          <button
                            key={k}
                            onClick={() => setEvCategory(k)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${evCategory === k ? `${v.bg} ${v.text} border-current` : 'border-slate-200 text-slate-500 bg-white'
                              }`}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Titre *</label>
                      <input type="text" value={evTitle} onChange={e => setEvTitle(e.target.value)} placeholder="Titre de l'événement"
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date de début *</label>
                        <input type="datetime-local" value={evDate} onChange={e => setEvDate(e.target.value)}
                          className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 [color-scheme:light]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date de fin</label>
                        <input type="datetime-local" value={evEndDate} onChange={e => setEvEndDate(e.target.value)}
                          className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 [color-scheme:light]" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Lieu</label>
                      <input type="text" value={evLocation} onChange={e => setEvLocation(e.target.value)} placeholder="Salle des fêtes, mairie…"
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
                      <textarea value={evDesc} onChange={e => setEvDesc(e.target.value)} rows={3} placeholder="Décrivez l'événement…"
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                    </div>
                  </div>
                  <div className="px-5 pb-5 flex gap-3 flex-shrink-0">
                    <button onClick={() => setShowEventForm(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">Annuler</button>
                    <button
                      onClick={handlePublishEvent}
                      disabled={!evTitle.trim() || !evDate || submittingEvent}
                      className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      {submittingEvent
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : 'Ajouter'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modales voting */}
      {agoraProposal && !votingProposal && (
        <AgoraModal
          proposal={agoraProposal}
          onVote={() => setVotingProposal(agoraProposal)}
          onClose={() => setAgoraProposal(null)}
          hasVoted={agoraProposal.id in votedChoices}
        />
      )}
      {votingProposal && (
        <VotingBooth
          proposal={votingProposal}
          onVoted={(choice) => handleVoted(votingProposal.id, choice, votedChoices[votingProposal.id])}
          onClose={() => setVotingProposal(null)}
        />
      )}
      {resultsProposalId && (
        <ResultsModal
          proposalId={resultsProposalId}
          onClose={() => setResultsProposalId(null)}
        />
      )}
    </div>
  )
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activePage, setActivePage] = useState<NavPage>('home')
  const [showPropose, setShowPropose] = useState(false)
  const [pendingCategory, setPendingCategory] = useState<string | undefined>(undefined)
  const [selectedCommune, setSelectedCommune] = useState<Organisation | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<Organisation | null>(null)
  const [selectedCommunePage, setSelectedCommunePage] = useState<Organisation | null>(null)
  const [communePageRole, setCommunePageRole] = useState<CommuneRole>('member')
  const [communeEluRole, setCommuneEluRole] = useState<CommuneRole>('admin')
  const [userHash, setUserHash] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  // Auth useEffect en premier : le listener doit être actif avant getSession
  // pour ne pas manquer le SIGNED_IN déclenché par le token du magic link dans l'URL
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        // TODO Phase 2: FranceConnect — remplacer session.user.id par l'identifiant FranceConnect vérifié
        const hash = await getSupabaseIdentity(session.user.id)
        setUserHash(hash)
        setUserEmail(session.user.email ?? '')
        setIsLoggedIn(true)
        flushPendingVotes()
        window.history.replaceState(null, '', window.location.pathname)

        // Rattachement commune via lien d'invitation + profil inscription
        if (event === 'SIGNED_IN') {
          const pendingCommune = localStorage.getItem('pending_commune')
          if (pendingCommune) {
            await supabase.from('profiles').update({ commune_name: pendingCommune }).eq('id', session.user.id)
            localStorage.removeItem('pending_commune')
            showToast(`Bienvenue ! Vous êtes rattaché à ${pendingCommune}`, 'info')
          }
          const pendingProfile = localStorage.getItem('pending_profile')
          if (pendingProfile) {
            try {
              const { code_postal, date_naissance_hash } = JSON.parse(pendingProfile) as {
                code_postal: string
                date_naissance_hash: string
              }
              await supabase.from('profiles').upsert({
                id: session.user.id,
                code_postal,
                date_naissance_hash,
                verification_status: 'unverified',
              }, { onConflict: 'id' })
            } catch { /* ignore parse / network errors */ }
            localStorage.removeItem('pending_profile')
          }
        }
      }
      if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false)
      }
    })

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const hash = await getSupabaseIdentity(session.user.id)
        setUserHash(hash)
        setUserEmail(session.user.email ?? '')
        setIsLoggedIn(true)
        flushPendingVotes()
        setIsLoading(false)
        return
      }
      // iOS PWA standalone: getSession() may not find the session saved in Safari context —
      // try restoring manually from the known storage key
      try {
        const saved = localStorage.getItem('choisissons-auth')
        if (saved) {
          const parsed = JSON.parse(saved) as { access_token?: string; refresh_token?: string }
          if (parsed?.access_token && parsed?.refresh_token) {
            await supabase.auth.setSession({
              access_token: parsed.access_token,
              refresh_token: parsed.refresh_token,
            })
            // onAuthStateChange will fire SIGNED_IN and complete the login flow
            setIsLoading(false)
            return
          }
        }
      } catch { /* malformed storage entry — ignore */ }
      setIsLoading(false)
    })

    // iOS PWA: when the user returns to the app after clicking the magic link in Safari,
    // Safari has already stored the session in localStorage (shared origin on iOS 14.3+).
    // Re-check on every visibility-restored event so the app picks it up without a reload.
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return
      const { data: { session } } = await supabase.auth.getSession()
      if (session) return
      try {
        const saved = localStorage.getItem('choisissons-auth')
        if (saved) {
          const parsed = JSON.parse(saved) as { access_token?: string; refresh_token?: string }
          if (parsed?.access_token && parsed?.refresh_token) {
            await supabase.auth.setSession({
              access_token: parsed.access_token,
              refresh_token: parsed.refresh_token,
            })
          }
        }
      } catch { /* ignore */ }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    _toastHandler = (entry) => setToasts(prev => [...prev, entry])

    // Invitation commune via ?commune=nom
    const params = new URLSearchParams(window.location.search)
    const communeParam = params.get('commune')
    if (communeParam) {
      localStorage.setItem('pending_commune', communeParam)
      window.history.replaceState(null, '', window.location.pathname)
    }

    if (window.location.pathname === '/merci') {
      window.history.replaceState(null, '', '/')
      showToast('Merci pour votre soutien ! Votre abonnement est maintenant actif.', 'info')
    }
    return () => { _toastHandler = null }
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const handleSelectCategory = (cat: string) => {
    setPendingCategory(cat)
    setActivePage('home')
  }

  const handleNavigateElu = (commune: Organisation, role: CommuneRole) => {
    setSelectedCommune(commune)
    setCommuneEluRole(role)
    setActivePage('elu')
  }

  const handleNavigateOrg = (org: Organisation) => {
    setSelectedOrg(org)
    setActivePage('org')
  }

  const handleNavigateCommune = (commune: Organisation, role: CommuneRole) => {
    setSelectedCommunePage(commune)
    setCommunePageRole(role)
    setActivePage('commune')
  }

  const navItems: { page: NavPage; label: string; icon: ElementType }[] = [
    { page: 'home', label: 'Accueil', icon: Home },
    { page: 'explore', label: 'Explorer', icon: Compass },
    { page: 'profile', label: 'Mon Compte', icon: User },
    { page: 'support', label: 'Soutenir', icon: Heart },
    { page: 'impact', label: 'Impact', icon: TrendingUp },
    { page: 'library', label: 'Bibliothèque', icon: BookOpen },
  ]

  if (isLoading) return <div className="min-h-screen bg-white" />
  if (!isLoggedIn && activePage !== 'library') return <LoginScreen />

  // Full-screen dashboards — no nav bar
  if (activePage === 'elu' && selectedCommune) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="max-w-md mx-auto md:max-w-[900px] xl:max-w-[1100px] min-h-screen overflow-y-auto">
          <ElectedDashboard
            commune={selectedCommune}
            userRole={communeEluRole}
            onBack={() => setActivePage('profile')}
          />
        </div>
      </>
    )
  }

  if (activePage === 'org' && selectedOrg) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="max-w-md mx-auto md:max-w-[900px] xl:max-w-[1100px] min-h-screen overflow-y-auto">
          <OrgDashboard
            org={selectedOrg}
            onBack={() => setActivePage('profile')}
          />
        </div>
      </>
    )
  }

  if (activePage === 'admin' && ADMIN_EMAILS.includes(userEmail)) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="max-w-md mx-auto md:max-w-[900px] xl:max-w-[1100px] min-h-screen overflow-y-auto">
          <AdminDashboard onBack={() => setActivePage('profile')} />
        </div>
      </>
    )
  }

  if (activePage === 'commune-register') {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="max-w-md mx-auto md:max-w-[640px] min-h-screen overflow-y-auto">
          <CommuneRegistration onBack={() => setActivePage('explore')} />
        </div>
      </>
    )
  }

  if (activePage === 'assoc-register') {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="max-w-md mx-auto md:max-w-[640px] min-h-screen overflow-y-auto">
          <AssociationRegistration onBack={() => setActivePage('explore')} />
        </div>
      </>
    )
  }

  if (activePage === 'commune' && selectedCommunePage) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="max-w-md mx-auto md:max-w-[900px] xl:max-w-[1100px] min-h-screen overflow-y-auto">
          <CommunePage
            commune={selectedCommunePage}
            userRole={communePageRole}
            userHash={userHash}
            onBack={() => setActivePage('profile')}
          />
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:w-56 xl:w-64 md:flex-col md:bg-white md:border-r md:border-slate-100 md:z-30">
        <div className="p-5 xl:p-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="" className="h-12 w-auto" />
            <span className="font-bold text-indigo-600 text-xl">CHOISISSONS</span>
          </div>
          <p className="hidden xl:block text-xs text-slate-400 mt-1">La démocratie participative</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {navItems.map(({ page, label, icon: Icon }) => {
            const active = activePage === page
            return (
              <button
                key={page}
                onClick={() => setActivePage(page)}
                className={`w-full flex items-center gap-3 px-4 xl:px-5 py-3 text-sm xl:text-base text-left transition-colors ${active
                  ? 'text-indigo-600 bg-indigo-50 font-semibold border-r-2 border-indigo-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>
        <div className="p-4 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={() => setShowPropose(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Proposer
          </button>
        </div>
      </aside>

      {/* ── Desktop header ───────────────────────────────────── */}
      <header className="hidden md:flex md:fixed md:top-0 md:left-56 xl:left-64 md:right-0 md:h-14 md:bg-white md:border-b md:border-slate-100 md:z-20 md:items-center md:px-6 md:gap-4">
        <h2 className="font-bold text-slate-800 text-base">
          {navItems.find(n => n.page === activePage)?.label ?? ''}
        </h2>
        <div className="ml-auto flex items-center">
          <button
            onClick={() => setActivePage('profile')}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-indigo-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-50"
          >
            <User size={17} />
            <span className="max-w-[180px] truncate">{userEmail || 'Mon compte'}</span>
          </button>
        </div>
      </header>

      {/* ── Content area ─────────────────────────────────────── */}
      <div className="md:pl-56 xl:pl-64 md:pt-14">
        <main className="pb-24 md:pb-10 md:max-w-[900px] xl:max-w-[1100px] md:mx-auto">
          {activePage === 'home' && <HomePage initialCategory={pendingCategory} userHash={userHash} />}
          {activePage === 'explore' && <ExplorePage onSelectCategory={handleSelectCategory} userHash={userHash} onNavigateCommuneRegister={() => setActivePage('commune-register')} onNavigateAssocRegister={() => setActivePage('assoc-register')} />}
          {activePage === 'profile' && (
            <ProfilePage
              onLogout={() => { void supabase.auth.signOut(); setActivePage('home') }}
              onNavigateElu={handleNavigateElu}
              onNavigateOrg={handleNavigateOrg}
              onNavigateAdmin={() => setActivePage('admin')}
              onNavigateCommune={handleNavigateCommune}
              userHash={userHash}
              userEmail={userEmail}
            />
          )}
          {activePage === 'support' && <SupportPage />}
          {activePage === 'impact' && <ImpactPage />}
          {activePage === 'library' && <LibraryPage />}
        </main>
      </div>

      {/* ── Mobile FAB ───────────────────────────────────────── */}
      <button
        onClick={() => setShowPropose(true)}
        aria-label="Proposer une idée"
        className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-300 flex items-center justify-center text-white active:scale-90 transition-all z-40"
      >
        <Plus size={26} />
      </button>

      {/* ── Mobile bottom navigation ─────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 z-30">
        <div className="flex">
          {navItems.map(({ page, label, icon: Icon }) => {
            const active = activePage === page
            return (
              <button
                key={page}
                onClick={() => setActivePage(page)}
                className={`relative flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${active ? 'text-indigo-600' : 'text-slate-400'
                  }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-indigo-600 rounded-full" />
                )}
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className={`text-xs ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Propose modal */}
      {showPropose && <ProposeModal onClose={() => setShowPropose(false)} userHash={userHash} />}
    </div>
  )
}
