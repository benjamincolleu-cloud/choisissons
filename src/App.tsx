import { useState, useCallback } from 'react'
import type { ElementType } from 'react'
import {
  Home, Compass, User, Heart, Plus, ChevronRight,
  ThumbsUp, ThumbsDown, Minus, X, CheckCircle, XCircle,
  Sprout, Users, Vote, Shield, BookOpen, HelpCircle,
  ChevronDown, ChevronUp, Lock, Star, Newspaper,
  Building2, ArrowLeft, Info,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────
type Stage = 'seedling' | 'review' | 'voting' | 'adopted' | 'rejected'
type VoteChoice = 'pour' | 'contre' | 'blanc'
type NavPage = 'home' | 'explore' | 'profile' | 'support'

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
async function generateVoteHash(proposalId: string, choice: VoteChoice, userId: string): Promise<string> {
  const data = `${proposalId}-${choice}-${userId}-${Date.now()}`
  const encoded = new TextEncoder().encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
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

// ── Login Screen ───────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [loading, setLoading] = useState(false)

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

        <p className="text-center text-indigo-400 text-xs mt-4">
          Service simulé — aucune donnée réelle transmise
        </p>

        {/* Workflow steps */}
        <div className="mt-8 bg-white/5 rounded-2xl p-4">
          <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-3">Comment ça marche</p>
          <div className="flex items-center justify-between text-xs text-indigo-200">
            {['Pépinière', 'Jury', 'Isoloir', 'Décision'].map((step, i) => (
              <div key={step} className="flex items-center">
                <div className="text-center">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold mx-auto mb-1">
                    {i + 1}
                  </div>
                  <span>{step}</span>
                </div>
                {i < 3 && <ChevronRight size={12} className="text-indigo-500 mx-1" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Agora Modal ────────────────────────────────────────────────
function AgoraModal({ proposal, onVote, onClose }: {
  proposal: Proposal
  onVote: () => void
  onClose: () => void
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
          <button
            onClick={onVote}
            className="w-full bg-indigo-600 text-white rounded-xl py-4 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all"
          >
            <Vote size={18} />
            Entrer dans l'isoloir
          </button>
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
    const voteHash = await generateVoteHash(proposal.id, selected, MOCK_USER.name)
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

// ── Proposal Card ──────────────────────────────────────────────
function ProposalCard({ proposal, onOpen }: { proposal: Proposal; onOpen: () => void }) {
  const total    = proposal.votes.pour + proposal.votes.contre + proposal.votes.blanc
  const progress = Math.min((proposal.signatures / proposal.targetSignatures) * 100, 100)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <StageBadge stage={proposal.stage} />
          <span className="text-xs text-slate-400">{proposal.category}</span>
        </div>
        <h3 className="font-bold text-slate-800 text-base leading-snug mb-1">{proposal.title}</h3>
        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mb-3">{proposal.description}</p>

        {/* Signatures progress */}
        {(proposal.stage === 'seedling' || proposal.stage === 'review') && (
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

        {/* Vote results */}
        {total > 0 && <VoteBar votes={proposal.votes} />}
        {total > 0 && (
          <p className="text-xs text-slate-400 mt-1">{total.toLocaleString('fr-FR')} votes exprimés</p>
        )}
      </div>

      <div className="px-4 pb-4">
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
      </div>
    </div>
  )
}

// ── Home Page ──────────────────────────────────────────────────
function HomePage() {
  const [proposals, setProposals]       = useState<Proposal[]>(PROPOSALS)
  const [activeStage, setActiveStage]   = useState<Stage | 'all'>('all')
  const [agoraProposal, setAgoraProposal] = useState<Proposal | null>(null)
  const [votingProposal, setVotingProposal] = useState<Proposal | null>(null)
  const [votedIds, setVotedIds]         = useState<Set<string>>(new Set())

  const filtered = activeStage === 'all'
    ? proposals
    : proposals.filter(p => p.stage === activeStage)

  const handleVoted = useCallback((proposalId: string, choice: VoteChoice) => {
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
        <div className="mb-5">
          <h1 className="text-2xl font-black text-slate-800">Propositions</h1>
          <p className="text-slate-500 text-sm">Citoyenne, citoyen — votre voix compte.</p>
        </div>

        {/* Stats banner */}
        <div className="bg-indigo-600 rounded-2xl p-4 mb-5 text-white">
          <div className="flex justify-around">
            {[
              { value: proposals.length,                              label: 'propositions' },
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
        <div className="space-y-4">
          {filtered.map(proposal => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onOpen={() => setAgoraProposal(proposal)}
            />
          ))}
        </div>
      </div>

      {agoraProposal && !votingProposal && (
        <AgoraModal
          proposal={agoraProposal}
          onVote={() => setVotingProposal(agoraProposal)}
          onClose={() => setAgoraProposal(null)}
        />
      )}

      {votingProposal && (
        <VotingBooth
          proposal={votingProposal}
          onVoted={(choice, hash) => handleVoted(votingProposal.id, choice)}
          onClose={() => setVotingProposal(null)}
        />
      )}
    </>
  )
}

// ── Explore Page ───────────────────────────────────────────────
function ExplorePage() {
  const categories = [
    { name: 'Économie',      count: 12, emoji: '💰', textColor: 'text-yellow-700' },
    { name: 'Environnement', count: 18, emoji: '🌿', textColor: 'text-green-700' },
    { name: 'Démocratie',   count: 9,  emoji: '🗳️', textColor: 'text-indigo-700' },
    { name: 'Travail',       count: 7,  emoji: '⚒️', textColor: 'text-orange-700' },
    { name: 'Éducation',    count: 11, emoji: '📚', textColor: 'text-blue-700' },
    { name: 'Santé',         count: 14, emoji: '❤️', textColor: 'text-red-700' },
    { name: 'Logement',      count: 6,  emoji: '🏠', textColor: 'text-purple-700' },
    { name: 'Transparence',  count: 5,  emoji: '🔍', textColor: 'text-teal-700' },
  ]

  const trending = PROPOSALS.filter(p => p.stage === 'voting')

  return (
    <div className="p-4">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-800">Explorer</h1>
        <p className="text-slate-500 text-sm">Parcourez les propositions par thème</p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <input
          type="text"
          placeholder="Rechercher une proposition…"
          className="w-full bg-slate-100 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* Categories */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {categories.map(cat => (
          <button
            key={cat.name}
            className="bg-white border border-slate-100 rounded-2xl p-4 text-left shadow-sm active:scale-95 transition-all"
          >
            <div className="text-2xl mb-2">{cat.emoji}</div>
            <div className="font-bold text-slate-800 text-sm">{cat.name}</div>
            <div className={`text-xs font-medium mt-0.5 ${cat.textColor}`}>{cat.count} propositions</div>
          </button>
        ))}
      </div>

      {/* Trending */}
      <h2 className="font-bold text-slate-700 mb-3">Tendances cette semaine</h2>
      <div className="space-y-2">
        {trending.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-black text-sm flex items-center justify-center flex-shrink-0">
              #{i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700 truncate">{p.title}</p>
              <p className="text-xs text-slate-400">
                {(p.votes.pour + p.votes.contre + p.votes.blanc).toLocaleString('fr-FR')} votes
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Profile Page ───────────────────────────────────────────────
function ProfilePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const faqs = [
    {
      q: 'Mon vote est-il vraiment anonyme ?',
      a: "Oui. Votre identité est dissociée de votre bulletin avant chiffrement. Un hash SHA-256 unique prouve que vous avez voté sans révéler votre choix.",
    },
    {
      q: 'Qui compose le jury citoyen ?',
      a: "Le jury est tiré au sort parmi les citoyens inscrits, sur le modèle des jurés d'assises. Il examine les propositions ayant atteint 10 000 signatures.",
    },
    {
      q: "Comment une proposition est-elle adoptée ?",
      a: 'Une proposition atteint le statut "Adoptée" si elle obtient plus de 50% de votes Pour, avec un quorum minimum de 100 000 votants.',
    },
    {
      q: 'Mes données sont-elles partagées ?',
      a: "Non. Choisissons ne vend et ne partage aucune donnée personnelle. L'authentification FranceConnect ne transmet que votre commune.",
    },
    {
      q: 'Comment soumettre une proposition ?',
      a: 'Appuyez sur le bouton "+" en bas de l\'écran. Votre proposition est d\'abord examinée par notre équipe avant publication en Pépinière.',
    },
  ]

  const roadmap = [
    { phase: 'Phase 1', items: ['Login FranceConnect', 'Propositions simulées', 'Vote SHA-256'], done: true },
    { phase: 'Phase 2', items: ['Supabase backend', 'Vrai jury citoyen', 'Notifications push'], done: false },
    { phase: 'Phase 3', items: ['API gouvernementale', 'Mobile natif', 'Audit de sécurité'], done: false },
  ]

  return (
    <div className="p-4">
      {/* User card */}
      <div className="bg-indigo-600 rounded-2xl p-5 mb-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center text-xl font-black shadow-lg">
            {MOCK_USER.avatar}
          </div>
          <div>
            <h2 className="font-black text-lg">{MOCK_USER.name}</h2>
            <p className="text-indigo-200 text-sm">{MOCK_USER.commune}</p>
            <div className="flex gap-3 mt-1 text-xs text-indigo-200">
              <span>{MOCK_USER.votesCount} votes</span>
              <span>·</span>
              <span>{MOCK_USER.proposalsCount} propositions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transparency */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={16} className="text-indigo-600" />
          <h3 className="font-bold text-slate-800">Transparence du système</h3>
        </div>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Code source',       value: 'Open source (GitHub)',        ok: true },
            { label: 'Hébergement',       value: 'France (OVH)',                ok: true },
            { label: 'Chiffrement votes', value: 'SHA-256 + Zero-knowledge',    ok: true },
            { label: 'Audit indépendant', value: 'Prévu Q3 2026',              ok: false },
            { label: 'Certifié ANSSI',    value: 'En cours',                   ok: false },
          ].map(item => (
            <div key={item.label} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
              <span className="text-slate-500">{item.label}</span>
              <span className={`font-medium text-xs ${item.ok ? 'text-green-600' : 'text-amber-500'}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={16} className="text-indigo-600" />
          <h3 className="font-bold text-slate-800">Feuille de route</h3>
        </div>
        <div className="space-y-3">
          {roadmap.map(phase => (
            <div key={phase.phase} className={`rounded-xl p-3 ${phase.done ? 'bg-green-50' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                {phase.done
                  ? <CheckCircle size={14} className="text-green-500" />
                  : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />}
                <span className={`font-semibold text-sm ${phase.done ? 'text-green-700' : 'text-slate-600'}`}>
                  {phase.phase}
                </span>
              </div>
              <ul className="ml-5 space-y-0.5">
                {phase.items.map(item => (
                  <li key={item} className={`text-xs ${phase.done ? 'text-green-600' : 'text-slate-500'}`}>
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle size={16} className="text-indigo-600" />
          <h3 className="font-bold text-slate-800">FAQ</h3>
        </div>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-3 text-left gap-2"
              >
                <span className="font-medium text-slate-700 text-sm">{faq.q}</span>
                {openFaq === i
                  ? <ChevronUp size={15} className="text-slate-400 flex-shrink-0" />
                  : <ChevronDown size={15} className="text-slate-400 flex-shrink-0" />}
              </button>
              {openFaq === i && (
                <div className="px-3 pb-3 text-sm text-slate-500 leading-relaxed border-t border-slate-50">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Support Page ───────────────────────────────────────────────
function SupportPage() {
  const [selected, setSelected] = useState<string | null>(null)

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
  const [isLoggedIn, setIsLoggedIn]   = useState(false)
  const [activePage, setActivePage]   = useState<NavPage>('home')
  const [showPropose, setShowPropose] = useState(false)

  const navItems: { page: NavPage; label: string; icon: ElementType }[] = [
    { page: 'home',    label: 'Accueil',  icon: Home },
    { page: 'explore', label: 'Explorer', icon: Compass },
    { page: 'profile', label: 'Profil',   icon: User },
    { page: 'support', label: 'Soutenir', icon: Heart },
  ]

  if (!isLoggedIn) {
    return <LoginScreen onLogin={() => setIsLoggedIn(true)} />
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto relative">
      {/* Scrollable content area */}
      <main className="flex-1 overflow-y-auto pb-24">
        {activePage === 'home'    && <HomePage />}
        {activePage === 'explore' && <ExplorePage />}
        {activePage === 'profile' && <ProfilePage />}
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
