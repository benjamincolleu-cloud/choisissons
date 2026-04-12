import { useState, useCallback, useEffect } from 'react'
import type { ElementType } from 'react'
import { supabase } from './supabaseClient'
import { getVoterHash, generateVoteProof } from './lib/identity'
import {
  Home, Compass, User, Heart, Plus, ChevronRight,
  ThumbsUp, ThumbsDown, Minus, X, CheckCircle, XCircle,
  Sprout, Users, Vote, Shield, BookOpen,
  Lock, Star, Newspaper,
  Building2, ArrowLeft, Info, Landmark,
  Settings, LogOut, Bell, Globe, Trash2, ExternalLink, FileText,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────
type Stage = 'seedling' | 'review' | 'voting' | 'adopted' | 'rejected'
type VoteChoice = 'pour' | 'contre' | 'blanc'
type NavPage = 'home' | 'explore' | 'profile' | 'support' | 'elu' | 'org'

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
}

interface MockUser {
  name: string
  commune: string
  avatar: string
  votesCount: number
  proposalsCount: number
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
    votes: { pour: 12847, contre: 4231, blanc: 892 },
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
    votes: { pour: 28934, contre: 6102, blanc: 2341 },
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
    votes: { pour: 8934, contre: 1202, blanc: 445 },
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

const MOCK_USER: MockUser = {
  name: 'Laetitia Benjamin',
  commune: 'Paris 11e',
  avatar: 'LB',
  votesCount: 7,
  proposalsCount: 2,
}

// ── Utilities ──────────────────────────────────────────────────

// ── Toast system ───────────────────────────────────────────────
interface ToastEntry { id: number; message: string; type: 'error' | 'info' }
let _toastHandler: ((entry: ToastEntry) => void) | null = null
let _toastCounter = 0
function showToast(message: string, type: 'error' | 'info' = 'error') {
  _toastHandler?.({ id: ++_toastCounter, message, type })
}

// ── Pending votes ──────────────────────────────────────────────
interface PendingVote { proposalId: string; userHash: string; choice: string; proofHash: string; timestamp: number }
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
      const { data, error } = await supabase.rpc('cast_vote', {
        p_proposal_id: v.proposalId,
        p_user_hash: v.userHash,
        p_choice: v.choice,
        p_proof_hash: v.proofHash,
        p_timestamp: v.timestamp,
      })
      // already_voted means the vote was already recorded — don't retry
      if (error || (data as { error?: string } | null)?.error === 'already_voted') {
        // drop silently
      } else if (data && (data as { error?: string }).error) {
        remaining.push(v)
      }
    } catch { remaining.push(v) }
  }
  savePendingVotes(remaining)
  if (remaining.length < pending.length) {
    showToast(`${pending.length - remaining.length} vote(s) en attente synchronisé(s).`, 'info')
  }
}

