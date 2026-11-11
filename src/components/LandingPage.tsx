
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
                        Découvrir les lois en débat
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
                        <div className="text-2xl font-black text-indigo-600">1</div>
                        <div className="text-xs text-slate-400 mt-0.5">Vote par compte</div>
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
                                Lisez une fiche neutre et le texte officiel, formez votre opinion, votez — puis comparez avec le vote des députés.
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
                                    <p className="text-blue-100 text-sm">Le vote des députés s'affiche après le vôtre, pour ne pas vous influencer</p>
                                </div>
                            </div>
                        </div>

                        {/* Carte d'exemple : montre le fonctionnement réel, sans aucun chiffre inventé */}
                        <div className="flex-1 max-w-sm w-full">
                            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                                <div className="p-4 border-b border-slate-100">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-xs font-bold text-white bg-[#002395] rounded-full px-2.5 py-0.5">Assemblée nationale</span>
                                        <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">Exemple</span>
                                    </div>
                                    <h3 className="font-black text-slate-800 text-sm mb-1">Une loi en débat au Parlement</h3>
                                    <p className="text-xs text-slate-500 leading-relaxed">Les principales lois ont leur fiche, rédigée avec l'aide d'une IA et relue avant publication.</p>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="flex items-start gap-2.5">
                                        <span className="text-base leading-none">📄</span>
                                        <p className="text-xs text-slate-600"><span className="font-semibold text-slate-800">En clair</span> — le texte expliqué en deux phrases</p>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <span className="text-base leading-none">⚖️</span>
                                        <p className="text-xs text-slate-600"><span className="font-semibold text-slate-800">Pour et contre</span> — autant d'arguments de chaque côté, avec leurs sources</p>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <span className="text-base leading-none">🗳️</span>
                                        <p className="text-xs text-slate-600"><span className="font-semibold text-slate-800">Votre vote</span> — pour, contre ou blanc</p>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <span className="text-base leading-none">🏛️</span>
                                        <p className="text-xs text-slate-600"><span className="font-semibold text-slate-800">Les députés</span> — leur vote s'affiche après le vôtre</p>
                                    </div>
                                    <button onClick={onEnter} className="w-full mt-1 py-2.5 bg-[#002395] text-white text-sm font-semibold rounded-xl">
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
                <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Lire, voter, comparer</h2>
                <p className="text-slate-500 mb-12 max-w-lg">CHOISISSONS est en version bêta. Voici exactement ce qui se passe aujourd'hui.</p>

                <div className="space-y-4">
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex gap-5 items-start step-line">
                        <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 relative z-10">01</div>
                        <div className="flex-1">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-1">Lisez</h3>
                                    <p className="text-sm text-slate-500">Les principales lois en débat ont une fiche neutre : ce que le texte change, ce qui fait débat, et autant d'arguments pour que contre, chacun avec sa source.</p>
                                </div>
                                <span className="bg-slate-100 text-slate-500 text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0">📄 Fiche</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex gap-5 items-start step-line">
                        <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 relative z-10">02</div>
                        <div className="flex-1">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-1">Votez</h3>
                                    <p className="text-sm text-slate-500">Pour, contre ou blanc. Un compte = un vote, et le vote est définitif. Il reste ouvert tant que la loi est en débat au Parlement.</p>
                                </div>
                                <span className="bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0">🗳️ Vote</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex gap-5 items-start step-line">
                        <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 relative z-10">03</div>
                        <div className="flex-1">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-1">Comparez</h3>
                                    <p className="text-sm text-slate-500">Après votre vote, vous découvrez le résultat des votants de CHOISISSONS et, dès qu'il est connu, celui des députés.</p>
                                </div>
                                <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0">🏛️ Députés</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex gap-5 items-start">
                        <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0">04</div>
                        <div className="flex-1">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-1">Proposez</h3>
                                    <p className="text-sm text-slate-500">Vous pouvez aussi soumettre une proposition. Une IA écarte d'abord les contenus haineux, violents ou publicitaires, puis l'équipe la vérifie avant de l'ouvrir au vote.</p>
                                </div>
                                <span className="bg-emerald-50 text-emerald-600 text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0">🌱 Proposition</span>
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
                            <h3 className="font-bold text-white text-sm mb-2">Vote secret</h3>
                            <p className="text-slate-400 text-xs leading-relaxed">Votre choix n'est pas enregistré avec votre compte. La base retient seulement que vous avez voté, pour empêcher le double vote ; votre bulletin est rangé à part, sans lien avec vous.</p>
                        </div>

                        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                            <div className="text-2xl mb-3">📂</div>
                            <h3 className="font-bold text-white text-sm mb-2">Résultats publics</h3>
                            <p className="text-slate-400 text-xs leading-relaxed">Les résultats d'ensemble sont visibles par tous à la fin de chaque vote. Aucun vote individuel n'est jamais publié.</p>
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
                            <p className="text-slate-400 text-xs leading-relaxed">Aucun parti ni lobby ne finance la plateforme. Chaque fiche présente autant d'arguments pour que contre, et chacun peut signaler un manque de neutralité.</p>
                        </div>

                        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                            <div className="text-2xl mb-3">🇫🇷</div>
                            <h3 className="font-bold text-white text-sm mb-2">Données à Paris</h3>
                            <p className="text-slate-400 text-xs leading-relaxed">La base de données est hébergée à Paris et soumise au droit européen (RGPD).</p>
                        </div>

                    </div>
                </div>
            </section>

            {/* TRANSPARENCE : ce que valent nos chiffres */}
            <section className="max-w-5xl mx-auto px-5 py-20">
                <p className="text-xs font-semibold tracking-widest text-indigo-500 uppercase mb-3">Transparence</p>
                <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Ce que valent nos chiffres</h2>
                <p className="text-slate-500 mb-12 max-w-lg">Nous préférons vous dire nous-mêmes ce que nos résultats garantissent, et ce qu'ils ne garantissent pas.</p>
                <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                        <div className="text-xl mb-3">✅</div>
                        <h3 className="font-bold text-slate-800 mb-2">Un compte = un vote</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">Le double vote est bloqué par la base de données elle-même, et un vote ne peut pas être modifié après coup.</p>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                        <div className="text-xl mb-3">📧</div>
                        <h3 className="font-bold text-slate-800 mb-2">Pas encore de vérification d'identité</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">L'inscription se fait avec un email confirmé. Nos résultats sont un baromètre des votants de CHOISISSONS : ce n'est ni un sondage représentatif, ni un référendum.</p>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                        <div className="text-xl mb-3">🧪</div>
                        <h3 className="font-bold text-slate-800 mb-2">Un projet en construction</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">CHOISISSONS est un projet citoyen indépendant, en version bêta. Une vérification d'identité et un jury de citoyens tirés au sort sont à l'étude, pour quand la communauté sera assez grande.</p>
                    </div>
                </div>
            </section>

            {/* CTA FINAL */}
            <section className="max-w-5xl mx-auto px-5 pb-24">
                <div className="bg-indigo-600 rounded-3xl p-12 text-center shadow-xl shadow-indigo-200">
                    <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Votre avis compte aussi entre deux élections</h2>
                    <p className="text-indigo-200 mb-8 text-lg font-light">Gratuit, sans parti, sans publicité. Vote secret.</p>
                    <button
                        onClick={onEnter}
                        className="inline-block bg-white text-indigo-600 font-black px-10 py-4 rounded-2xl hover:bg-indigo-50 transition-all active:scale-95 text-lg shadow-lg"
                    >
                        Accéder à CHOISISSONS →
                    </button>
                    <p className="text-indigo-300 mt-5 text-sm">Un compte gratuit (email confirmé) est nécessaire pour voter.</p>
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