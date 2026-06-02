import React from 'react'

interface LandingPageProps {
    onEnter: () => void
}

export default function LandingPage({ onEnter }: LandingPageProps) {
    return (
        <div className="bg-slate-50 text-slate-800 antialiased" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <style>{`
        .animate-pulse-dot { animation: pulse-dot 2s infinite; }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .step-line {
          position: relative;
        }
        .step-line::before {
          content: '';
          position: absolute;
          left: 19px;
          top: 56px;
          bottom: -16px;
          width: 2px;
          background: linear-gradient(to bottom, #e2e8f0, transparent);
          z-index: 0;
        }
      `}</style>

            {/* NAV */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
                <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
                    <span className="text-lg font-black text-slate-900 tracking-tight">CHOISISSONS</span>
                    <button
                        onClick={onEnter}
                        className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                        Accéder à l'app →
                    </button>
                </div>
            </nav>

            {/* HERO */}
            <section className="min-h-screen flex flex-col items-center justify-center text-center px-5 pt-20 pb-16">
                <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-8">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse-dot"></span>
                    Bêta ouverte — Version 2026
                </div>

                <h1 className="text-4xl sm:text-6xl font-black text-slate-900 leading-tight tracking-tight max-w-3xl mb-6">
                    La démocratie,<br />
                    <span className="text-indigo-600">directement</span> entre vos mains
                </h1>

                <p className="text-lg text-slate-500 max-w-xl mb-10 font-light leading-relaxed">
                    Votez les vraies lois du Parlement. Proposez vos idées. Soutenez celles des autres.<br />
                    Sans partis. Sans lobbys. Sans publicité.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 mb-14">
                    <button
                        onClick={onEnter}
                        className="bg-indigo-600 text-white font-semibold px-8 py-3.5 rounded-2xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200"
                    >
                        Je rejoins le mouvement
                    </button>
                    <a
                        href="#comment"
                        className="border border-slate-200 text-slate-700 font-semibold px-8 py-3.5 rounded-2xl hover:bg-slate-100 transition-colors"
                    >
                        Comment ça marche ?
                    </a>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl">
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                        <div className="text-2xl font-black text-indigo-600">100%</div>
                        <div className="text-xs text-slate-400 mt-0.5">Vote anonyme</div>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                        <div className="text-2xl font-black text-slate-900">0€</div>
                        <div className="text-xs text-slate-400 mt-0.5">Gratuit citoyen</div>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                        <div className="text-2xl font-black text-slate-900">0</div>
                        <div className="text-xs text-slate-400 mt-0.5">Parti politique</div>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                        <div className="text-2xl font-black text-slate-900">0</div>
                        <div className="text-xs text-slate-400 mt-0.5">Publicité</div>
                    </div>
                </div>
            </section>

            {/* VOTE SUR LES VRAIES LOIS — section forte */}
            <section className="bg-[#002395] py-20">
                <div className="max-w-5xl mx-auto px-5">
                    <div className="flex flex-col lg:flex-row gap-12 items-center">
                        <div className="flex-1">
                            <p className="text-xs font-semibold tracking-widest text-blue-300 uppercase mb-3">Nouveauté</p>
                            <h2 className="text-3xl font-black text-white mb-5 tracking-tight leading-tight">
                                Votez les vraies lois<br />de l'Assemblée Nationale
                            </h2>
                            <p className="text-blue-200 font-light leading-relaxed mb-8">
                                Chaque nuit, CHOISISSONS synchronise automatiquement les projets de lois en cours au Parlement.
                                Lisez le texte officiel, formez votre opinion, et exprimez votre voix — en parallèle du vote des députés.
                            </p>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <p className="text-blue-100 text-sm">Lois en cours : budget, IA, retraites, éducation…</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <p className="text-blue-100 text-sm">Lien direct vers le texte officiel de l'AN</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <p className="text-blue-100 text-sm">Résultats agrégés publics et accessibles à tous</p>
                                </div>
                            </div>
                        </div>

                        {/* Carte mockup loi */}
                        <div className="flex-1 max-w-sm w-full">
                            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                                <div className="p-4 border-b border-slate-100">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-xs font-bold text-white bg-[#002395] rounded-full px-2.5 py-0.5">Assemblée Nationale</span>
                                        <span className="text-xs text-slate-400">PLF 2026</span>
                                    </div>
                                    <h3 className="font-black text-slate-800 text-sm mb-1">Projet de loi de finances 2026</h3>
                                    <p className="text-xs text-slate-500 leading-relaxed">Budget de l'État pour 2026. Recettes fiscales, dépenses publiques et réforme de la TVA. Enveloppe : 492 milliards €.</p>
                                </div>
                                <div className="p-4">
                                    <p className="text-xs text-slate-400 mb-3">Avis des citoyens</p>
                                    <div className="space-y-2">
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-semibold text-emerald-600">Pour</span>
                                                <span className="text-slate-400">42%</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '42%' }}></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-semibold text-red-500">Contre</span>
                                                <span className="text-slate-400">51%</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-red-400 rounded-full" style={{ width: '51%' }}></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-semibold text-slate-400">Blanc</span>
                                                <span className="text-slate-400">7%</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-slate-300 rounded-full" style={{ width: '7%' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={onEnter} className="w-full mt-4 py-2.5 bg-[#002395] text-white text-sm font-semibold rounded-xl">
                                        Lire &amp; Voter
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* PROBLÈME */}
            <section className="max-w-5xl mx-auto px-5 py-20">
                <p className="text-xs font-semibold tracking-widest text-indigo-500 uppercase mb-3">Le constat</p>
                <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Le système actuel n'est plus à la hauteur</h2>
                <p className="text-slate-500 mb-12 max-w-lg">Entre les élections, la voix du citoyen disparaît. CHOISISSONS change ça.</p>
                <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-xl mb-4">🗳️</div>
                        <h3 className="font-bold text-slate-800 mb-2">Un vote tous les 5 ans</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">La démocratie se réduit à une case cochée tous les cinq ans. Entre-temps, les décisions se prennent sans vous.</p>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-xl mb-4">🏛️</div>
                        <h3 className="font-bold text-slate-800 mb-2">Les lobbys décident</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">Les groupes d'intérêt ont un accès permanent aux élus. Le citoyen ordinaire, lui, attend la prochaine élection.</p>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-xl mb-4">📺</div>
                        <h3 className="font-bold text-slate-800 mb-2">L'information manipulée</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">Les algorithmes polarisent l'opinion. Ici, aucun contenu n'est boosté par un annonceur.</p>
                    </div>
                </div>
            </section>

            {/* COMMENT ÇA MARCHE */}
            <section id="comment" className="max-w-5xl mx-auto px-5 py-20">
                <p className="text-xs font-semibold tracking-widest text-indigo-500 uppercase mb-3">Le fonctionnement</p>
                <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Du brouillon au vote national</h2>
                <p className="text-slate-500 mb-12 max-w-lg">Votre idée suit un parcours en 4 étapes, conçu pour garantir la neutralité et éviter toute manipulation.</p>

                <div className="space-y-4">
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex gap-5 items-start step-line">
                        <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 relative z-10">01</div>
                        <div className="flex-1">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-1">Proposez</h3>
                                    <p className="text-sm text-slate-500">Rédigez votre idée de loi. Elle entre en Pépinière — visible uniquement par votre réseau et via recherche directe. Pas encore publique.</p>
                                </div>
                                <span className="bg-slate-100 text-slate-500 text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0">🌱 Pépinière</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex gap-5 items-start step-line">
                        <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 relative z-10">02</div>
                        <div className="flex-1">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-1">Récoltez 10 soutiens</h3>
                                    <p className="text-sm text-slate-500">Avec 10 soutiens de citoyens vérifiés, la proposition passe automatiquement devant le jury. Elle n'est toujours pas ouverte au vote général.</p>
                                </div>
                                <span className="bg-emerald-50 text-emerald-600 text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0">⭐ 10 soutiens</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex gap-5 items-start step-line">
                        <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 relative z-10">03</div>
                        <div className="flex-1">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-1">Le jury citoyen valide</h3>
                                    <p className="text-sm text-slate-500">100 citoyens tirés au sort vérifient la neutralité, la légalité et la clarté du texte. Ils ne jugent pas le fond — seulement la forme. Si 51% valident, la proposition devient publique et votable.</p>
                                </div>
                                <span className="bg-amber-50 text-amber-600 text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0">👥 Jury</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex gap-5 items-start">
                        <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0">04</div>
                        <div className="flex-1">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-1">Vote national</h3>
                                    <p className="text-sm text-slate-500">La proposition est ouverte à tous les Français pendant 7 à 30 jours. Le résultat est public, transparent, et appartient à tous.</p>
                                </div>
                                <span className="bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0">🗳️ Vote</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ENGAGEMENTS */}
            <section className="bg-slate-900 py-20">
                <div className="max-w-5xl mx-auto px-5">
                    <p className="text-xs font-semibold tracking-widest text-indigo-400 uppercase mb-3">Nos engagements</p>
                    <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Construit sur des principes non négociables</h2>
                    <p className="text-slate-400 mb-12 max-w-lg font-light">Chaque ligne de code reflète une conviction démocratique.</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

                        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                            <div className="text-2xl mb-3">🔒</div>
                            <h3 className="font-bold text-white text-sm mb-2">Anonymat réel</h3>
                            <p className="text-slate-400 text-xs leading-relaxed">Votre vote est chiffré en SHA-256 avant envoi. Personne — même nous — ne sait comment vous avez voté.</p>
                        </div>

                        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                            <div className="text-2xl mb-3">📂</div>
                            <h3 className="font-bold text-white text-sm mb-2">Données ouvertes</h3>
                            <p className="text-slate-400 text-xs leading-relaxed">Les résultats des votes agrégés appartiennent aux citoyens. Librement accessibles à tous — journalistes, chercheurs, associations.</p>
                        </div>

                        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                            <div className="text-2xl mb-3">👁️</div>
                            <h3 className="font-bold text-white text-sm mb-2">Code auditable</h3>
                            <p className="text-slate-400 text-xs leading-relaxed">Le code source est public sur GitHub. N'importe qui peut vérifier qu'il n'y a aucune manipulation cachée dans le système de vote.</p>
                            <a href="https://github.com/benjamincolleu-cloud/choisissons" target="_blank" rel="noreferrer"
                                className="inline-block mt-2 text-xs text-indigo-400 underline">
                                Voir sur GitHub →
                            </a>
                        </div>

                        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                            <div className="text-2xl mb-3">🚫</div>
                            <h3 className="font-bold text-white text-sm mb-2">Zéro publicité</h3>
                            <p className="text-slate-400 text-xs leading-relaxed">Aucun annonceur ne finance la plateforme. Le modèle repose uniquement sur l'abonnement volontaire des soutiens.</p>
                        </div>

                        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                            <div className="text-2xl mb-3">⚖️</div>
                            <h3 className="font-bold text-white text-sm mb-2">Neutralité politique</h3>
                            <p className="text-slate-400 text-xs leading-relaxed">Aucun parti ni lobby ne peut monopoliser la plateforme. Le jury citoyen tiré au sort y veille à chaque étape.</p>
                        </div>

                        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                            <div className="text-2xl mb-3">🇫🇷</div>
                            <h3 className="font-bold text-white text-sm mb-2">Hébergé en France</h3>
                            <p className="text-slate-400 text-xs leading-relaxed">Serveur Supabase Paris. Vos données ne quittent pas le territoire français et sont soumises au droit européen (RGPD).</p>
                        </div>

                    </div>
                </div>
            </section>

            {/* TÉMOIGNAGES */}
            <section className="max-w-5xl mx-auto px-5 py-20">
                <p className="text-xs font-semibold tracking-widest text-indigo-500 uppercase mb-3">Ils ont essayé</p>
                <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Ce que disent les premiers citoyens</h2>
                <p className="text-slate-500 mb-12 max-w-lg">Les testeurs de la version bêta partagent leur expérience.</p>
                <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                        <p className="text-sm text-slate-600 leading-relaxed italic mb-5">"Pour la première fois, j'ai l'impression que mon opinion compte entre deux élections. Simple, clair, et je vois exactement comment mon vote est protégé."</p>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center">ML</div>
                            <div>
                                <div className="text-sm font-semibold text-slate-800">Marie-Laure</div>
                                <div className="text-xs text-slate-400">Lyon, institutrice</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                        <p className="text-sm text-slate-600 leading-relaxed italic mb-5">"J'étais sceptique. Mais le jury citoyen m'a convaincu — c'est le seul mécanisme qui empêche les militants organisés de tout noyauter."</p>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center">JP</div>
                            <div>
                                <div className="text-sm font-semibold text-slate-800">Jean-Pierre</div>
                                <div className="text-xs text-slate-400">Bordeaux, retraité</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                        <p className="text-sm text-slate-600 leading-relaxed italic mb-5">"Ce que j'aime : les données des votes sont publiques. Je peux les réutiliser pour mes articles. C'est ça, la vraie transparence."</p>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center">RC</div>
                            <div>
                                <div className="text-sm font-semibold text-slate-800">Romain C.</div>
                                <div className="text-xs text-slate-400">Paris, journaliste</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA FINAL */}
            <section className="max-w-5xl mx-auto px-5 pb-24">
                <div className="bg-indigo-600 rounded-3xl p-12 text-center shadow-xl shadow-indigo-200">
                    <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Rejoignez le mouvement dès aujourd'hui</h2>
                    <p className="text-indigo-200 mb-8 text-lg font-light">Gratuit, anonyme, sans publicité. Juste votre voix, amplifiée.</p>
                    <button
                        onClick={onEnter}
                        className="inline-block bg-white text-indigo-600 font-black px-10 py-4 rounded-2xl hover:bg-indigo-50 transition-all active:scale-95 text-lg shadow-lg"
                    >
                        Accéder à CHOISISSONS →
                    </button>
                    <p className="text-indigo-300 mt-5 text-sm">Aucune inscription requise pour consulter les propositions et les résultats.</p>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="border-t border-slate-100 py-8 px-5 text-center text-xs text-slate-400">
                <p>© 2026 CHOISISSONS — SIRET 445 241 649 00059 &nbsp;·&nbsp;
                    <a href="https://choisissons.fr/mentions-legales" className="underline hover:text-slate-600">Mentions légales</a> &nbsp;·&nbsp;
                    <a href="https://github.com/benjamincolleu-cloud/choisissons" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">GitHub</a> &nbsp;·&nbsp;
                    <a href="mailto:contact@choisissons.fr" className="underline hover:text-slate-600">contact@choisissons.fr</a>
                </p>
            </footer>
        </div>
    )
}