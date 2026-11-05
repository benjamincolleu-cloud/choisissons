import { useState } from 'react'
import { Flag } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { getSupabaseIdentity } from '../../lib/identity'
import type { LoiFiche, FicheArgument, FicheDebatEtape } from '../../types'

// Fiche « vulgarisation » d'une loi. Règles de neutralité (décision du 31/10/2026) :
// autant d'arguments pour que contre, chacun avec son auteur et sa source,
// aucun chiffre de vote (ils restent masqués jusqu'au vote du citoyen).

const POSITION: Record<FicheDebatEtape['position'], { label: string; className: string }> = {
    oui: { label: 'Oui', className: 'text-green-800 bg-green-100' },
    non: { label: 'Non', className: 'text-red-800 bg-red-100' },
    a_suivre: { label: 'À suivre', className: 'text-slate-700 bg-slate-200' },
}

function formatDateLongue(iso: string): string {
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function LienSource({ url }: { url?: string }) {
    if (!url) return null
    return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#002395] font-semibold hover:underline whitespace-nowrap">
            source ↗
        </a>
    )
}

function CarteArgument({ arg, couleur }: { arg: FicheArgument; couleur: 'vert' | 'rouge' }) {
    const fond = couleur === 'vert' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
    return (
        <li className={`border rounded-xl px-3 py-2.5 ${fond}`}>
            <p className="text-sm text-slate-800 leading-snug">{arg.texte}</p>
            <p className="text-xs text-slate-500 mt-1">
                {arg.auteur}
                {arg.source_url && <> · <LienSource url={arg.source_url} /></>}
            </p>
        </li>
    )
}

type EtatSignalement = 'ferme' | 'ouvert' | 'envoi' | 'envoye' | 'deja' | 'connexion' | 'erreur'

const MESSAGE_SIGNALEMENT: Partial<Record<EtatSignalement, string>> = {
    envoye: 'Merci, votre signalement a été transmis à l\'équipe.',
    deja: 'Vous avez déjà signalé cette fiche.',
    connexion: 'Connectez-vous pour signaler un manque de neutralité.',
    erreur: 'Le signalement n\'a pas pu être envoyé. Réessayez plus tard.',
}

function SignalerNeutralite({ ficheId }: { ficheId: string }) {
    const [etat, setEtat] = useState<EtatSignalement>('ferme')
    const [message, setMessage] = useState('')

    async function envoyer() {
        setEtat('envoi')
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setEtat('connexion'); return }
            const reporterHash = await getSupabaseIdentity(user.id)
            // Pas de .select() : les citoyens peuvent signaler, pas relire les signalements
            const { error } = await supabase
                .from('loi_fiches_signalements')
                .insert({ fiche_id: ficheId, reporter_hash: reporterHash, message: message.trim() || null })
            if (!error) setEtat('envoye')
            else if (error.code === '23505') setEtat('deja')
            else setEtat('erreur')
        } catch {
            setEtat('erreur')
        }
    }

    if (etat === 'ferme') {
        return (
            <button
                onClick={() => setEtat('ouvert')}
                className="mt-3 min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm text-slate-600 font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors"
            >
                <Flag size={14} />
                Signaler un manque de neutralité
            </button>
        )
    }

    if (etat === 'ouvert' || etat === 'envoi') {
        return (
            <div className="mt-3 space-y-2">
                <label htmlFor="signalement-message" className="text-sm font-semibold text-slate-700">
                    Qu'est-ce qui vous semble pencher d'un côté ? (facultatif)
                </label>
                <textarea
                    id="signalement-message"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002395]/30"
                />
                <div className="flex gap-2">
                    <button
                        onClick={() => void envoyer()}
                        disabled={etat === 'envoi'}
                        className="min-h-[44px] px-4 rounded-xl bg-[#002395] text-white text-sm font-semibold disabled:opacity-60"
                    >
                        {etat === 'envoi' ? 'Envoi…' : 'Envoyer'}
                    </button>
                    <button
                        onClick={() => { setEtat('ferme'); setMessage('') }}
                        disabled={etat === 'envoi'}
                        className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm text-slate-600"
                    >
                        Annuler
                    </button>
                </div>
            </div>
        )
    }

    return <p className="mt-3 text-sm text-slate-600" role="status">{MESSAGE_SIGNALEMENT[etat]}</p>
}

