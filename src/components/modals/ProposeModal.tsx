import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { X, Sprout } from 'lucide-react'
import { supabase, supabaseUrl, supabaseAnonKey } from '../../supabaseClient'

export default function ProposeModal({ onClose }: { onClose: () => void }) {
  const { userHash } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const categories = ['Économie', 'Environnement', 'Démocratie', 'Travail', 'Éducation', 'Santé', 'Logement', 'Justice', 'Autre']

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim() || !category) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      const res = await fetch(`${supabaseUrl}/functions/v1/moderate-proposal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          author_hash: userHash,
          proposal_type: 'citizen',
          category,
        }),
      })

      const json = await res.json() as { status?: string; message?: string; reason?: string }

      if (json.status === 'submitted') {
        setSubmitted(true)
        setTimeout(onClose, 2500)
      } else if (json.status === 'rejected') {
        setSubmitError(json.reason ?? 'Proposition refusée par la modération.')
      } else {
        setSubmitError("Une erreur est survenue lors de l'envoi. Réessayez.")
      }
    } catch {
      setSubmitError('Erreur de connexion, réessayez.')
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
          {submitError && (
            <div className="mb-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-xs text-red-700 font-medium">{submitError}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={!title.trim() || !description.trim() || !category || submitting}
            className="w-full bg-indigo-600 text-white rounded-xl py-4 font-semibold disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {submitting ? 'Envoi en cours…' : 'Soumettre ma proposition'}
          </button>
        </div>
      </form>
    </div>
  )
}
