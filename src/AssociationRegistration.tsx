import { useState, useRef } from 'react'
import { supabase } from './supabaseClient'
import {
  ArrowLeft, ChevronRight, CheckCircle,
  AlertTriangle, Upload, Users, FileText,
} from 'lucide-react'

type AssocType = 'Association loi 1901' | 'Fondation' | 'Coopérative' | 'Tiers-lieu' | 'Collectif' | 'Autre'
type Fonction  = 'Président(e)' | 'Trésorier(e)' | 'Secrétaire général(e)' | 'Directeur(trice)' | 'Autre'

interface Step1 { name: string; rna: string; adherents: string; objet: string; assocType: AssocType }
interface Step2 { email: string; nom: string; prenom: string; fonction: Fonction; pdfFile: File | null }

const ASSOC_TYPES: AssocType[] = ['Association loi 1901', 'Fondation', 'Coopérative', 'Tiers-lieu', 'Collectif', 'Autre']
const FONCTIONS: Fonction[]    = ['Président(e)', 'Trésorier(e)', 'Secrétaire général(e)', 'Directeur(trice)', 'Autre']

const PLANS = [
  { key: 's', label: 'Association S', price: '9€/mois',  limit: 'Jusqu\'à 50 adhérents',       color: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
  { key: 'm', label: 'Association M', price: '19€/mois', limit: 'Jusqu\'à 200 adhérents',      color: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
  { key: 'l', label: 'Association L', price: '49€/mois', limit: 'Adhérents illimités + page publique', color: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
]

function recommendedPlan(adherents: string): 's' | 'm' | 'l' {
  const n = parseInt(adherents)
  if (!n || isNaN(n)) return 's'
  if (n < 50)  return 's'
  if (n < 200) return 'm'
  return 'l'
}

const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300'

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      {children}
      {hint}
    </div>
  )
}

function StepIndicator({ current }: { current: number }) {
  const steps = ['Identification', 'Contact', 'Confirmation']
  return (
    <div className="flex items-start mb-8">
      {steps.map((label, i) => {
        const n = i + 1
        const done   = current > n
        const active = current === n
        return (
          <div key={label} className="flex items-start flex-1">
            <div className="flex flex-col items-center w-full">
              <div className="flex items-center w-full">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${
                  done ? 'bg-green-500 text-white' : active ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
                }`}>
                  {done ? <CheckCircle size={16} /> : n}
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 transition-colors ${done ? 'bg-green-400' : 'bg-slate-200'}`} />
                )}
              </div>
              <span className={`text-xs mt-1.5 font-medium text-center leading-tight ${
                active ? 'text-emerald-600' : done ? 'text-green-600' : 'text-slate-400'
              }`}>
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AssociationRegistration({ onBack }: { onBack: () => void }) {
  const [step, setStep]             = useState(1)
  const [error, setError]           = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [s1, setS1] = useState<Step1>({
    name: '', rna: '', adherents: '', objet: '', assocType: 'Association loi 1901',
  })
  const [s2, setS2] = useState<Step2>({
    email: '', nom: '', prenom: '', fonction: 'Président(e)', pdfFile: null,
  })
  const [certifie, setCertifie] = useState(false)

  const plan = recommendedPlan(s1.adherents)
  const planInfo = PLANS.find(p => p.key === plan)!

  function validate1(): string | null {
    if (!s1.name.trim())                     return "Le nom de l'association est obligatoire."
    if (!/^W\d{9}$/.test(s1.rna.trim()))    return 'Le RNA doit être au format W + 9 chiffres (ex : W751234567).'
    if (!s1.objet.trim())                    return "L'objet de l'association est obligatoire."
    return null
  }

  function validate2(): string | null {
    if (!s2.email.trim())                                                     return "L'email est obligatoire."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s2.email))                       return 'Adresse email invalide.'
    if (!s2.nom.trim())                                                       return 'Le nom du responsable est obligatoire.'
    if (!s2.prenom.trim())                                                    return 'Le prénom du responsable est obligatoire.'
    return null
  }

  function next() {
    const err = step === 1 ? validate1() : validate2()
    if (err) { setError(err); return }
    setError(null)
    setStep(s => s + 1)
  }

  async function handleSubmit() {
    if (!certifie) { setError('Vous devez cocher la case de certification.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const { error: e } = await supabase.from('organisations').insert({
        name:                 s1.name.trim(),
        rna:                  s1.rna.trim(),
        nombre_adherents:     s1.adherents ? parseInt(s1.adherents) : null,
        description:          s1.objet.trim(),
        email_officiel:       s2.email.trim(),
        responsable_nom:      s2.nom.trim(),
        responsable_prenom:   s2.prenom.trim(),
        responsable_fonction: s2.fonction,
        type:                 'association',
        verification_status:  'pending',
        abonnement:           'pending',
      })
      if (e) throw e
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue. Réessayez.')
    }
    setSubmitting(false)
  }

  // ── Écran de confirmation post-soumission ──────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-5">
          <CheckCircle size={40} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-3">Demande envoyée !</h2>
        <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
          Nous vous contacterons sous 48h à l'adresse{' '}
          <span className="font-semibold text-slate-700">{s2.email}</span>{' '}
          pour finaliser l'inscription de{' '}
          <span className="font-semibold text-slate-700">{s1.name}</span>.
        </p>
        <button
          onClick={onBack}
          className="mt-8 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition-all"
        >
          Retour à l'explorateur
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-emerald-700 px-5 pt-10 pb-6 text-white">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-emerald-200 text-xs font-medium mb-5 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Retour
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/50 flex items-center justify-center">
            <Users size={20} className="text-emerald-100" />
          </div>
          <div>
            <h1 className="text-xl font-black">Inscrire mon association</h1>
            <p className="text-emerald-300 text-xs mt-0.5">Rejoignez la démocratie participative</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto">
        <div className="pt-4">
          <StepIndicator current={step} />
        </div>

        {/* Bandeau d'erreur */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4 text-sm text-red-600">
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* ── Étape 1 : Identification ──────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-slate-800 text-base">Identification de l'association</h2>

            <Field label="Nom de l'association *">
              <input
                className={inputCls}
                placeholder="Ex : Les Amis du Quartier"
                value={s1.name}
                onChange={e => setS1(p => ({ ...p, name: e.target.value }))}
              />
            </Field>

            <Field
              label="Numéro RNA *"
              hint={
                <p className="text-xs text-emerald-600 mt-1">
                  Trouvez votre RNA sur{' '}
                  <a
                    href="https://www.journal-officiel.gouv.fr/associations/recherche/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    journal-officiel.gouv.fr
                  </a>
                </p>
              }
            >
              <input
                className={inputCls}
                placeholder="W + 9 chiffres (ex : W751234567)"
                value={s1.rna}
                maxLength={10}
                onChange={e => {
                  const v = e.target.value.toUpperCase()
                  // Allow W prefix then digits
                  if (v === '' || v === 'W' || /^W\d{0,9}$/.test(v)) {
                    setS1(p => ({ ...p, rna: v }))
                  }
                }}
              />
            </Field>

            <Field label="Nombre d'adhérents">
              <input
                className={inputCls}
                placeholder="Nombre approximatif"
                value={s1.adherents}
                inputMode="numeric"
                onChange={e => setS1(p => ({ ...p, adherents: e.target.value.replace(/\D/g, '') }))}
              />
              {s1.adherents && (
                <div className="flex items-center gap-2 mt-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <CheckCircle size={13} className="text-emerald-600 flex-shrink-0" />
                  <p className="text-xs text-emerald-700 font-medium">
                    Plan recommandé : <strong>{planInfo.label}</strong> — {planInfo.price} ({planInfo.limit})
                  </p>
                </div>
              )}
            </Field>

            <Field label="Objet de l'association *">
              <input
                className={inputCls}
                placeholder="Ex : Promotion de la culture locale"
                value={s1.objet}
                onChange={e => setS1(p => ({ ...p, objet: e.target.value }))}
              />
            </Field>

            <Field label="Type *">
              <select
                className={inputCls}
                value={s1.assocType}
                onChange={e => setS1(p => ({ ...p, assocType: e.target.value as AssocType }))}
              >
                {ASSOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
        )}

        {/* ── Étape 2 : Contact officiel ────────────────────── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-slate-800 text-base">Contact officiel</h2>

            <Field label="Email *">
              <input
                className={inputCls}
                type="email"
                placeholder="contact@mon-association.fr"
                value={s2.email}
                onChange={e => setS2(p => ({ ...p, email: e.target.value }))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Nom *">
                <input
                  className={inputCls}
                  placeholder="Dupont"
                  value={s2.nom}
                  onChange={e => setS2(p => ({ ...p, nom: e.target.value }))}
                />
              </Field>
              <Field label="Prénom *">
                <input
                  className={inputCls}
                  placeholder="Marie"
                  value={s2.prenom}
                  onChange={e => setS2(p => ({ ...p, prenom: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Fonction *">
              <select
                className={inputCls}
                value={s2.fonction}
                onChange={e => setS2(p => ({ ...p, fonction: e.target.value as Fonction }))}
              >
                {FONCTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>

            <Field label="Statuts de l'association (PDF)">
              <div
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-3 w-full bg-slate-50 border border-dashed border-slate-300 rounded-xl px-3 py-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  {s2.pdfFile
                    ? <FileText size={18} className="text-emerald-600" />
                    : <Upload size={18} className="text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {s2.pdfFile ? s2.pdfFile.name : 'Choisir un fichier PDF'}
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Recommandé — requis pour la phase officielle
                  </p>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={e => setS2(p => ({ ...p, pdfFile: e.target.files?.[0] ?? null }))}
              />
            </Field>
          </div>
        )}

        {/* ── Étape 3 : Confirmation ────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="font-bold text-slate-800 text-base mb-4">Récapitulatif</h2>
              <div className="text-sm divide-y divide-slate-50">
                {([
                  ['Association',  s1.name],
                  ['Type',         s1.assocType],
                  ['RNA',          s1.rna],
                  ['Objet',        s1.objet],
                  ...(s1.adherents ? [['Adhérents', `${parseInt(s1.adherents).toLocaleString('fr-FR')}`]] : []),
                  ['Email',        s2.email],
                  ['Responsable',  `${s2.prenom} ${s2.nom}`],
                  ['Fonction',     s2.fonction],
                  ...(s2.pdfFile ? [['PDF joint', s2.pdfFile.name]] : []),
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 py-2.5">
                    <span className="text-slate-400 flex-shrink-0">{label}</span>
                    <span className="font-semibold text-slate-800 text-right break-all">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan recommandé */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Plan recommandé</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-emerald-800">{planInfo.label}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">{planInfo.limit}</p>
                </div>
                <span className="text-xl font-black text-emerald-700">{planInfo.price}</span>
              </div>
            </div>

            <label className="flex items-start gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={certifie}
                onChange={e => setCertifie(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-600 flex-shrink-0"
              />
              <span className="text-sm text-slate-600 leading-relaxed">
                Je certifie agir au nom de cette association et être habilité à l'engager sur cette plateforme.
              </span>
            </label>
          </div>
        )}

        {/* Boutons navigation */}
        <div className="flex gap-3 mt-5 pb-10">
          {step > 1 && (
            <button
              onClick={() => { setError(null); setStep(s => s - 1) }}
              className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-slate-600 font-semibold text-sm active:scale-95 transition-all"
            >
              Retour
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={next}
              className="flex-1 py-3.5 rounded-2xl bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
            >
              Suivant
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!certifie || submitting}
              className="flex-1 py-3.5 rounded-2xl bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all disabled:opacity-50"
            >
              {submitting
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : "Envoyer la demande d'inscription"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