export default function LawFiche({ fiche }: { fiche: LoiFiche }) {
    const majLe = formatDateLongue(fiche.majLe)
    const aDesArguments = fiche.argumentsPour.length > 0 || fiche.argumentsContre.length > 0

    return (
        <div className="p-4 border-b border-slate-100 space-y-6">
            <section>
                <h3 className="font-bold text-slate-700 text-sm mb-2">En clair</h3>
                <p className="text-[15px] text-slate-700 leading-relaxed">{fiche.enClair}</p>
            </section>

            {fiche.changements.length > 0 && (
                <section>
                    <h3 className="font-bold text-slate-700 text-sm mb-3">Ce que le texte change</h3>
                    <ul className="space-y-3">
                        {fiche.changements.map(c => (
                            <li key={c.titre}>
                                <p className="text-sm font-semibold text-slate-800">{c.titre}</p>
                                <p className="text-sm text-slate-600 leading-relaxed">{c.texte}</p>
                            </li>
                        ))}
                    </ul>
                    {fiche.contexte && (
                        <p className="text-[13px] text-slate-500 leading-relaxed mt-3 bg-slate-50 rounded-xl p-3">{fiche.contexte}</p>
                    )}
                </section>
            )}

            {fiche.debat && fiche.debat.etapes.length > 0 && (
                <section>
                    <h3 className="font-bold text-slate-700 text-sm mb-2">Ce qui fait débat</h3>
                    <p className="text-sm text-slate-800 font-medium mb-3">{fiche.debat.question}</p>
                    <ol className="space-y-2.5">
                        {fiche.debat.etapes.map((e, i) => (
                            <li key={i} className="flex gap-2.5 items-baseline">
                                <span className={`text-[11px] font-bold rounded-md px-2 py-0.5 flex-shrink-0 ${POSITION[e.position]?.className ?? POSITION.a_suivre.className}`}>
                                    {POSITION[e.position]?.label ?? 'À suivre'}
                                </span>
                                <span className="text-sm text-slate-600 leading-snug">
                                    {e.texte}
                                    {e.source_url && <> <LienSource url={e.source_url} /></>}
                                </span>
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            {aDesArguments && (
                <section>
                    <h3 className="font-bold text-slate-700 text-sm mb-1">Les arguments</h3>
                    {fiche.argumentsIntro && <p className="text-xs text-slate-500 mb-3">{fiche.argumentsIntro}</p>}
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-bold text-green-700 mb-2">Pour</p>
                            <ul className="space-y-2">
                                {fiche.argumentsPour.map((a, i) => <CarteArgument key={i} arg={a} couleur="vert" />)}
                            </ul>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-red-700 mb-2">Contre ou réservés</p>
                            <ul className="space-y-2">
                                {fiche.argumentsContre.map((a, i) => <CarteArgument key={i} arg={a} couleur="rouge" />)}
                            </ul>
                        </div>
                    </div>
                </section>
            )}

            <section>
                {fiche.sources.length > 0 && (
                    <details>
                        <summary className="text-sm font-semibold text-[#002395] cursor-pointer min-h-[44px] flex items-center">
                            Voir les sources ({fiche.sources.length})
                        </summary>
                        <ul className="space-y-1.5 mt-1">
                            {fiche.sources.map(s => (
                                <li key={s.url}>
                                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#002395] hover:underline leading-snug">
                                        {s.libelle} ↗
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </details>
                )}
                <p className="text-xs text-slate-400 leading-relaxed mt-3">
                    Fiche préparée par IA à partir de sources publiques, relue par l'équipe avant publication{majLe ? `. Mise à jour le ${majLe}.` : '.'}
                </p>
                <SignalerNeutralite ficheId={fiche.id} />
            </section>
        </div>
    )
}
