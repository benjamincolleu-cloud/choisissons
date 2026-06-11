import { useState } from 'react'
import { Shield, Users, Sprout, CheckCircle, ChevronRight, BookOpen, Lock } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { sha256Hex, isAtLeast18 } from '../../lib/utils'
import { showToast } from '../../lib/toast'
import { WORKFLOW_STEPS } from '../../lib/constants'

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-indigo-600 p-5 text-white text-center">
          <img src="/logo.png" alt="CHOISISSONS" className="w-16 h-16 object-contain mb-3" />
          <h2 className="text-xl font-black tracking-tight">CHOISISSONS</h2>
          <p className="text-indigo-200 text-xs mt-1">La démocratie directe citoyenne</p>
        </div>
        <div className="p-5">
          <p className="text-slate-600 text-sm leading-relaxed mb-5">
            CHOISISSONS est une plateforme indépendante qui permet à chaque citoyen de proposer,
            débattre et voter des décisions publiques. Sans partis, sans publicité, sans algorithme
            de manipulation — juste la voix du peuple.
          </p>
          <div className="space-y-3 mb-6">
            {[
              { icon: BookOpen, label: 'Transparence', desc: 'Toutes les décisions et les votes agrégés sont publics.' },
              { icon: Lock, label: 'Anonymat', desc: 'Votre vote individuel est chiffré et ne peut être tracé.' },
              { icon: Shield, label: 'Souveraineté', desc: 'Aucun acteur privé ni politique ne contrôle la plateforme.' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={14} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{label}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold text-sm active:scale-95 transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [dateNaissance, setDateNaissance] = useState('')
  const [certifie, setCertifie] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [showAbout, setShowAbout] = useState(false)

  const formValid = email.trim() && /^\d{5}$/.test(codePostal) && dateNaissance && certifie

  const handleSendLink = async () => {
    if (!email.trim() || sending) return
    if (!/^\d{5}$/.test(codePostal)) {
      showToast('Le code postal doit contenir exactement 5 chiffres.')
      return
    }
    if (!dateNaissance) {
      showToast('Veuillez entrer votre date de naissance.')
      return
    }
    if (!isAtLeast18(dateNaissance)) {
      showToast('Vous devez avoir 18 ans minimum pour vous inscrire.')
      return
    }
    if (!certifie) {
      showToast('Vous devez cocher la case de certification.')
      return
    }
    setSending(true)
    const dateHash = await sha256Hex(dateNaissance)
    localStorage.setItem('pending_profile', JSON.stringify({
      code_postal: codePostal,
      date_naissance_hash: dateHash,
    }))
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
      },
    })
    if (error) {
      showToast("Impossible d'envoyer le code. Vérifiez votre adresse email.")
      setSending(false)
    } else {
      setSent(true)
      setSending(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (otp.length < 6 || verifying) return
    setVerifying(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp,
      type: 'email',
    })
    if (error) {
      showToast('Code invalide ou expiré. Vérifiez votre email.')
      setVerifying(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-4 mb-8">
          <img src="/logo.png" alt="" className="h-32 w-auto" />
          <div className="text-left">
            <h1 className="text-4xl font-black text-white m-0">CHOISISSONS</h1>
            <p className="text-white/70 m-0 text-sm">La démocratie directe citoyenne</p>
          </div>
        </div>

        <div className="space-y-3 mb-8">
          {[
            { icon: Shield, text: 'Vote anonyme et vérifié cryptographiquement' },
            { icon: Users, text: 'Jury citoyen indépendant' },
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

        {sent ? (
          <div className="bg-white/10 rounded-2xl p-5 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={20} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">Code envoyé !</p>
                <p className="text-indigo-200 text-xs mt-0.5">
                  Consultez <span className="font-semibold text-white">{email}</span>
                </p>
              </div>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && void handleVerifyOtp()}
              placeholder="• • • • • •"
              maxLength={6}
              autoFocus
              className="w-full bg-white/10 border border-white/20 text-white placeholder-indigo-400 rounded-xl px-4 py-3.5 text-center text-2xl font-bold tracking-[0.4em] outline-none focus:ring-2 focus:ring-indigo-300 mb-3"
            />
            <button
              onClick={() => void handleVerifyOtp()}
              disabled={otp.length < 6 || verifying}
              className="w-full bg-indigo-500 text-white rounded-xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2 shadow-xl hover:bg-indigo-400 active:scale-95 transition-all disabled:opacity-50 mb-3"
            >
              {verifying
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'Vérifier le code'}
            </button>
            <button
              onClick={() => { setSent(false); setOtp('') }}
              className="w-full text-indigo-300 text-xs underline underline-offset-2 hover:text-indigo-100 transition-colors"
            >
              Changer d'adresse email
            </button>
          </div>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleSendLink()}
              placeholder="votre@email.fr"
              autoComplete="email"
              className="w-full bg-white/10 border border-white/20 text-white placeholder-indigo-300 rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 mb-3"
            />
            <input
              type="text"
              value={codePostal}
              onChange={e => setCodePostal(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="Code postal (ex : 75011)"
              inputMode="numeric"
              maxLength={5}
              className="w-full bg-white/10 border border-white/20 text-white placeholder-indigo-300 rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 mb-3"
            />
            <div className="mb-3">
              <label className="block text-indigo-200 text-xs font-medium mb-1.5">
                Date de naissance <span className="text-indigo-400">(18 ans minimum)</span>
              </label>
              <input
                type="date"
                value={dateNaissance}
                onChange={e => setDateNaissance(e.target.value)}
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().slice(0, 10)}
                className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 [color-scheme:dark]"
              />
            </div>
            <label className="flex items-start gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={certifie}
                onChange={e => setCertifie(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-indigo-400 flex-shrink-0"
              />
              <span className="text-indigo-200 text-xs leading-relaxed">
                Je certifie résider dans cette commune et voter en mon nom propre.
              </span>
            </label>
            <button
              onClick={() => void handleSendLink()}
              disabled={!formValid || sending}
              className="w-full bg-indigo-500 text-white rounded-xl py-4 px-6 font-semibold text-base flex items-center justify-center gap-3 shadow-xl hover:bg-indigo-400 active:scale-95 transition-all disabled:opacity-70"
            >
              {sending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Recevoir mon code de connexion'
              )}
            </button>
            <p className="text-center text-indigo-300/80 text-xs mt-3 leading-relaxed">
              Si vous avez déjà un compte, entrez votre email pour recevoir un nouveau code à 6 chiffres.
              Le code est valable 1 heure et fonctionne une seule fois.
            </p>
          </>
        )}

        <p className="text-center text-indigo-400 text-xs mt-3">
          Connexion sécurisée sans mot de passe · Phase 2 : FranceConnect
        </p>

        <button
          onClick={() => setShowAbout(true)}
          className="w-full text-center text-indigo-300 text-xs mt-2 underline underline-offset-2 hover:text-indigo-100 transition-colors"
        >
          En savoir plus sur CHOISISSONS
        </button>

        <div className="mt-8 bg-white/5 rounded-2xl p-4">
          <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-3">Comment ça marche</p>
          <div className="flex items-center justify-between text-xs text-indigo-200 mb-2">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <button
                  onClick={() => setActiveStep(activeStep === i ? null : i)}
                  className="text-center group"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-1 transition-colors ${activeStep === i ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white group-hover:bg-indigo-400'
                    }`}>
                    {i + 1}
                  </div>
                  <span className={activeStep === i ? 'text-white font-semibold' : ''}>{step.label}</span>
                </button>
                {i < 3 && <ChevronRight size={12} className="text-indigo-500 mx-1" />}
              </div>
            ))}
          </div>
          {activeStep !== null && (
            <div className="mt-3 bg-indigo-900/60 rounded-xl px-3 py-2.5 border border-indigo-700/50">
              <p className="text-indigo-100 text-xs leading-relaxed">
                <span className="font-semibold text-white">{WORKFLOW_STEPS[activeStep].label} — </span>
                {WORKFLOW_STEPS[activeStep].description}
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-indigo-600 text-xs mt-8">
          © 2026 CHOISISSONS — Mentions légales · Confidentialité
        </p>
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  )
}
