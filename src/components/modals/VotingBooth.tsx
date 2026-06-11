import { useState } from 'react'
import type { ReactNode } from 'react'
import { Lock, ArrowLeft, CheckCircle, ThumbsUp, ThumbsDown, Minus } from 'lucide-react'
import type { Proposal, VoteChoice } from '../../types'
import { generateVoteProof } from '../../lib/identity'

export default function VotingBooth({ proposal, onVoted, onClose }: {
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
    icon: ReactNode
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
