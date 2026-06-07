import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { CheckCircle, Map, Handshake, Medal } from 'lucide-react'

export default function AmbassadorPage() {
    const [prenomNom, setPrenomNom] = useState('')
    const [email, setEmail] = useState('')
    const [territoire, setTerritoire] = useState('')
    const [contexte, setContexte] = useState('')
    const [message, setMessage] = useState('')

    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    const formValid = prenomNom.trim() && email.trim() && territoire.trim() && contexte

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formValid || submitting) return

        setSubmitting(true)
        try {
            const { error } = await supabase.from('ambassadeurs').insert({
                prenom_nom: prenomNom.trim(),
                email: email.trim(),
                territoire: territoire.trim(),
                contexte: contexte,
                message: message.trim() || null,
            })

            if (error) {
                throw error
            }

            setSubmitted(true)
        } catch (error) {
            console.error("Erreur lors de l'inscription ambassadeur:", error)
            alert("Une erreur est survenue lors de l'envoi de votre candidature. Veuillez réessayer.")
        } finally {
            setSubmitting(false)
        }
    }

    if (submitted) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 min-h-[60vh]">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
                    <CheckCircle size={40} className="text-green-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">Merci, vous êtes ambassadeur !</h2>
                <p className="text-slate-500 text-sm text-center max-w-md">
                    Benjamin vous contactera personnellement dans les prochains jours.
                </p>
            </div>
        )
    }

    return (
        <div className="p-4 pb-24 md:pb-4">
            {/* 1. HEADER */}
            <div className="mb-8">
                <h1 className="text-2xl font-black text-slate-800">Ambassadeurs</h1>
                <p className="text-slate-500 text-sm">Défendez CHOISISSONS dans votre ville, votre association, votre école.</p>
            </div>

            {/* 2. SECTION "Pourquoi devenir ambassadeur ?" */}
            <div className="grid md:grid-cols-3 gap-4 mb-10">
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-start gap-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Map size={20} className="text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1">Votre territoire</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">Vous représentez CHOISISSONS dans votre département ou ville.</p>
                    </div>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-start gap-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Handshake size={20} className="text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1">Votre réseau</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">Vous expliquez le projet autour de vous, à votre rythme.</p>
                    </div>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-start gap-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Medal size={20} className="text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1">Votre badge</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">Vous recevez un badge ambassadeur visible sur votre profil.</p>
                    </div>
                </div>
            </div>

            {/* 3. FORMULAIRE D'INSCRIPTION */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-2xl mx-auto">
                <h3 className="font-bold text-lg text-slate-800 mb-4 text-center">Devenir Ambassadeur</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Prénom et nom</label>
                            <input
                                type="text"
                                value={prenomNom}
                                onChange={e => setPrenomNom(e.target.value)}
                                required
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Département ou ville</label>
                        <input
                            type="text"
                            value={territoire}
                            onChange={e => setTerritoire(e.target.value)}
                            placeholder="Ex: Paris, Lyon, Finistère..."
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Dans quel contexte souhaitez-vous agir ?</label>
                        <select
                            value={contexte}
                            onChange={e => setContexte(e.target.value)}
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 appearance-none"
                        >
                            <option value="" disabled>Sélectionnez une option</option>
                            <option value="Mon réseau personnel">Mon réseau personnel</option>
                            <option value="Une association">Une association</option>
                            <option value="Mon établissement scolaire">Mon établissement scolaire</option>
                            <option value="Mon entreprise">Mon entreprise</option>
                            <option value="Autre">Autre</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Message (optionnel)</label>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Pourquoi voulez-vous devenir ambassadeur ? (optionnel)"
                            rows={3}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                        />
                    </div>
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={!formValid || submitting}
                            className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold text-base flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {submitting
                                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : 'Je deviens ambassadeur →'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}