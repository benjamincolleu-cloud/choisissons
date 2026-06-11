import { useEffect } from 'react'
import { X, XCircle, CheckCircle } from 'lucide-react'
import type { ToastEntry } from '../../types'

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
  const Icon = entry.type === 'info' ? CheckCircle : XCircle
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

export default function ToastContainer({ toasts, onDismiss }: { toasts: ToastEntry[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed top-4 left-0 right-0 max-w-md mx-auto px-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => <ToastItem key={t.id} entry={t} onDone={onDismiss} />)}
    </div>
  )
}
