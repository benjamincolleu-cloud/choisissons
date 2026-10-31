import type { EtapeFrise, LoiDossier } from '../../types'
import { Check, Clock, X } from 'lucide-react'

interface LawTimelineProps {
    frise: EtapeFrise[]
    variant: 'compact' | 'detail'
    statut: LoiDossier['statut']
}

// Décision du 30/10/2026 : la frise montre toujours le vrai parcours de la loi
// (information publique, comme dans les médias). Seuls les chiffres du vote
// des députés restent masqués jusqu'au vote du citoyen (voir LawCard).
// « rattrape » : une assemblée a rejeté le texte, mais la loi a finalement été
// adoptée (ex. les députés ont eu le dernier mot) → orange, pas rouge.
type EtatAffiche = EtapeFrise['etat'] | 'rattrape'

const ETAT_LABEL: Record<EtatAffiche, string> = {
    fait: 'fait',
    en_cours: 'en cours',
    en_attente: 'en attente',
    echec: 'rejeté',
    a_venir: 'à venir',
    rattrape: 'rejeté, puis texte finalement adopté',
}

function etatAffiche(etape: EtapeFrise, statut: LoiDossier['statut']): EtatAffiche {
    if (etape.etat === 'echec' && (statut === 'promulgue' || statut === 'adopte')) return 'rattrape'
    return etape.etat
}

// Étape passée : le texte a continué son chemin
function estFranchi(etat: EtatAffiche): boolean {
    return etat === 'fait' || etat === 'rattrape'
}

function formatJJMMAAAA(date: string | null): string {
    const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

function Pastille({ etat, size }: { etat: EtatAffiche; size: number }) {
    const icon = Math.round(size * 0.6)
    const base = 'rounded-full flex items-center justify-center flex-shrink-0 relative z-10'
    const style = { width: size, height: size }
    switch (etat) {
        case 'fait':
            return <span className={`${base} bg-green-500`} style={style}><Check size={icon} className="text-white" strokeWidth={3} /></span>
        case 'rattrape':
            return <span className={`${base} bg-orange-400`} style={style}><X size={icon} className="text-white" strokeWidth={3} /></span>
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

export default function LawTimeline({ frise, variant, statut }: LawTimelineProps) {
    const etats = frise.map(e => etatAffiche(e, statut))
    const ariaLabel = (etape: EtapeFrise, i: number) => `${etape.titre} : ${ETAT_LABEL[etats[i]]}`
    // Trait vert entre deux étapes franchies
    const traitClass = (i: number) =>
        estFranchi(etats[i]) && estFranchi(etats[i + 1]) ? 'bg-green-500' : 'bg-slate-200'

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
                            <span role="img" aria-label={ariaLabel(etape, i)} title={etape.detail || undefined}>
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
                    const ligne = [formatJJMMAAAA(etape.date), etape.detail].filter(Boolean).join(' · ')
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
            {statut === 'en_cours' && (
                <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <p className="text-[13px] font-semibold text-slate-700">Pourquoi c'est encore en débat après le vote des députés ?</p>
                    <p className="text-[13px] text-slate-500">Une loi doit être adoptée par les deux assemblées.</p>
                </div>
            )}
        </div>
    )
}
