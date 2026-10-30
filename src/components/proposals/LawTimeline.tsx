import type { EtapeFrise, EtatEtape } from '../../types'
import { Check, Clock, X } from 'lucide-react'

interface LawTimelineProps {
    frise: EtapeFrise[]
    variant: 'compact' | 'detail'
    resultatsVisibles: boolean
}

// État réellement affiché : tant que les résultats sont masqués, « fait » et « échec »
// se ressemblent (anti-influence) — on ne montre ni adopté ni rejeté.
type EtatAffiche = EtatEtape | 'neutre'

const ETAT_LABEL: Record<EtatEtape, string> = {
    fait: 'fait',
    en_cours: 'en cours',
    en_attente: 'en attente',
    echec: 'échec',
    a_venir: 'à venir',
}

function parseIsoDate(date: string | null): [string, string, string] | null {
    const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? [m[3], m[2], m[1]] : null
}

function formatJJMM(date: string | null): string {
    const p = parseIsoDate(date)
    return p ? `${p[0]}/${p[1]}` : ''
}

function formatJJMMAAAA(date: string | null): string {
    const p = parseIsoDate(date)
    return p ? `${p[0]}/${p[1]}/${p[2]}` : ''
}

function etatAffiche(etape: EtapeFrise, resultatsVisibles: boolean): EtatAffiche {
    if (!resultatsVisibles && (etape.etat === 'fait' || etape.etat === 'echec')) return 'neutre'
    return etape.etat
}

// Texte neutre d'une étape terminée (le dépôt n'est pas un vote : il ne révèle rien)
function texteNeutre(etape: EtapeFrise): string {
    const jjmm = formatJJMM(etape.date)
    if (etape.cle === 'depot') return jjmm ? `Déposé le ${jjmm}` : 'Déposé'
    return jjmm ? `Vote le ${jjmm}` : 'Vote terminé'
}

function estTermine(etat: EtatAffiche): boolean {
    return etat === 'fait' || etat === 'neutre'
}

function Pastille({ etat, size }: { etat: EtatAffiche; size: number }) {
    const icon = Math.round(size * 0.6)
    const base = 'rounded-full flex items-center justify-center flex-shrink-0 relative z-10'
    const style = { width: size, height: size }
    switch (etat) {
        case 'fait':
            return <span className={`${base} bg-green-500`} style={style}><Check size={icon} className="text-white" strokeWidth={3} /></span>
        case 'neutre':
            return <span className={`${base} bg-[#002395]`} style={style}><Check size={icon} className="text-white" strokeWidth={3} /></span>
        case 'echec':
            return <span className={`${base} bg-red-500`} style={style}><X size={icon} className="text-white" strokeWidth={3} /></span>
        case 'en_cours':
            return <span className={`${base} bg-white border-[3px] border-amber-500`} style={style} />
        case 'en_attente':
            return <span className={`${base} bg-white border border-amber-400`} style={style}><Clock size={icon} className="text-amber-500" /></span>
        default:
            return <span className={`${base} bg-white border-2 border-slate-200`} style={style} />
    }
}

export default function LawTimeline({ frise, variant, resultatsVisibles }: LawTimelineProps) {
    const etats = frise.map(e => etatAffiche(e, resultatsVisibles))
    const ariaLabel = (etape: EtapeFrise, i: number) =>
        `${etape.titre} : ${etats[i] === 'neutre' ? texteNeutre(etape).toLowerCase() : ETAT_LABEL[etape.etat]}`
    // Trait coloré entre deux étapes terminées (bleu en mode neutre, vert sinon)
    const traitClass = (i: number) =>
        estTermine(etats[i]) && estTermine(etats[i + 1])
            ? (resultatsVisibles ? 'bg-green-500' : 'bg-[#002395]')
            : 'bg-slate-200'

    if (variant === 'compact') {
        return (
            <ol aria-label="Où en est la loi" className="flex items-start">
                {frise.map((etape, i) => {
                    const actuelle = etape.etat === 'en_cours'
                    return (
                        <li key={etape.cle} className="flex-1 min-w-0 flex flex-col items-center relative">
                            {i < frise.length - 1 && (
                                <span aria-hidden="true" className={`absolute top-[8px] left-1/2 w-full h-[2px] ${traitClass(i)}`} />
                            )}
                            <span role="img" aria-label={ariaLabel(etape, i)} title={etats[i] === 'neutre' ? texteNeutre(etape) : undefined}>
                                <Pastille etat={etats[i]} size={18} />
                            </span>
                            <span className={`mt-1 text-[10px] text-slate-500 text-center leading-tight ${actuelle ? 'font-bold' : ''}`}>
                                {etape.titre}
                            </span>
                        </li>
                    )
                })}
            </ol>
        )
    }

    return (
        <div>
            <ol aria-label="Où en est la loi">
                {frise.map((etape, i) => {
                    const neutre = etats[i] === 'neutre'
                    const date = formatJJMMAAAA(etape.date)
                    const ligne = neutre && etape.cle !== 'depot'
                        ? texteNeutre(etape)
                        : [date, etape.detail].filter(Boolean).join(' · ')
                    const derniere = i === frise.length - 1
                    return (
                        <li key={etape.cle} className="flex gap-3">
                            <div className="flex flex-col items-center">
                                <span role="img" aria-label={ariaLabel(etape, i)}>
                                    <Pastille etat={etats[i]} size={24} />
                                </span>
                                {!derniere && <span aria-hidden="true" className={`w-[2px] flex-1 min-h-[16px] ${traitClass(i)}`} />}
                            </div>
                            <div className={`min-w-0 ${derniere ? '' : 'pb-4'}`}>
                                <p className="text-[14px] font-bold text-slate-800 leading-6">{etape.titre}</p>
                                {ligne && <p className="text-[13px] text-slate-500 leading-snug">{ligne}</p>}
                            </div>
                        </li>
                    )
                })}
            </ol>
            <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[13px] font-semibold text-slate-700">Pourquoi c'est encore en débat après le vote des députés ?</p>
                <p className="text-[13px] text-slate-500">Une loi doit être adoptée par les deux assemblées.</p>
            </div>
        </div>
    )
}