const STAGE_CONFIG: Record<Stage, { label: string; color: string; icon: ElementType; description: string }> = {
  seedling: { label: 'Pépinière', color: 'bg-emerald-100 text-emerald-700', icon: Sprout, description: 'En cours de signatures' },
  review:   { label: 'Jury citoyen', color: 'bg-amber-100 text-amber-700', icon: Users, description: 'Examinée par le jury' },
  voting:   { label: 'Vote ouvert', color: 'bg-indigo-100 text-indigo-700', icon: Vote, description: 'Votez maintenant' },
  adopted:  { label: 'Adoptée', color: 'bg-green-100 text-green-700', icon: CheckCircle, description: 'Proposition adoptée' },
  rejected: { label: 'Rejetée', color: 'bg-red-100 text-red-700', icon: XCircle, description: 'Proposition rejetée' },
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
  const pourPct  = Math.round((votes.pour / total) * 100)
  const contrePct = Math.round((votes.contre / total) * 100)
  const blancPct  = 100 - pourPct - contrePct
  return (
    <div className="mt-2">
      <div className="flex h-2 rounded-full overflow-hidden">
        <div className="bg-green-500 transition-all" style={{ width: `${pourPct}%` }} />
        <div className="bg-red-400 transition-all"   style={{ width: `${contrePct}%` }} />
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
  const colors = entry.type === 'error'
    ? 'bg-red-600 text-white'
    : 'bg-slate-800 text-white'
  const Icon = entry.type === 'error' ? XCircle : CheckCircle
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
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500 mb-3">
            <Vote size={24} className="text-white" />
          </div>
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
              { icon: BookOpen, label: 'Transparence',   desc: 'Toutes les décisions et les votes agrégés sont publics.' },
              { icon: Lock,     label: 'Anonymat',       desc: 'Votre vote individuel est chiffré et ne peut être tracé.' },
              { icon: Shield,   label: 'Souveraineté',   desc: 'Aucun acteur privé ni politique ne contrôle la plateforme.' },
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

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [loading, setLoading]         = useState(false)
  const [activeStep, setActiveStep]   = useState<number | null>(null)
  const [showAbout, setShowAbout]     = useState(false)

  const handleLogin = () => {
    setLoading(true)
    setTimeout(onLogin, 1500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-indigo-500 mb-4 shadow-2xl">
            <Vote size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">CHOISISSONS</h1>
          <p className="text-indigo-300 mt-2 text-sm">La démocratie directe citoyenne</p>
        </div>

        {/* Value props */}
        <div className="space-y-3 mb-8">
          {[
            { icon: Shield, text: 'Vote anonyme et vérifié cryptographiquement' },
            { icon: Users,  text: 'Jury citoyen indépendant' },
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

        {/* FranceConnect button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-[#003189] text-white rounded-xl py-4 px-6 font-semibold text-base flex items-center justify-center gap-3 shadow-xl hover:bg-[#002570] active:scale-95 transition-all disabled:opacity-70"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span className="text-xl font-black tracking-tighter">FC</span>
              <span>Se connecter avec FranceConnect</span>
            </>
          )}
        </button>

        <p className="text-center text-indigo-400 text-xs mt-3">
          Prototype en cours de développement — FranceConnect réel en Phase 2
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
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-1 transition-colors ${
                    activeStep === i ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white group-hover:bg-indigo-400'
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
  const pourArgs  = proposal.arguments.filter(a => a.type === 'pour')
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
  const [selected, setSelected]   = useState<VoteChoice | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [voted, setVoted]         = useState(false)
  const [hash, setHash]           = useState('')
  const [loading, setLoading]     = useState(false)

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
    { choice: 'pour',   label: 'Pour',   icon: <ThumbsUp size={28} />,   selectedColor: 'text-green-600', selectedBg: 'bg-green-50',  selectedBorder: 'border-green-400' },
    { choice: 'contre', label: 'Contre', icon: <ThumbsDown size={28} />, selectedColor: 'text-red-500',   selectedBg: 'bg-red-50',    selectedBorder: 'border-red-400' },
    { choice: 'blanc',  label: 'Blanc',  icon: <Minus size={28} />,      selectedColor: 'text-slate-500', selectedBg: 'bg-slate-50',  selectedBorder: 'border-slate-400' },
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
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-95 ${
                  active
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
                selected === 'pour'   ? 'text-green-600' :
                selected === 'contre' ? 'text-red-500'   : 'text-slate-500'
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
            pour:   (data as { votes_pour: number }).votes_pour   ?? 0,
            contre: (data as { votes_contre: number }).votes_contre ?? 0,
            blanc:  (data as { votes_blanc: number }).votes_blanc  ?? 0,
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

  const total     = votes.pour + votes.contre + votes.blanc
  const pourPct   = total > 0 ? Math.round((votes.pour   / total) * 100) : 0
  const contrePct = total > 0 ? Math.round((votes.contre / total) * 100) : 0
  const blancPct  = 100 - pourPct - contrePct

  const bars = [
    { label: 'Pour',        pct: pourPct,   color: 'bg-green-500', textColor: 'text-green-600', count: votes.pour   },
    { label: 'Contre',      pct: contrePct, color: 'bg-red-400',   textColor: 'text-red-500',   count: votes.contre },
    { label: 'Vote blanc',  pct: blancPct,  color: 'bg-slate-300', textColor: 'text-slate-500', count: votes.blanc  },
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
function ProposalCard({ proposal, onOpen }: { proposal: Proposal; onOpen: () => void }) {
  const total    = proposal.votes.pour + proposal.votes.contre + proposal.votes.blanc
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
        {proposal.stage === 'review' ? (
          <button
            disabled
            className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-amber-50 text-amber-500 border border-amber-200 cursor-not-allowed"
          >
            <Users size={15} />
            Vote disponible après validation
          </button>
        ) : (
          <button
            onClick={onOpen}
            className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
              proposal.stage === 'voting'
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
    votes: { pour: 8342, contre: 12104, blanc: 1203 },
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
    votes: { pour: 5621, contre: 2890, blanc: 744 },
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
    officialUrl: 'https://www.assemblee-nationale.fr/dyn/16/textes/l16b0256_projet-loi',
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
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-4">
        {/* Badges row */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-xs font-bold text-white bg-[#002395] rounded-full px-2.5 py-0.5">
            Assemblée Nationale
          </span>
          <span className="text-xs font-semibold text-slate-400">{law.number}</span>
          <span className="ml-auto text-xs text-slate-400">{law.category}</span>
        </div>

        <h3 className="font-bold text-slate-800 text-base leading-snug mb-1">{law.title}</h3>
        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mb-3">{law.description}</p>

        {/* Vote date + texte officiel */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <BookOpen size={12} className="text-slate-400" />
            <span>Vote Parlement : <strong className="text-slate-700">{law.parliamentVoteDate}</strong></span>
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

        {/* Vote bar */}
        {total > 0 && <VoteBar votes={law.votes} />}
        {total > 0 && (
          <p className="text-xs text-slate-400 mt-1">{total.toLocaleString('fr-FR')} avis citoyens</p>
        )}
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={onOpen}
          className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
            law.stage === 'voting'
              ? 'bg-[#002395] text-white shadow-md shadow-blue-200'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          {law.stage === 'voting' ? <Vote size={15} /> : <Info size={15} />}
          {law.stage === 'voting' ? "Lire & Voter" : "Lire le texte"}
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
  const [proposals, setProposals]           = useState<Proposal[]>(PROPOSALS)
  const [loading, setLoading]               = useState(true)
  const [activeStage, setActiveStage]       = useState<Stage | 'all'>('all')
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory ?? null)
  const [agoraProposal, setAgoraProposal]   = useState<Proposal | null>(null)
  const [votingProposal, setVotingProposal] = useState<Proposal | null>(null)
  const [votedIds, setVotedIds]             = useState<Set<string>>(new Set())
  const [resultsProposalId, setResultsProposalId] = useState<string | null>(null)

  // ── Lois en cours state ────────────────────────────────────────
  const [laws, setLaws]             = useState<ParliamentaryLaw[]>(PARLIAMENTARY_LAWS_INITIAL)
  const [lawVotedIds, setLawVotedIds] = useState<Set<string>>(new Set())
  const [agoraLaw, setAgoraLaw]     = useState<Proposal | null>(null)
  const [votingLaw, setVotingLaw]   = useState<Proposal | null>(null)

  // Fetch from Supabase, fall back to mock data on error
  useEffect(() => {
    let cancelled = false
    async function fetchProposals() {
      try {
        const { data, error } = await supabase
          .from('proposals')
          .select('id,title,description,category,status,supports,votes_pour,votes_contre,votes_blanc,tags,created_at')
          .order('created_at', { ascending: false })
        if (error) throw error
        if (!cancelled && data && data.length > 0) {
          setProposals((data as ProposalRow[]).map(mapRowToProposal))
        }
      } catch {
        showToast('Connexion impossible. Réessayez dans quelques instants.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchProposals()
    return () => { cancelled = true }
  }, [])

  const filtered = proposals.filter(p => {
    const stageOk    = activeStage === 'all' || p.stage === activeStage
    const categoryOk = !activeCategory || p.category === activeCategory
    return stageOk && categoryOk
  })

  const handleVoted = useCallback(async (proposalId: string, choice: VoteChoice, proofHash: string) => {
    setVotedIds(prev => new Set([...prev, proposalId]))
    setProposals(prev =>
      prev.map(p =>
        p.id !== proposalId
          ? p
          : { ...p, votes: { ...p.votes, [choice]: p.votes[choice] + 1 } }
      )
    )
    setVotingProposal(null)
    setAgoraProposal(null)

    const choiceMap: Record<VoteChoice, string> = {
      pour: 'YES', contre: 'NO', blanc: 'ABSTAIN',
    }

    const { data, error } = await supabase.rpc('cast_vote', {
      p_proposal_id: proposalId,
      p_user_hash: userHash,
      p_choice: choiceMap[choice],
      p_proof_hash: proofHash,
      p_timestamp: Date.now(),
    })

    if (error) {
      showToast('Connexion impossible.', 'error')
    } else if ((data as { error?: string } | null)?.error === 'already_voted') {
      showToast('Vous avez déjà voté pour cette proposition.', 'info')
    }

    setResultsProposalId(proposalId)
  }, [])

  const handleLawVoted = useCallback((lawId: string, choice: VoteChoice) => {
    setLawVotedIds(prev => new Set([...prev, lawId]))
    setLaws(prev =>
      prev.map(l =>
        l.id !== lawId
          ? l
          : { ...l, votes: { ...l.votes, [choice]: l.votes[choice] + 1 } }
      )
    )
    setVotingLaw(null)
    setAgoraLaw(null)
    setResultsProposalId(lawId)
  }, [])

  const filters: { value: Stage | 'all'; label: string }[] = [
    { value: 'all',      label: 'Toutes' },
    { value: 'seedling', label: 'Pépinière' },
    { value: 'review',   label: 'Jury' },
    { value: 'voting',   label: 'Vote' },
    { value: 'adopted',  label: 'Adoptées' },
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
            className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'lois'
                ? 'bg-[#002395] text-white shadow-lg shadow-blue-200'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            🏛 Lois en cours
          </button>
          <button
            onClick={() => setActiveTab('propositions')}
            className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'propositions'
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
              {laws.map(law => (
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
                  { value: proposals.length,                                    label: 'propositions' },
                  { value: proposals.filter(p => p.stage === 'voting').length,  label: 'en vote' },
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
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    activeStage === f.value
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
              <div className="space-y-4">
                {filtered.map(proposal => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    onOpen={() => setAgoraProposal(proposal)}
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
          hasVoted={votedIds.has(agoraProposal.id)}
        />
      )}
      {votingProposal && (
        <VotingBooth
          proposal={votingProposal}
          onVoted={(choice, hash) => handleVoted(votingProposal.id, choice, hash)}
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

// ── Explore Page ───────────────────────────────────────────────
const CATEGORY_META: { name: string; emoji: string; textColor: string }[] = [
  { name: 'Économie',      emoji: '💰', textColor: 'text-yellow-700' },
  { name: 'Environnement', emoji: '🌿', textColor: 'text-green-700'  },
  { name: 'Démocratie',   emoji: '🗳️', textColor: 'text-indigo-700' },
  { name: 'Travail',       emoji: '⚒️', textColor: 'text-orange-700' },
  { name: 'Éducation',    emoji: '📚', textColor: 'text-blue-700'   },
  { name: 'Santé',         emoji: '❤️', textColor: 'text-red-700'    },
  { name: 'Logement',      emoji: '🏠', textColor: 'text-purple-700' },
  { name: 'Transparence',  emoji: '🔍', textColor: 'text-teal-700'   },
]

// ── Organisation types ─────────────────────────────────────────
interface Organisation {
  id: string
  name: string
  type: 'commune' | 'ong' | 'media'
  description: string
  population?: number
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

function ExplorePage({ onSelectCategory, userHash }: { onSelectCategory: (cat: string) => void; userHash: string }) {
  const [exploreTab, setExploreTab] = useState<'discover' | 'organisations'>('discover')

  // Discover tab state
  const [query, setQuery]           = useState('')
  const [searchResults, setSearchResults] = useState<Proposal[]>([])
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [trending, setTrending]     = useState<Proposal[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [allProposals, setAllProposals] = useState<Proposal[]>(PROPOSALS)

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
          .select('id,title,description,category,status,supports,votes_pour,votes_contre,votes_blanc,tags,created_at')
        if (error) throw error
        if (!cancelled && data && data.length > 0) {
          const mapped = (data as ProposalRow[]).map(mapRowToProposal)
          setAllProposals(mapped)
          const counts: Record<string, number> = {}
          for (const p of mapped) {
            counts[p.category] = (counts[p.category] ?? 0) + 1
          }
          setCategoryCounts(counts)
          const sorted = [...mapped].sort(
            (a, b) =>
              (b.votes.pour + b.votes.contre + b.votes.blanc) -
              (a.votes.pour + a.votes.contre + a.votes.blanc)
          )
          setTrending(sorted.slice(0, 3))
        }
      } catch {
        const counts: Record<string, number> = {}
        for (const p of PROPOSALS) {
          counts[p.category] = (counts[p.category] ?? 0) + 1
        }
        setCategoryCounts(counts)
        const sorted = [...PROPOSALS].sort(
          (a, b) =>
            (b.votes.pour + b.votes.contre + b.votes.blanc) -
            (a.votes.pour + a.votes.contre + a.votes.blanc)
        )
        setTrending(sorted.slice(0, 3))
      } finally {
        if (!cancelled) setLoadingData(false)
      }
    }
    fetchExploreData()
    return () => { cancelled = true }
  }, [])

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
        if (!cancelled) {
          setOrganisations(MOCK_ORGANISATIONS.filter(o => o.type === orgSubTab))
          showToast('Connexion impossible. Réessayez dans quelques instants.')
        }
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
      showToast('Connexion impossible. Réessayez dans quelques instants.')
    }
  }

  // Real-time search filter
  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return }
    const q = query.toLowerCase()
    setSearchResults(
      allProposals.filter(
        p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      ).slice(0, 6)
    )
  }, [query, allProposals])

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
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              exploreTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
          >
            {tab === 'discover' ? 'Propositions' : 'Organisations'}
          </button>
        ))}
      </div>

      {/* ── Discover tab ── */}
      {exploreTab === 'discover' && (
        <>
          <div className="relative mb-2">
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

          {query.trim().length > 0 && (
            <div className="mb-5 space-y-2">
              {searchResults.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Aucun résultat pour « {query} »</p>
              ) : (
                searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelectCategory(p.category)}
                    className="w-full text-left bg-white rounded-xl border border-slate-100 px-4 py-3 shadow-sm active:scale-95 transition-all"
                  >
                    <p className="text-sm font-semibold text-slate-800 truncate">{p.title}</p>
                    <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{p.description}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <StageBadge stage={p.stage} />
                      <span className="text-xs text-slate-400">{p.category}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {query.trim().length === 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {CATEGORY_META.map(cat => (
                  <button
                    key={cat.name}
                    onClick={() => onSelectCategory(cat.name)}
                    className="bg-white border border-slate-100 rounded-2xl p-4 text-left shadow-sm active:scale-95 transition-all"
                  >
                    <div className="text-2xl mb-2">{cat.emoji}</div>
                    <div className="font-bold text-slate-800 text-sm">{cat.name}</div>
                    {loadingData ? (
                      <div className="h-3 w-16 bg-slate-100 rounded-full animate-pulse mt-1" />
                    ) : (
                      <div className={`text-xs font-medium mt-0.5 ${cat.textColor}`}>
                        {categoryCounts[cat.name] ?? 0} proposition{(categoryCounts[cat.name] ?? 0) !== 1 ? 's' : ''}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <h2 className="font-bold text-slate-700 mb-3">Tendances cette semaine</h2>
              {loadingData ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-slate-100 rounded w-3/4" />
                        <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {trending.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => onSelectCategory(p.category)}
                      className="w-full flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100 active:scale-95 transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-black text-sm flex items-center justify-center flex-shrink-0">
                        #{i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{p.title}</p>
                        <p className="text-xs text-slate-400">
                          {(p.votes.pour + p.votes.contre + p.votes.blanc).toLocaleString('fr-FR')} votes
                        </p>
                      </div>
                      <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Organisations tab ── */}
      {exploreTab === 'organisations' && (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-2 mb-4">
            {(['commune', 'ong', 'media'] as const).map(sub => (
              <button
                key={sub}
                onClick={() => setOrgSubTab(sub)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  orgSubTab === sub
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
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        isFollowed
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
}

function ProfilePage({ onLogout, onNavigateElu, onNavigateOrg, userHash }: {
  onLogout: () => void
  onNavigateElu: (commune: Organisation) => void
  onNavigateOrg: (org: Organisation) => void
  userHash: string
}) {
  const [showSettings, setShowSettings]   = useState(false)
  const [showLegal, setShowLegal]         = useState<string | null>(null)
  const [notifEnabled, setNotifEnabled]   = useState(true)
  const [language, setLanguage]           = useState('FR')

  const [votedProposals, setVotedProposals]   = useState<VoteRecord[]>([])
  const [loadingVotes, setLoadingVotes]       = useState(true)
  const [myProposals, setMyProposals]         = useState<MyProposalRecord[]>([])
  const [loadingMyProps, setLoadingMyProps]   = useState(true)

  // "Ma commune" state
  const [communeQuery, setCommuneQuery]         = useState('')
  const [communeResults, setCommuneResults]     = useState<Organisation[]>([])
  const [loadingCommune, setLoadingCommune]     = useState(false)
  const [joinedCommuneIds, setJoinedCommuneIds] = useState<Set<string>>(new Set())
  const [joinedCommunes, setJoinedCommunes]     = useState<Organisation[]>([])
  const [joinedOrgs, setJoinedOrgs]             = useState<Organisation[]>([])


  // Fetch "Mes votes" via RPC get_my_votes
  // (lecture directe de votes interdite par RLS — les totaux viennent de proposals)
  useEffect(() => {
    let cancelled = false
    async function fetchVotes() {
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
        // Supabase unavailable — section stays empty
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
          .select('id, title, status')
          .eq('author_hash', userHash)
          .order('created_at', { ascending: false })
        if (error) throw error
        if (!cancelled && data) {
          setMyProposals(
            (data as { id: string; title: string; status: string }[]).map(p => ({
              id: p.id,
              title: p.title,
              stage: (p.status as Stage) ?? 'seedling',
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

  // Load joined communes on mount
  useEffect(() => {
    let cancelled = false
    async function fetchJoined() {
      try {
        const { data, error } = await supabase
          .from('citizen_organisations')
          .select('organisation_id')
          .eq('user_hash', userHash)
        if (error) throw error
        if (!cancelled && data && data.length > 0) {
          const ids = data.map((r: { organisation_id: string }) => r.organisation_id)
          setJoinedCommuneIds(new Set(ids))
          // Fetch full org objects for all types in one query, then split
          const { data: orgData } = await supabase
            .from('organisations')
            .select('id,name,type,description,population')
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
    const org = communeResults.find(o => o.id === orgId)
    if (org) setJoinedCommunes(prev => [...prev, org])
    try {
      const { error } = await supabase.from('citizen_organisations').insert({
        user_hash: userHash,
        organisation_id: orgId,
      })
      if (error) throw error
    } catch {
      showToast('Connexion impossible. Réessayez dans quelques instants.')
    }
  }

  const choiceLabel: Record<VoteChoice, string> = {
    pour: 'Pour', contre: 'Contre', blanc: 'Blanc',
  }
  const choiceColor: Record<VoteChoice, string> = {
    pour: 'text-green-600 bg-green-50',
    contre: 'text-red-500 bg-red-50',
    blanc: 'text-slate-500 bg-slate-100',
  }

  const legalDocs: Record<string, { title: string; content: React.ReactNode }> = {
    cgu: {
      title: "Conditions Générales d'Utilisation",
      content: (
        <p className="text-sm text-slate-600 leading-relaxed">
          CHOISISSONS est une plateforme de démocratie directe citoyenne. En utilisant ce service,
          vous acceptez de voter de manière sincère et personnelle. Les votes sont anonymes et
          chiffrés. Version prototype — usage non contraignant.
        </p>
      ),
    },
    privacy: {
      title: 'Politique de confidentialité',
      content: (
        <p className="text-sm text-slate-600 leading-relaxed">
          Nous ne collectons aucune donnée personnelle identifiable. Votre identité est dissociée
          de votre vote par chiffrement SHA-256 avant tout enregistrement. Conformément au RGPD,
          vous pouvez demander la suppression de vos données à{' '}
          <span className="text-indigo-600 font-medium">contact@choisissons.fr</span>
        </p>
      ),
    },
    legal: {
      title: 'Mentions légales',
      content: (
        <div className="space-y-2 text-sm text-slate-600">
          <p><span className="font-semibold text-slate-700">Éditeur :</span> Association CHOISISSONS (en cours de création)</p>
          <p><span className="font-semibold text-slate-700">Hébergement :</span> Vercel Inc. / Supabase (West EU Paris)</p>
          <p><span className="font-semibold text-slate-700">Directeur de publication :</span> Benjamin Colleu</p>
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

      {/* User card */}
      <div className="bg-indigo-600 rounded-2xl p-5 mb-4 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center text-xl font-black shadow-lg flex-shrink-0">
              {MOCK_USER.avatar}
            </div>
            <div>
              <p className="font-black text-lg leading-tight">{MOCK_USER.name}</p>
              <p className="text-indigo-200 text-sm mt-0.5">{MOCK_USER.commune}</p>
              <div className="flex gap-3 mt-2 text-xs text-indigo-300">
                <span>{MOCK_USER.votesCount} votes</span>
                <span>·</span>
                <span>{MOCK_USER.proposalsCount} propositions</span>
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

      {/* Accès tableau de bord élu */}
      {joinedCommunes.length > 0 && (
        <div className="mb-4">
          {joinedCommunes.map(commune => (
            <button
              key={commune.id}
              onClick={() => onNavigateElu(commune)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-white active:scale-95 transition-all shadow-sm"
              style={{ backgroundColor: '#0c447c' }}
            >
              <div className="flex items-center gap-3">
                <Landmark size={16} className="text-blue-200 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-semibold leading-tight">Tableau de bord élu</p>
                  <p className="text-blue-200 text-xs mt-0.5">{commune.name}</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-blue-200 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Accès tableau de bord ONG / Média */}
      {joinedOrgs.length > 0 && (
        <div className="mb-4 space-y-2">
          {joinedOrgs.map(org => {
            const bgColor = org.type === 'ong' ? '#854f0b' : '#334155'
            const icon    = org.type === 'ong' ? <Users size={16} className="text-amber-200 flex-shrink-0" /> : <Newspaper size={16} className="text-slate-300 flex-shrink-0" />
            const sub     = org.type === 'ong' ? 'ONG / Association' : 'Média'
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
            {myProposals.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-0">
                <p className="text-sm text-slate-700 font-medium flex-1 min-w-0 truncate">{p.title}</p>
                <StageBadge stage={p.stage} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Informations légales */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
        <h3 className="font-bold text-slate-800 text-sm mb-3">Informations légales</h3>
        <div className="space-y-1">
          {[
            { key: 'cgu',     label: "Conditions Générales d'Utilisation", icon: FileText },
            { key: 'privacy', label: 'Politique de confidentialité',       icon: Shield },
            { key: 'legal',   label: 'Mentions légales',                   icon: Landmark },
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
  const [followerCount, setFollowerCount]   = useState<number | null>(null)
  const [proposals, setProposals]           = useState<OrgProposal[]>([])
  const [nationalLaws, setNationalLaws]     = useState<Proposal[]>([])
  const [comments, setComments]             = useState<Record<string, OrgComment[]>>({})
  const [loadingStats, setLoadingStats]     = useState(true)

  const [showPropForm, setShowPropForm]     = useState(false)
  const [propTitle, setPropTitle]           = useState('')
  const [propDescription, setPropDescription] = useState('')
  const [submittingProp, setSubmittingProp] = useState(false)

  const [commentingLawId, setCommentingLawId] = useState<string | null>(null)
  const [commentText, setCommentText]         = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        const [followersRes, proposalsRes, lawsRes] = await Promise.all([
          supabase.from('citizen_organisations').select('id', { count: 'exact', head: true }).eq('organisation_id', org.id),
          supabase.from('proposals').select('id,title,status,votes_pour,votes_contre,votes_blanc,created_at').eq('author', org.name),
          supabase.from('proposals').select('id,title,description,category,status,supports,votes_pour,votes_contre,votes_blanc,tags,created_at').eq('status', 'voting'),
        ])
        if (!cancelled) {
          if (followersRes.count !== null) setFollowerCount(followersRes.count)
          if (proposalsRes.data) setProposals(proposalsRes.data as OrgProposal[])
          if (lawsRes.data && lawsRes.data.length > 0) {
            setNationalLaws((lawsRes.data as ProposalRow[]).map(mapRowToProposal))
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
        if (!cancelled) {
          setNationalLaws(PROPOSALS.filter(p => p.stage === 'voting'))
          showToast('Connexion impossible. Réessayez dans quelques instants.')
        }
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
  const typeLabel   = org.type === 'ong' ? 'ONG / Association' : 'Média'
  const typeBadge   = org.type === 'ong' ? 'bg-amber-900/50 text-amber-200' : 'bg-slate-600/50 text-slate-300'

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
      showToast('Connexion impossible. Réessayez dans quelques instants.')
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
      showToast('Connexion impossible. Réessayez dans quelques instants.')
    }
    setSubmittingComment(false)
  }

  const statusTag: Record<string, { text: string; color: string }> = {
    voting:   { text: 'En vote',   color: 'bg-indigo-100 text-indigo-700' },
    seedling: { text: 'Pépinière', color: 'bg-emerald-100 text-emerald-700' },
    review:   { text: 'Jury',      color: 'bg-amber-100 text-amber-700' },
    adopted:  { text: 'Adoptée',   color: 'bg-green-100 text-green-700' },
    rejected: { text: 'Rejetée',   color: 'bg-red-100 text-red-600' },
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
            { label: 'Abonnés',         value: loadingStats ? '—' : (followerCount ?? 0).toLocaleString('fr-FR'), sub: 'citoyens abonnés' },
            { label: 'Propositions',    value: loadingStats ? '—' : proposals.length.toString(),                  sub: 'publiées' },
            { label: 'Votes reçus',     value: loadingStats ? '—' : totalVotes.toLocaleString('fr-FR'),           sub: 'sur vos propositions' },
            { label: 'Engagement',      value: loadingStats ? '—' : `${engagementRate}%`,                         sub: 'votes / abonnés' },
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
                const pourPct   = total > 0 ? Math.round((p.votes_pour   / total) * 100) : 0
                const contrePct = total > 0 ? Math.round((p.votes_contre / total) * 100) : 0
                const blancPct  = 100 - pourPct - contrePct
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
                          <div className="bg-red-400 transition-all"   style={{ width: `${contrePct}%` }} />
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

function ElectedDashboard({ commune, onBack }: { commune: Organisation; onBack: () => void }) {
  const [memberCount, setMemberCount]       = useState<number | null>(null)
  const [nationalLaws, setNationalLaws]     = useState<Proposal[]>([])
  const [consultations, setConsultations]   = useState<LocalConsultation[]>([])
  const [loadingStats, setLoadingStats]     = useState(true)

  const [showForm, setShowForm]             = useState(false)
  const [formTitle, setFormTitle]           = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDuration, setFormDuration]     = useState(30)
  const [submitting, setSubmitting]         = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        const [membersRes, lawsRes, consultRes] = await Promise.all([
          supabase.from('citizen_organisations').select('id', { count: 'exact', head: true }).eq('organisation_id', commune.id),
          supabase.from('proposals').select('id,title,description,category,status,supports,votes_pour,votes_contre,votes_blanc,tags,created_at').eq('status', 'voting'),
          supabase.from('proposals').select('id,title,description,status,created_at,votes_pour,votes_contre,votes_blanc').eq('author', commune.name),
        ])
        if (!cancelled) {
          if (membersRes.count !== null) setMemberCount(membersRes.count)
          if (lawsRes.data && lawsRes.data.length > 0) {
            setNationalLaws((lawsRes.data as ProposalRow[]).map(mapRowToProposal))
          } else {
            setNationalLaws(PROPOSALS.filter(p => p.stage === 'voting'))
          }
          if (consultRes.data) setConsultations(consultRes.data as LocalConsultation[])
        }
      } catch {
        if (!cancelled) {
          setNationalLaws(PROPOSALS.filter(p => p.stage === 'voting'))
          showToast('Connexion impossible. Réessayez dans quelques instants.')
        }
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
      showToast('Connexion impossible. Réessayez dans quelques instants.')
    }
    setSubmitting(false)
  }

  const statusTag: Record<string, { text: string; color: string }> = {
    voting:   { text: 'En vote',    color: 'bg-indigo-100 text-indigo-700' },
    seedling: { text: 'Brouillon',  color: 'bg-slate-100 text-slate-600' },
    review:   { text: 'En révision', color: 'bg-amber-100 text-amber-700' },
    adopted:  { text: 'Terminée',   color: 'bg-green-100 text-green-700' },
    rejected: { text: 'Clôturée',   color: 'bg-red-100 text-red-600' },
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
      </div>

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
                const pourPct   = total > 0 ? Math.round((law.votes.pour   / total) * 100) : 0
                const contrePct = total > 0 ? Math.round((law.votes.contre / total) * 100) : 0
                const blancPct  = 100 - pourPct - contrePct
                return (
                  <div key={law.id} className="bg-white rounded-2xl p-4 border border-slate-100">
                    <p className="text-sm font-semibold text-slate-800 mb-0.5">{law.title}</p>
                    <p className="text-xs text-slate-400 mb-3">{total.toLocaleString('fr-FR')} avis exprimés</p>
                    {total > 0 ? (
                      <>
                        <div className="flex h-2 rounded-full overflow-hidden mb-1.5">
                          <div className="bg-green-500 transition-all" style={{ width: `${pourPct}%` }} />
                          <div className="bg-red-400 transition-all"   style={{ width: `${contrePct}%` }} />
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

// ── Support Page ───────────────────────────────────────────────
const COMMUNE_TIERS = [
  { value: 'small',  label: 'Moins de 5 000 habitants',      price: '49€'  },
  { value: 'medium', label: 'De 5 000 à 50 000 habitants',   price: '149€' },
  { value: 'large',  label: 'Plus de 50 000 habitants',       price: '499€' },
] as const
type CommuneTier = typeof COMMUNE_TIERS[number]['value']

function SupportPage() {
  const [selected, setSelected]       = useState<string | null>(null)
  const [communeSize, setCommuneSize] = useState<CommuneTier>('small')

  const plans: {
    id: string
    name: string
    price: string
    period: string
    icon: ElementType
    headerBg: string
    borderColor: string
    features: string[]
    cta: string
  }[] = [
    {
      id: 'citoyen',
      name: 'Citoyen',
      price: '2€',
      period: '/mois',
      icon: User,
      headerBg: 'bg-indigo-600',
      borderColor: 'border-indigo-300',
      features: ['Accès complet sans publicité', 'Badge citoyen soutenant', 'Newsletter mensuelle', 'Vote prioritaire'],
      cta: 'Soutenir la démocratie',
    },
    {
      id: 'media',
      name: 'Média',
      price: '29€',
      period: '/mois',
      icon: Newspaper,
      headerBg: 'bg-slate-600',
      borderColor: 'border-slate-300',
      features: ['API accès données', 'Tableau de bord analytics', 'Export CSV / JSON', 'Badge média partenaire', 'Support prioritaire'],
      cta: 'Accès média',
    },
    {
      id: 'ong',
      name: 'ONG / Association',
      price: '49€',
      period: '/mois',
      icon: Building2,
      headerBg: 'bg-amber-600',
      borderColor: 'border-amber-300',
      features: ['Tout l\'offre Média', 'Page organisation dédiée', '10 comptes membres', 'Propositions co-sponsorisées', 'Rapport d\'impact trimestriel'],
      cta: 'Rejoindre en ONG',
    },
  ]

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

      {/* Plans */}
      <div className="space-y-4">
        {plans.map(plan => {
          const Icon = plan.icon
          const isSelected = selected === plan.id
          return (
            <div
              key={plan.id}
              className={`rounded-2xl border-2 overflow-hidden transition-all ${plan.borderColor} ${isSelected ? 'shadow-lg' : ''}`}
            >
              <div className={`${plan.headerBg} p-4 text-white flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <Icon size={20} />
                  <span className="font-black text-lg">{plan.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black">{plan.price}</span>
                  <span className="text-xs opacity-75 ml-0.5">{plan.period}</span>
                </div>
              </div>
              <div className="p-4 bg-white">
                <ul className="space-y-2 mb-4">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setSelected(isSelected ? null : plan.id)}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-slate-800 text-white'
                      : `${plan.headerBg} text-white`
                  }`}
                >
                  {isSelected ? '✓ Sélectionné — Passer au paiement' : plan.cta}
                </button>
              </div>
            </div>
          )
        })}

        {/* Commune & Collectivité — tarif dégressif */}
        {(() => {
          const tier = COMMUNE_TIERS.find(t => t.value === communeSize)!
          const isSelected = selected === 'commune'
          return (
            <div className={`rounded-2xl border-2 overflow-hidden transition-all border-teal-300 ${isSelected ? 'shadow-lg' : ''}`}>
              <div className="bg-teal-700 p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Landmark size={20} />
                  <span className="font-black text-lg">Commune &amp; Collectivité</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black">{tier.price}</span>
                  <span className="text-xs opacity-75 ml-0.5">/mois</span>
                </div>
              </div>
              <div className="p-4 bg-white">
                {/* Sélecteur tranche d'habitants */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Tranche d'habitants
                  </label>
                  <div className="space-y-2">
                    {COMMUNE_TIERS.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setCommuneSize(t.value)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          communeSize === t.value
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

                {/* Features */}
                <ul className="space-y-2 mb-4">
                  {[
                    'Accès API données',
                    'Tableau de bord pour les élus',
                    'Consultation citoyenne intégrée',
                    'Rapport d\'engagement mensuel',
                    'Support prioritaire',
                  ].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => setSelected(isSelected ? null : 'commune')}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-slate-800 text-white'
                      : 'bg-teal-700 text-white'
                  }`}
                >
                  {isSelected ? '✓ Sélectionné — Passer au paiement' : 'Équiper ma commune'}
                </button>
              </div>
            </div>
          )
        })()}
      </div>

      <p className="text-center text-xs text-slate-400 mt-4 pb-2">
        Paiement sécurisé par Stripe · Sans engagement · Annulation en 1 clic
      </p>
    </div>
  )
}

// ── Propose Modal ──────────────────────────────────────────────
function ProposeModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState('')
  const [submitted, setSubmitted]     = useState(false)

  const categories = ['Économie', 'Environnement', 'Démocratie', 'Travail', 'Éducation', 'Santé', 'Logement', 'Autre']

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim() || !category) return
    setSubmitted(true)
    setTimeout(onClose, 2500)
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
                className={`py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                  category === cat
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
            disabled={!title.trim() || !description.trim() || !category}
            className="w-full bg-indigo-600 text-white rounded-xl py-4 font-semibold disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            Soumettre ma proposition
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────
export default function App() {
  const [isLoggedIn, setIsLoggedIn]         = useState(false)
  const [activePage, setActivePage]         = useState<NavPage>('home')
  const [showPropose, setShowPropose]       = useState(false)
  const [pendingCategory, setPendingCategory] = useState<string | undefined>(undefined)
  const [selectedCommune, setSelectedCommune] = useState<Organisation | null>(null)
  const [selectedOrg, setSelectedOrg]         = useState<Organisation | null>(null)
  const [userHash, setUserHash]               = useState<string>('')
  const [toasts, setToasts]                   = useState<ToastEntry[]>([])

  useEffect(() => {
    _toastHandler = (entry) => setToasts(prev => [...prev, entry])
    return () => { _toastHandler = null }
  }, [])

  useEffect(() => {
    getVoterHash().then(hash => {
      setUserHash(hash)
      flushPendingVotes()
    })
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const handleSelectCategory = (cat: string) => {
    setPendingCategory(cat)
    setActivePage('home')
  }

  const handleNavigateElu = (commune: Organisation) => {
    setSelectedCommune(commune)
    setActivePage('elu')
  }

  const handleNavigateOrg = (org: Organisation) => {
    setSelectedOrg(org)
    setActivePage('org')
  }

  const navItems: { page: NavPage; label: string; icon: ElementType }[] = [
    { page: 'home',    label: 'Accueil',  icon: Home },
    { page: 'explore', label: 'Explorer', icon: Compass },
    { page: 'profile', label: 'Mon Compte', icon: User },
    { page: 'support', label: 'Soutenir', icon: Heart },
  ]

  if (!isLoggedIn) {
    return <LoginScreen onLogin={() => setIsLoggedIn(true)} />
  }

  // Full-screen dashboards — no nav bar
  if (activePage === 'elu' && selectedCommune) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="max-w-md mx-auto min-h-screen overflow-y-auto">
          <ElectedDashboard
            commune={selectedCommune}
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
        <div className="max-w-md mx-auto min-h-screen overflow-y-auto">
          <OrgDashboard
            org={selectedOrg}
            onBack={() => setActivePage('profile')}
          />
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto relative">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Scrollable content area */}
      <main className="flex-1 overflow-y-auto pb-24">
        {activePage === 'home'    && <HomePage initialCategory={pendingCategory} userHash={userHash} />}
        {activePage === 'explore' && <ExplorePage onSelectCategory={handleSelectCategory} userHash={userHash} />}
        {activePage === 'profile' && (
          <ProfilePage
            onLogout={() => { setIsLoggedIn(false); setActivePage('home') }}
            onNavigateElu={handleNavigateElu}
            onNavigateOrg={handleNavigateOrg}
            userHash={userHash}
          />
        )}
        {activePage === 'support' && <SupportPage />}
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowPropose(true)}
        aria-label="Proposer une idée"
        className="fixed bottom-20 right-4 w-14 h-14 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-300 flex items-center justify-center text-white active:scale-90 transition-all z-40"
      >
        <Plus size={26} />
      </button>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 z-30">
        <div className="flex">
          {navItems.map(({ page, label, icon: Icon }) => {
            const active = activePage === page
            return (
              <button
                key={page}
                onClick={() => setActivePage(page)}
                className={`relative flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                  active ? 'text-indigo-600' : 'text-slate-400'
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
      {showPropose && <ProposeModal onClose={() => setShowPropose(false)} />}
    </div>
  )
}
