import { useState, useRef } from 'react'
import { supabase } from './supabaseClient'
import {
  ArrowLeft, ChevronRight, CheckCircle,
  AlertTriangle, Upload, Building2, FileText,
} from 'lucide-react'

type Fonction = 'Maire' | 'Adjoint au maire' | 'Directeur général des services' | 'Autre'

interface Step1 { name: string; siren: string; population: string; codeInsee: string }
interface Step2 { email: string; nom: string; prenom: string; fonction: Fonction; pdfFile: File | null }

const FONCTIONS: Fonction[] = ['Maire', 'Adjoint au maire', 'Directeur général des services', 'Autre']

function isOfficialEmail(email: string): boolean {
  const lower = email.toLowerCase()
  return lower.includes('mairie') || lower.includes('ville') || lower.endsWith('.gouv.fr')
}

const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300'

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
                  done ? 'bg-green-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'
                }`}>
                  {done ? <CheckCircle size={16} /> : n}
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 transition-colors ${done ? 'bg-green-400' : 'bg-slate-200'}`} />
                )}
              </div>
              <span className={`text-xs mt-1.5 font-medium text-center leading-tight ${
                active ? 'text-indigo-600' : done ? 'text-green-600' : 'text-slate-400'
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

export default function CommuneRegistration({ onBack }: { onBack: () => void }) {
  const [step, setStep]           = useState(1)
  const [error, setError]         = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [s1, setS1] = useState<Step1>({ name: '', siren: '', population: '', codeInsee: '' })
  const [s2, setS2] = useState<Step2>({ email: '', nom: '', prenom: '', fonction: 'Maire', pdfFile: null })
  const [certifie, setCertifie] = useState(false)

  const emailWarning = s2.email.length > 3 && !isOfficialEmail(s2.email)

  function validate1(): string | null {
    if (!s1.name.trim())                                                      return 'Le nom de la commune est obligatoire.'
    if (!/^\d{9}$/.test(s1.siren))                                           return 'Le SIREN doit contenir exactement 9 chiffres.'
    if (!s1.population || isNaN(Number(s1.population)) || Number(s1.population) <= 0)
                                                                              return 'La population doit être un nombre positif.'
    if (s1.codeInsee.trim().length !== 5)                                    return 'Le code INSEE doit contenir exactement 5 caractères.'
    return null
  }

  function validate2(): string | null {
    if (!s2.email.trim())                                                     return "L'email officiel est obligatoire."
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
        siren:                s1.siren,
        population:           parseInt(s1.population),
        code_insee:           s1.codeInsee.trim(),
        email_officiel:       s2.email.trim(),
        responsable_nom:      s2.nom.trim(),
        responsable_prenom:   s2.prenom.trim(),
        responsable_fonction: s2.fonction,
        type:                 'commune',
        verification_status:  'pending',
        abonnement:           false,
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
          className="mt-8 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition-all"
        >
          Retour à l'explorateur
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-indigo-700 px-5 pt-10 pb-6 text-white">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-indigo-200 text-xs font-medium mb-5 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Retour
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/50 flex items-center justify-center">
            <Building2 size={20} className="text-indigo-100" />
          </div>
          <div>
            <h1 className="text-xl font-black">Inscrire ma commune</h1>
            <p className="text-indigo-300 text-xs mt-0.5">Rejoignez la démocratie directe locale</p>
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
            <h2 className="font-bold text-slate-800 text-base">Identification de la commune</h2>

            <Field label="Nom de la commune *">
              <input
                className={inputCls}
                placeholder="Ex : Bordeaux"
                value={s1.name}
                onChange={e => setS1(p => ({ ...p, name: e.target.value }))}
              />
            </Field>

            <Field
              label="Numéro SIREN *"
              hint={
                <p className="text-xs text-indigo-500 mt-1">
                  Trouvez votre SIREN sur{' '}
                  <a href="https://www.sirene.fr" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    sirene.fr
                  </a>
                </p>
              }
            >
              <input
                className={inputCls}
                placeholder="9 chiffres"
                value={s1.siren}
                inputMode="numeric"
                maxLength={9}
                onChange={e => setS1(p => ({ ...p, siren: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
              />
            </Field>

            <Field label="Population">
              <input
                className={inputCls}
                placeholder="Nombre d'habitants"
                value={s1.population}
                inputMode="numeric"
                onChange={e => setS1(p => ({ ...p, population: e.target.value.replace(/\D/g, '') }))}
              />
            </Field>

            <Field label="Code INSEE *">
              <input
                className={inputCls}
                placeholder="5 caractères (ex : 33063)"
                value={s1.codeInsee}
                maxLength={5}
                onChange={e => setS1(p => ({ ...p, codeInsee: e.target.value.slice(0, 5) }))}
              />
            </Field>
          </div>
        )}

        {/* ── Étape 2 : Contact officiel ────────────────────── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-slate-800 text-base">Contact officiel</h2>

            <Field label="Email officiel de la mairie *">
              <input
                className={inputCls}
                type="email"
                placeholder="contact@mairie-bordeaux.fr"
                value={s2.email}
                onChange={e => setS2(p => ({ ...p, email: e.target.value }))}
              />
              {emailWarning && (
                <div className="flex items-start gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-2.5 py-2 mt-1.5">
                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                  Cet email ne semble pas être une adresse officielle (mairie / ville / .gouv.fr). Vous pouvez tout de même continuer.
                </div>
              )}
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
                  placeholder="Jean"
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

            <Field label="Délibération du conseil municipal (PDF)">
              <div
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-3 w-full bg-slate-50 border border-dashed border-slate-300 rounded-xl px-3 py-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  {s2.pdfFile
                    ? <FileText size={18} className="text-indigo-600" />
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
              <div className="space-y-0 text-sm divide-y divide-slate-50">
                {([
                  ['Commune',     s1.name],
                  ['SIREN',       s1.siren],
                  ['Code INSEE',  s1.codeInsee],
                  ['Population',  `${parseInt(s1.population).toLocaleString('fr-FR')} habitants`],
                  ['Email',       s2.email],
                  ['Responsable', `${s2.prenom} ${s2.nom}`],
                  ['Fonction',    s2.fonction],
                  ...(s2.pdfFile ? [['PDF joint', s2.pdfFile.name]] : []),
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 py-2.5">
                    <span className="text-slate-400 flex-shrink-0">{label}</span>
                    <span className="font-semibold text-slate-800 text-right break-all">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={certifie}
                onChange={e => setCertifie(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-indigo-600 flex-shrink-0"
              />
              <span className="text-sm text-slate-600 leading-relaxed">
                Je certifie agir au nom de cette commune et être habilité à engager celle-ci sur cette plateforme.
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
              className="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
            >
              Suivant
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!certifie || submitting}
              className="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all disabled:opacity-50"
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
