import { useState } from 'react'
import { Star, User, Landmark, Users, Globe, Newspaper, CheckCircle, ChevronRight } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { showToast } from '../lib/toast'
import { COMMUNE_TIERS, ASSOC_TIERS, COMMUNE_PLAN_MAP, ASSOC_PLAN_MAP, STRIPE_PRODUCT_IDS } from '../lib/constants'
import type { CommuneTier, AssocTier } from '../lib/constants'

export default function SupportPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [communeSize, setCommuneSize] = useState<CommuneTier>('small')
  const [assocSize, setAssocSize] = useState<AssocTier>('s')
  const [expanded, setExpanded] = useState<'commune' | 'assoc' | null>(null)
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null)

  async function handleCheckout(plan: string) {
    const productId = STRIPE_PRODUCT_IDS[plan]
    if (!productId) {
      showToast("Plan inconnu. Contactez le support.", 'error')
      return
    }
    setLoadingCheckout(plan)
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan, productId },
      })
      if (error) {
        const msg = (error as { message?: string }).message ?? String(error)
        showToast(`Erreur paiement : ${msg}`, 'error')
        return
      }
      const d = data as { url?: string; error?: string }
      if (d?.error) {
        showToast(`Erreur : ${d.error}`, 'error')
        return
      }
      if (!d?.url) {
        showToast("Impossible de lancer le paiement. Réessayez plus tard.", 'error')
        return
      }
      window.location.href = d.url
    } catch {
      showToast("Impossible de lancer le paiement. Réessayez plus tard.", 'error')
    } finally {
      setLoadingCheckout(null)
    }
  }

  return (
    <div className="p-4">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-800">Soutenir</h1>
        <p className="text-slate-500 text-sm leading-relaxed">
          Choisissons est indépendant. Votre soutien garantit notre neutralité.
        </p>
      </div>

      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-4 mb-6 text-white">
        <div className="flex items-start gap-3">
          <Star size={20} className="text-yellow-300 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm mb-1">Notre engagement</p>
            <p className="text-indigo-100 text-xs leading-relaxed">
              Aucune publicité, aucun financement politique. 100% des revenus financent l'infrastructure et la sécurité.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">

        {/* ── Citoyen ── */}
        <div className={`rounded-2xl border-2 overflow-hidden transition-all border-indigo-300 ${selected === 'citoyen' ? 'shadow-lg' : ''}`}>
          <div className="bg-indigo-600 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User size={20} />
              <span className="font-black text-lg">Citoyen</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black">2€</span>
              <span className="text-xs opacity-75 ml-0.5">/mois</span>
            </div>
          </div>
          <div className="p-4 bg-white">
            <ul className="space-y-2 mb-4">
              {[
                'Accès complet sans publicité',
                'Badge « Citoyen soutenant »',
                'Soumettre des propositions citoyennes',
                'Publier des arguments écrits (Agora)',
                'Postuler comme juré',
                'Suivre plusieurs communes et associations',
                'Newsletter mensuelle',
              ].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle size={14} className="text-green-500 flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => selected === 'citoyen' ? void handleCheckout('citoyen') : setSelected('citoyen')}
              disabled={loadingCheckout === 'citoyen'}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 ${selected === 'citoyen' ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white'}`}
            >
              {loadingCheckout === 'citoyen' ? 'Redirection…' : selected === 'citoyen' ? '✓ Sélectionné — Passer au paiement →' : 'Soutenir la démocratie'}
            </button>
          </div>
        </div>

        {/* ── Encart gratuit ── */}
        <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🗳️</span>
            <p className="font-black text-green-800 text-sm">Gratuit — pour toujours</p>
          </div>
          <p className="text-sm text-green-700 leading-relaxed mb-2.5">
            Votez librement sur toutes les lois, consultez les résultats, suivez votre commune.
          </p>
          <ul className="space-y-1.5">
            {[
              'Voter sur toutes les lois et propositions citoyennes',
              'Consulter les résultats et la comparaison Assemblée / Citoyens',
              'Suivre votre commune et ses actualités',
            ].map(f => (
              <li key={f} className="flex items-start gap-2 text-xs text-green-700">
                <CheckCircle size={12} className="text-green-500 flex-shrink-0 mt-0.5" />{f}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Commune & Collectivité ── */}
        <div className={`rounded-2xl border-2 overflow-hidden transition-all border-teal-300 ${selected === 'commune' ? 'shadow-lg' : ''}`}>
          <button
            className="w-full bg-teal-700 p-4 text-white flex items-center justify-between"
            onClick={() => setExpanded(expanded === 'commune' ? null : 'commune')}
          >
            <div className="flex items-center gap-3">
              <Landmark size={20} />
              <span className="font-black text-lg">Commune &amp; Collectivité</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xl font-black">49€–499€</span>
                <span className="text-xs opacity-75 ml-0.5">/mois</span>
              </div>
              <ChevronRight size={16} className={`transition-transform ${expanded === 'commune' ? 'rotate-90' : ''}`} />
            </div>
          </button>
          {expanded === 'commune' && (
            <div className="p-4 bg-white">
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Tranche d'habitants
                </label>
                <div className="space-y-2">
                  {COMMUNE_TIERS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setCommuneSize(t.value)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${communeSize === t.value
                        ? 'border-teal-500 bg-teal-50 text-teal-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                    >
                      <span>{t.label}</span>
                      <span className={`font-black ${communeSize === t.value ? 'text-teal-700' : 'text-slate-400'}`}>{t.price}/mois</span>
                    </button>
                  ))}
                </div>
              </div>
              <ul className="space-y-2 mb-4">
                {['Accès API données', 'Tableau de bord pour les élus', 'Consultation citoyenne intégrée', "Rapport d'engagement mensuel", 'Support prioritaire'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => selected === 'commune' ? void handleCheckout(COMMUNE_PLAN_MAP[communeSize]) : setSelected('commune')}
                disabled={loadingCheckout === 'commune'}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 ${selected === 'commune' ? 'bg-slate-800 text-white' : 'bg-teal-700 text-white'}`}
              >
                {loadingCheckout === 'commune' ? 'Redirection…' : selected === 'commune' ? '✓ Sélectionné — Passer au paiement →' : 'Équiper ma commune'}
              </button>
            </div>
          )}
        </div>

        {/* ── Association ── */}
        <div className={`rounded-2xl border-2 overflow-hidden transition-all border-emerald-300 ${selected === 'assoc' ? 'shadow-lg' : ''}`}>
          <button
            className="w-full bg-emerald-700 p-4 text-white flex items-center justify-between"
            onClick={() => setExpanded(expanded === 'assoc' ? null : 'assoc')}
          >
            <div className="flex items-center gap-3">
              <Users size={20} />
              <span className="font-black text-lg">Association</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xl font-black">9€–49€</span>
                <span className="text-xs opacity-75 ml-0.5">/mois</span>
              </div>
              <ChevronRight size={16} className={`transition-transform ${expanded === 'assoc' ? 'rotate-90' : ''}`} />
            </div>
          </button>
          {expanded === 'assoc' && (
            <div className="p-4 bg-white">
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Taille de l'association
                </label>
                <div className="space-y-2">
                  {ASSOC_TIERS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setAssocSize(t.value)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${assocSize === t.value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                    >
                      <span>{t.label}</span>
                      <span className={`font-black ${assocSize === t.value ? 'text-emerald-700' : 'text-slate-400'}`}>{t.price}/mois</span>
                    </button>
                  ))}
                </div>
              </div>
              <ul className="space-y-2 mb-4">
                {['Page association publique', 'Propositions co-sponsorisées', 'Tableau de bord membres', "Rapport d'impact mensuel", 'Support prioritaire'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => selected === 'assoc' ? void handleCheckout(ASSOC_PLAN_MAP[assocSize]) : setSelected('assoc')}
                disabled={loadingCheckout === 'assoc'}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 ${selected === 'assoc' ? 'bg-slate-800 text-white' : 'bg-emerald-700 text-white'}`}
              >
                {loadingCheckout === 'assoc' ? 'Redirection…' : selected === 'assoc' ? '✓ Sélectionné — Passer au paiement →' : 'Rejoindre en association'}
              </button>
            </div>
          )}
        </div>

        {/* ── ONG / Fondation ── */}
        <div className={`rounded-2xl border-2 overflow-hidden transition-all border-amber-300 ${selected === 'ong' ? 'shadow-lg' : ''}`}>
          <div className="bg-amber-600 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe size={20} />
              <span className="font-black text-lg">ONG / Fondation</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black">49€</span>
              <span className="text-xs opacity-75 ml-0.5">/mois</span>
            </div>
          </div>
          <div className="p-4 bg-white">
            <ul className="space-y-2 mb-4">
              {["Tout l'offre Association L", 'Page organisation dédiée', '10 comptes membres', 'Propositions co-sponsorisées', "Rapport d'impact trimestriel"].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle size={14} className="text-green-500 flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => selected === 'ong' ? void handleCheckout('ong') : setSelected('ong')}
              disabled={loadingCheckout === 'ong'}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 ${selected === 'ong' ? 'bg-slate-800 text-white' : 'bg-amber-600 text-white'}`}
            >
              {loadingCheckout === 'ong' ? 'Redirection…' : selected === 'ong' ? '✓ Sélectionné — Passer au paiement →' : 'Rejoindre en ONG'}
            </button>
          </div>
        </div>

        {/* ── Média ── */}
        <div className={`rounded-2xl border-2 overflow-hidden transition-all border-slate-300 ${selected === 'media' ? 'shadow-lg' : ''}`}>
          <div className="bg-slate-600 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Newspaper size={20} />
              <span className="font-black text-lg">Média</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black">29€</span>
              <span className="text-xs opacity-75 ml-0.5">/mois</span>
            </div>
          </div>
          <div className="p-4 bg-white">
            <ul className="space-y-2 mb-4">
              {['API accès données', 'Tableau de bord analytics', 'Export CSV / JSON', 'Badge média partenaire', 'Support prioritaire'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle size={14} className="text-green-500 flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => selected === 'media' ? void handleCheckout('media') : setSelected('media')}
              disabled={loadingCheckout === 'media'}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 ${selected === 'media' ? 'bg-slate-800 text-white' : 'bg-slate-600 text-white'}`}
            >
              {loadingCheckout === 'media' ? 'Redirection…' : selected === 'media' ? '✓ Sélectionné — Passer au paiement →' : 'Accès média'}
            </button>
          </div>
        </div>

      </div>

      <p className="text-center text-xs text-slate-400 mt-4 pb-2">
        Paiement sécurisé par Stripe · Sans engagement · Annulation en 1 clic
      </p>
    </div>
  )
}
