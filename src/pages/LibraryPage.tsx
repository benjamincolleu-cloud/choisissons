import { useState, useEffect, useMemo, useCallback } from 'react'
import { X, BookOpen, FileText, ChevronRight, ArrowLeft, Scroll, Scale } from 'lucide-react'
import { supabase, supabaseUrl, supabaseAnonKey } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { showToast } from '../lib/toast'
import { generateVoteProof } from '../lib/identity'
import { loadPendingVotes, savePendingVotes } from '../lib/votes'
import { mapRowToProposal } from '../lib/utils'
import type { LibraryEntry, TexteFondateur, Proposal, VoteChoice, ProposalRow } from '../types'
import AgoraModal from '../components/modals/AgoraModal'
import VotingBooth from '../components/modals/VotingBooth'
import ResultsModal from '../components/modals/ResultsModal'

// ── Types locaux ───────────────────────────────────────────────
type SortKey = 'recent' | 'votes' | 'alpha'
type LibTab = 'archives' | 'fondateurs'
type FondateursView = 'documents' | 'articles' | 'article'

const CATEGORIES = ['Toutes', 'Économie', 'Social', 'Numérique', 'Institutions', 'Sécurité', 'Défense', 'Environnement', 'Justice']

// Convertit un article constitutionnel + ses propositions (ProposalRow) en Proposal pour les modals
function toProposal(row: ProposalRow): Proposal {
  return mapRowToProposal(row)
}

export default function LibraryPage({ onNavigateSupport }: { onNavigateSupport?: () => void }) {
  const { userHash } = useAuth()

  // ── Onglet principal ────────────────────────────────────────
  const [libTab, setLibTab] = useState<LibTab>('archives')

  // ── État archives (inchangé) ────────────────────────────────
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Toutes')
  const [statusFilter, setStatusFilter] = useState<'all' | 'adopted' | 'rejected' | 'closed'>('all')
  const [sortBy, setSortBy] = useState<SortKey>('recent')

  // ── État textes fondateurs ──────────────────────────────────
  const [articles, setArticles] = useState<TexteFondateur[]>([])
  const [fondateursLoading, setFondateursLoading] = useState(false)
  const [propCounts, setPropCounts] = useState<Record<string, number>>({})
  const [fondateursView, setFondateursView] = useState<FondateursView>('documents')
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<TexteFondateur | null>(null)
  const [articleProposals, setArticleProposals] = useState<ProposalRow[]>([])
  const [articlePropsLoading, setArticlePropsLoading] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)

  // Formulaire de proposition constitutionnelle
  const [showForm, setShowForm] = useState(false)
  const [formText, setFormText] = useState('')
  const [formMotivation, setFormMotivation] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Modals de vote sur propositions constitutionnelles
  const [agoraProposal, setAgoraProposal] = useState<Proposal | null>(null)
  const [votingProposal, setVotingProposal] = useState<Proposal | null>(null)
  const [agoraOriginalText, setAgoraOriginalText] = useState<string>('')
  const [resultsId, setResultsId] = useState<string | null>(null)
  const [votedIds] = useState<Set<string>>(new Set())

  // ── Chargement archives ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [proposalsRes, lawsRes] = await Promise.all([
          supabase
            .from('proposals')
            .select('id, title, description, category, status, votes_pour, votes_contre, votes_blanc, created_at')
            .in('status', ['adopted', 'rejected', 'closed', 'archived'])
            .order('created_at', { ascending: false })
            .limit(200),
          supabase
            .from('parliamentary_laws')
            .select('id, title, description, category, stage, votes_pour, votes_contre, votes_blanc, synced_at')
            .in('stage', ['adopted', 'rejected', 'closed', 'archived'])
            .limit(200),
        ])
        if (cancelled) return

        const citizen: LibraryEntry[] = (proposalsRes.data ?? []).map(p => ({
          id: String(p.id),
          title: (p.title as string) ?? '',
          description: (p.description as string) ?? '',
          category: (p.category as string) ?? '',
          status: p.status as string,
          type: 'citizen' as const,
          votes_pour: (p.votes_pour as number) ?? 0,
          votes_contre: (p.votes_contre as number) ?? 0,
          votes_blanc: (p.votes_blanc as number) ?? 0,
          date: (p.created_at as string) ?? '',
        }))

        const laws: LibraryEntry[] = (lawsRes.data ?? []).map(l => ({
          id: String(l.id),
          title: (l.title as string) ?? '',
          description: (l.description as string) ?? '',
          category: (l.category as string) ?? '',
          status: l.stage as string,
          type: 'law' as const,
          votes_pour: (l.votes_pour as number) ?? 0,
          votes_contre: (l.votes_contre as number) ?? 0,
          votes_blanc: (l.votes_blanc as number) ?? 0,
          date: (l.synced_at as string) ?? '',
        }))

        setEntries([...citizen, ...laws].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
      } catch { /* empty state */ } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // ── Chargement textes fondateurs ────────────────────────────
  useEffect(() => {
    if (libTab !== 'fondateurs' || articles.length > 0) return
    let cancelled = false
    setFondateursLoading(true)
    async function loadFondateurs() {
      try {
        const [articlesRes, propsRes] = await Promise.all([
          supabase
            .from('textes_fondateurs')
            .select('id, document, section, article_number, original_text, source_url')
            .order('article_number'),
          supabase
            .from('proposals')
            .select('target_article_id')
            .eq('proposal_type', 'constitutional')
            .not('target_article_id', 'is', null),
        ])
        if (cancelled) return

        const arts = (articlesRes.data ?? []) as TexteFondateur[]
        setArticles(arts)

        // Construit une map article_id → document pour compter les propositions par document
        const idToDoc: Record<number, string> = {}
        for (const a of arts) idToDoc[a.id] = a.document

        const counts: Record<string, number> = {}
        for (const row of (propsRes.data ?? []) as { target_article_id: number }[]) {
          const doc = idToDoc[row.target_article_id]
          if (doc) counts[doc] = (counts[doc] ?? 0) + 1
        }
        setPropCounts(counts)
      } catch {
        showToast('Impossible de charger les textes fondateurs.')
      } finally {
        if (!cancelled) setFondateursLoading(false)
      }
    }
    loadFondateurs()
    return () => { cancelled = true }
  }, [libTab, articles.length])

  // ── Chargement propositions d'un article ────────────────────
  useEffect(() => {
    if (!selectedArticle) { setArticleProposals([]); return }
    let cancelled = false
    setArticlePropsLoading(true)
    supabase
      .from('proposals')
      .select('id, title, description, category, status, supports, votes_pour, votes_contre, votes_blanc, tags, created_at, blockchain_proof')
      .eq('target_article_id', selectedArticle.id)
      .eq('proposal_type', 'constitutional')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setArticleProposals((data ?? []) as ProposalRow[])
      })
      .then(() => { if (!cancelled) setArticlePropsLoading(false) }, () => { if (!cancelled) setArticlePropsLoading(false) })

    // Vérifie si l'utilisateur est abonné
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return
      const { data } = await supabase
        .from('profiles')
        .select('subscription_status, subscription_plan')
        .eq('id', user.id)
        .single()
      if (!cancelled && data) {
        setIsSubscribed(
          data.subscription_status === 'active' &&
          String(data.subscription_plan ?? '').includes('citoyen')
        )
      }
    })
    return () => { cancelled = true }
  }, [selectedArticle])

  // ── Vote sur une proposition constitutionnelle ───────────────
  const handleConstitutionalVoted = useCallback(async (proposalId: string, choice: VoteChoice) => {
    setVotingProposal(null)
    setAgoraProposal(null)

    const choiceMap: Record<VoteChoice, string> = { pour: 'YES', contre: 'NO', blanc: 'ABSTAIN' }
    const mappedChoice = choiceMap[choice]

    setArticleProposals(prev =>
      prev.map(p => {
        if (p.id !== proposalId) return p
        return { ...p, [`votes_${choice}`]: (p[`votes_${choice}` as keyof ProposalRow] as number ?? 0) + 1 }
      })
    )

    const proof = await generateVoteProof(proposalId, mappedChoice)
    try {
      const { error } = await supabase.rpc('deposer_bulletin', {
        p_proposal_id: proposalId,
        p_user_hash: userHash,
        p_choice: mappedChoice,
        p_proof_hash: proof,
      })
      if (error) throw error
      setResultsId(proposalId)
    } catch {
      const pending = loadPendingVotes()
      if (!pending.some(v => v.proposalId === proposalId)) {
        savePendingVotes([...pending, { proposalId, userHash, choice: mappedChoice, timestamp: Date.now() }])
      }
      showToast('Vote sauvegardé — synchronisé à la prochaine connexion.', 'warning')
    }
  }, [userHash])

  // ── Soumission formulaire de proposition ─────────────────────
  async function handleSubmitProposal() {
    if (!selectedArticle || formText.trim().length < 100 || formMotivation.trim().length < 50) return
    setFormSubmitting(true)
    setFormError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      const res = await fetch(`${supabaseUrl}/functions/v1/moderate-proposal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          title: `Modification — ${selectedArticle.document}, Art. ${selectedArticle.article_number}`,
          description: formText.trim(),
          author_hash: userHash,
          proposal_type: 'constitutional',
          target_article_id: selectedArticle.id,
          category: 'Institutions',
        }),
      })

      const json = await res.json() as { status?: string; message?: string; reason?: string }

      if (json.status === 'submitted') {
        showToast(json.message ?? 'Proposition soumise — elle sera examinée par le jury.', 'info')
        setShowForm(false)
        setFormText('')
        setFormMotivation('')
        // Rafraîchit la liste
        const { data } = await supabase
          .from('proposals')
          .select('id, title, description, category, status, supports, votes_pour, votes_contre, votes_blanc, tags, created_at, blockchain_proof')
          .eq('target_article_id', selectedArticle.id)
          .eq('proposal_type', 'constitutional')
          .order('created_at', { ascending: false })
        setArticleProposals((data ?? []) as ProposalRow[])
      } else if (json.status === 'rejected') {
        setFormError(json.reason ?? 'Proposition refusée par la modération.')
      } else {
        setFormError("Une erreur est survenue lors de l'envoi. Réessayez.")
      }
    } catch {
      setFormError('Erreur de connexion, réessayez.')
    } finally {
      setFormSubmitting(false)
    }
  }

  // ── Navigation fondateurs ───────────────────────────────────
  function openDoc(docName: string) {
    setSelectedDoc(docName)
    setSelectedArticle(null)
    setFondateursView('articles')
    setShowForm(false)
  }

  function openArticle(article: TexteFondateur) {
    setSelectedArticle(article)
    setFondateursView('article')
    setShowForm(false)
    setFormText('')
    setFormMotivation('')
  }

  function backToDocuments() {
    setSelectedDoc(null)
    setSelectedArticle(null)
    setFondateursView('documents')
  }

  function backToArticles() {
    setSelectedArticle(null)
    setFondateursView('articles')
    setShowForm(false)
  }

  // ── Données dérivées ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = entries
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e => e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q))
    }
    if (activeCategory !== 'Toutes') result = result.filter(e => e.category === activeCategory)
    if (statusFilter !== 'all') result = result.filter(e => e.status === statusFilter || (statusFilter === 'closed' && e.status === 'archived'))
    if (sortBy === 'votes') return [...result].sort((a, b) => (b.votes_pour + b.votes_contre + b.votes_blanc) - (a.votes_pour + a.votes_contre + a.votes_blanc))
    if (sortBy === 'alpha') return [...result].sort((a, b) => a.title.localeCompare(b.title, 'fr'))
    return result
  }, [entries, search, activeCategory, statusFilter, sortBy])

  // Documents groupés par nom
  const docGroups = useMemo(() => {
    const groups: Record<string, TexteFondateur[]> = {}
    for (const art of articles) {
      if (!groups[art.document]) groups[art.document] = []
      groups[art.document].push(art)
    }
    return groups
  }, [articles])

  // Articles du document sélectionné, groupés par section
  const sectionGroups = useMemo(() => {
    if (!selectedDoc) return {} as Record<string, TexteFondateur[]>
    const groups: Record<string, TexteFondateur[]> = {}
    for (const art of articles.filter(a => a.document === selectedDoc)) {
      const key = art.section ?? '—'
      if (!groups[key]) groups[key] = []
      groups[key].push(art)
    }
    return groups
  }, [articles, selectedDoc])

  function downloadOpenData() {
    const payload = entries.map(e => ({
      proposal_id: e.id,
      title: e.title,
      type: e.type === 'law' ? 'loi_parlementaire' : 'proposition_citoyenne',
      votes_pour: e.votes_pour,
      votes_contre: e.votes_contre,
      votes_blanc: e.votes_blanc,
      closed_at: e.date,
    }))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'choisissons-donnees-publiques.json'
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  // ── Render helpers ───────────────────────────────────────────

  function statusLabel(status: string) {
    const map: Record<string, { label: string; cls: string }> = {
      seedling: { label: 'En attente de jury', cls: 'bg-slate-100 text-slate-500' },
      review: { label: 'En examen', cls: 'bg-amber-100 text-amber-700' },
      voting: { label: 'Vote ouvert', cls: 'bg-indigo-100 text-indigo-600' },
      adopted: { label: 'Adoptée', cls: 'bg-green-100 text-green-700' },
      rejected: { label: 'Rejetée', cls: 'bg-red-100 text-red-600' },
      closed: { label: 'Clôturée', cls: 'bg-slate-100 text-slate-500' },
    }
    return map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-500' }
  }

  // ── Rendu fondateurs ─────────────────────────────────────────

  function renderFondateurs() {
    if (fondateursLoading) {
      return (
        <div className="px-4 space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
              <div className="h-5 bg-slate-100 rounded w-3/4 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-full mb-1" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      )
    }

    // ── Vue : liste des documents ──────────────────────────────
    if (fondateursView === 'documents') {
      const docs = Object.entries(docGroups)
      return (
        <div className="px-4">
          <p className="text-sm text-slate-500 leading-relaxed mb-4">
            Proposez des révisions citoyennes aux textes qui fondent la République française.
            Chaque proposition est soumise au jury avant d'être mise au vote.
          </p>
          {docs.length === 0 ? (
            <div className="text-center py-14">
              <Scroll size={36} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400 text-sm">Textes fondateurs bientôt disponibles.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {docs.map(([docName, arts]) => (
                <button
                  key={docName}
                  onClick={() => openDoc(docName)}
                  className="text-left bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all active:scale-[.99] group"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <Scale size={22} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                    <ChevronRight size={16} className="text-slate-300 flex-shrink-0 mt-1 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <h3 className="font-black text-slate-800 text-base leading-snug mb-3">{docName}</h3>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-2xl font-black text-indigo-600">{arts.length}</p>
                      <p className="text-xs text-slate-400">articles</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-slate-600">{propCounts[docName] ?? 0}</p>
                      <p className="text-xs text-slate-400">proposition{(propCounts[docName] ?? 0) > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )
    }

    // ── Vue : articles d'un document ───────────────────────────
    if (fondateursView === 'articles' && selectedDoc) {
      const sections = Object.entries(sectionGroups)
      return (
        <div>
          {/* Fil d'Ariane */}
          <div className="px-4 mb-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3 flex-wrap">
              <button onClick={() => setLibTab('archives')} className="hover:text-indigo-600 transition-colors">Bibliothèque</button>
              <ChevronRight size={12} />
              <button onClick={backToDocuments} className="hover:text-indigo-600 transition-colors">Textes fondateurs</button>
              <ChevronRight size={12} />
              <span className="text-slate-600 font-semibold truncate max-w-[180px]">{selectedDoc}</span>
            </div>
            <button
              onClick={backToDocuments}
              className="flex items-center gap-1.5 text-sm text-indigo-600 font-semibold mb-2 hover:text-indigo-800 transition-colors"
            >
              <ArrowLeft size={14} />
              Retour aux textes fondateurs
            </button>
            <h2 className="font-black text-slate-800 text-lg leading-tight">{selectedDoc}</h2>
            <p className="text-xs text-slate-400 mt-1">
              {docGroups[selectedDoc]?.length ?? 0} articles · {propCounts[selectedDoc] ?? 0} proposition{(propCounts[selectedDoc] ?? 0) > 1 ? 's' : ''} citoyenne{(propCounts[selectedDoc] ?? 0) > 1 ? 's' : ''}
            </p>
          </div>

          {sections.length === 0 ? (
            <div className="px-4 text-center py-10">
              <p className="text-slate-400 text-sm">Aucun article disponible.</p>
            </div>
          ) : (
            <div className="space-y-5 px-4">
              {sections.map(([sectionTitre, arts]) => (
                <div key={sectionTitre}>
                  {sectionTitre !== '—' && (
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">{sectionTitre}</p>
                  )}
                  <div className="space-y-2">
                    {arts.map(art => (
                      <button
                        key={art.id}
                        onClick={() => openArticle(art)}
                        className="w-full text-left bg-white rounded-xl border border-slate-100 px-4 py-3 hover:border-indigo-200 hover:shadow-sm transition-all active:scale-[.99] group flex items-start gap-3"
                      >
                        <span className="flex-shrink-0 font-black text-indigo-500 text-sm w-10">Art. {art.article_number}</span>
                        <p className="flex-1 text-sm text-slate-700 line-clamp-2 leading-relaxed">{art.original_text}</p>
                        <ChevronRight size={14} className="text-slate-300 flex-shrink-0 mt-0.5 group-hover:text-indigo-400 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    // ── Vue : article + propositions ───────────────────────────
    if (fondateursView === 'article' && selectedArticle) {
      const totalVotesForProposal = (p: ProposalRow) =>
        (p.votes_pour ?? 0) + (p.votes_contre ?? 0) + (p.votes_blanc ?? 0)

      return (
        <div>
          {/* Fil d'Ariane */}
          <div className="px-4 mb-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3 flex-wrap">
              <button onClick={() => setLibTab('archives')} className="hover:text-indigo-600 transition-colors">Bibliothèque</button>
              <ChevronRight size={12} />
              <button onClick={backToDocuments} className="hover:text-indigo-600 transition-colors">Textes fondateurs</button>
              <ChevronRight size={12} />
              <button onClick={backToArticles} className="hover:text-indigo-600 transition-colors truncate max-w-[100px]">{selectedDoc}</button>
              <ChevronRight size={12} />
              <span className="text-slate-600 font-semibold">Article {selectedArticle.article_number}</span>
            </div>
            <button
              onClick={backToArticles}
              className="flex items-center gap-1.5 text-sm text-indigo-600 font-semibold hover:text-indigo-800 transition-colors"
            >
              <ArrowLeft size={14} />
              Retour aux articles
            </button>
          </div>

          {/* Côte à côte — texte officiel / propositions citoyennes */}
          <div className="md:grid md:grid-cols-2 md:gap-5 px-4 gap-y-4 flex flex-col">
            {/* Colonne gauche : texte officiel */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Scale size={15} className="text-slate-500" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Texte en vigueur</p>
              </div>
              <p className="text-xs font-bold text-slate-500 mb-2">Article {selectedArticle.article_number}</p>
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{selectedArticle.original_text}</p>
              {selectedArticle.source_url && (
                <a
                  href={selectedArticle.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
                >
                  Voir sur Légifrance ↗
                </a>
              )}
            </div>

            {/* Colonne droite : propositions citoyennes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Propositions citoyennes</p>
                {articleProposals.length > 0 && (
                  <span className="text-xs text-slate-400">{articleProposals.length} proposition{articleProposals.length > 1 ? 's' : ''}</span>
                )}
              </div>

              {articlePropsLoading ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <div key={i} className="h-20 bg-white rounded-xl border border-slate-100 animate-pulse" />)}
                </div>
              ) : articleProposals.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-5 text-center">
                  <p className="text-sm text-slate-500 font-medium mb-1">Cet article n'a pas encore de proposition citoyenne.</p>
                  <p className="text-xs text-slate-400">Soyez le premier à le moderniser.</p>
                </div>
              ) : (
                articleProposals.map(p => {
                  const total = totalVotesForProposal(p)
                  const pourPct = total > 0 ? Math.round(((p.votes_pour ?? 0) / total) * 100) : 0
                  const contrePct = total > 0 ? Math.round(((p.votes_contre ?? 0) / total) * 100) : 0
                  const { label, cls } = statusLabel(p.status)
                  const isVoting = p.status === 'voting'
                  return (
                    <div key={p.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
                      </div>
                      <p className="text-sm text-slate-800 leading-relaxed mb-3">{p.description}</p>
                      {total > 0 ? (
                        <div className="space-y-1 mb-3">
                          {([['Pour', pourPct, 'bg-green-500'] , ['Contre', contrePct, 'bg-red-500'], ['Blanc', 100 - pourPct - contrePct, 'bg-slate-200']] as const).map(([lbl, pct, color]) => (
                            <div key={lbl} className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 w-10">{lbl}</span>
                              <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                                <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] font-semibold text-slate-500 w-7 text-right">{pct}%</span>
                            </div>
                          ))}
                          <p className="text-[10px] text-slate-400 pt-0.5">{total.toLocaleString('fr-FR')} vote{total > 1 ? 's' : ''}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 mb-3">Aucun vote pour l'instant.</p>
                      )}
                      {isVoting && (
                        <button
                          onClick={() => {
                            setAgoraOriginalText(selectedArticle.original_text)
                            setAgoraProposal(toProposal(p))
                          }}
                          className="w-full py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold active:scale-95 transition-all"
                        >
                          Participer au vote →
                        </button>
                      )}
                    </div>
                  )
                })
              )}

              {/* Formulaire de proposition */}
              {!showForm ? (
                isSubscribed ? (
                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full py-3 rounded-2xl border-2 border-dashed border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-colors active:scale-[.99]"
                  >
                    ✏️ Proposer une modification
                  </button>
                ) : (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center">
                    <p className="text-sm font-bold text-indigo-700 mb-1">Devenez Citoyen soutenant</p>
                    <p className="text-xs text-indigo-500 mb-3 leading-relaxed">
                      Pour proposer des modifications constitutionnelles (2 €/mois).
                    </p>
                    {onNavigateSupport && (
                      <button
                        onClick={onNavigateSupport}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all"
                      >
                        Voir les forfaits →
                      </button>
                    )}
                  </div>
                )
              ) : (
                <div className="bg-white rounded-2xl border border-indigo-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-slate-800">Votre proposition de modification</p>
                    <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={16} />
                    </button>
                  </div>

                  {/* Texte original pour référence */}
                  <div className="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Texte actuel — Art. {selectedArticle.article_number}</p>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-4">{selectedArticle.original_text}</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Votre proposition de texte modifié <span className="text-slate-400 font-normal">(100–2000 car.)</span>
                      </label>
                      <textarea
                        value={formText}
                        onChange={e => setFormText(e.target.value)}
                        maxLength={2000}
                        rows={5}
                        placeholder="Rédigez le texte de l'article tel que vous proposez qu'il soit modifié…"
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                      />
                      <p className={`text-[10px] mt-0.5 ${formText.length < 100 ? 'text-red-400' : 'text-slate-400'}`}>
                        {formText.length} / 2000 {formText.length < 100 && '(min. 100)'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Pourquoi cette modification ? <span className="text-slate-400 font-normal">(50–500 car.)</span>
                      </label>
                      <textarea
                        value={formMotivation}
                        onChange={e => setFormMotivation(e.target.value)}
                        maxLength={500}
                        rows={3}
                        placeholder="Expliquez la raison de cette modification…"
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                      />
                      <p className={`text-[10px] mt-0.5 ${formMotivation.length < 50 ? 'text-red-400' : 'text-slate-400'}`}>
                        {formMotivation.length} / 500 {formMotivation.length < 50 && '(min. 50)'}
                      </p>
                    </div>

                    {formError && (
                      <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-xs text-red-700 font-medium">{formError}</p>
                      </div>
                    )}
                    <button
                      onClick={handleSubmitProposal}
                      disabled={formSubmitting || formText.trim().length < 100 || formMotivation.trim().length < 50}
                      className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40 transition-all active:scale-95"
                    >
                      {formSubmitting ? 'Soumission…' : 'Soumettre au jury'}
                    </button>
                    <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                      La proposition sera examinée par le jury citoyen avant d'être mise au vote.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  // ── Rendu principal ──────────────────────────────────────────
  return (
    <div className="pb-24">
      {/* Onglets principaux */}
      <div className="px-4 pt-4 pb-0">
        <h1 className="text-2xl font-black text-slate-800 mb-3">Bibliothèque</h1>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setLibTab('archives')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${libTab === 'archives' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <BookOpen size={14} />
            Archives
          </button>
          <button
            onClick={() => setLibTab('fondateurs')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${libTab === 'fondateurs' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Scroll size={14} />
            📜 Textes fondateurs
          </button>
        </div>
      </div>

      {/* ── Onglet Archives ──────────────────────────────────── */}
      {libTab === 'archives' && (
        <>
          <div className="px-4 pb-0">
            <p className="text-slate-500 text-sm leading-relaxed mb-4">Archives des votes citoyens CHOISISSONS</p>

            <div className="relative mb-3">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher dans les archives..."
                className="w-full bg-slate-50 rounded-xl px-3 py-2.5 pr-8 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: 'none' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {([
                  { key: 'all', label: 'Tous' },
                  { key: 'adopted', label: 'Adoptées' },
                  { key: 'rejected', label: 'Rejetées' },
                  { key: 'closed', label: 'Clôturées' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${statusFilter === key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortKey)}
                className="flex-shrink-0 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 outline-none"
              >
                <option value="recent">Plus récentes</option>
                <option value="votes">Plus votées</option>
                <option value="alpha">Alphabétique</option>
              </select>
            </div>
          </div>

          <div className="px-4">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                    <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-100 rounded w-full mb-1" />
                    <div className="h-3 bg-slate-100 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-14">
                <BookOpen size={36} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-500 text-sm font-medium">
                  {entries.length === 0 ? "Aucune proposition clôturée pour l'instant" : 'Aucune archive ne correspond à votre recherche.'}
                </p>
                {entries.length === 0 && <p className="text-slate-400 text-xs mt-1">Les résultats des votes apparaîtront ici</p>}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {filtered.map(entry => {
                  const total = entry.votes_pour + entry.votes_contre + entry.votes_blanc
                  const pctPour = total > 0 ? Math.round((entry.votes_pour / total) * 100) : 0
                  const pctContre = total > 0 ? Math.round((entry.votes_contre / total) * 100) : 0
                  const pctBlanc = total > 0 ? 100 - pctPour - pctContre : 0
                  const isAdopted = entry.status === 'adopted'
                  const isRejected = entry.status === 'rejected'
                  return (
                    <div key={entry.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                            {entry.type === 'law' ? 'Loi parlementaire' : 'Proposition citoyenne'}
                          </p>
                          <h3 className="font-bold text-slate-800 text-sm leading-snug">{entry.title}</h3>
                        </div>
                        {(isAdopted || isRejected) && (
                          <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${isAdopted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {isAdopted ? 'Adoptée' : 'Rejetée'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-2 line-clamp-2">{entry.description}</p>
                      <p className="text-xs text-slate-400 mb-3">
                        Clôturée le {entry.date ? new Date(entry.date).toLocaleDateString('fr-FR') : '—'}
                      </p>
                      {total === 0 ? (
                        <p className="text-xs text-slate-400">Aucun vote enregistré</p>
                      ) : (
                        <div className="space-y-1.5">
                          {([
                            { label: 'Pour', pct: pctPour, color: 'bg-green-500' },
                            { label: 'Contre', pct: pctContre, color: 'bg-red-500' },
                            { label: 'Blanc', pct: pctBlanc, color: 'bg-slate-300' },
                          ] as const).map(({ label, pct, color }) => (
                            <div key={label} className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 w-10 flex-shrink-0">{label}</span>
                              <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                                <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-slate-600 w-8 text-right flex-shrink-0">{pct}%</span>
                            </div>
                          ))}
                          <p className="text-xs text-slate-400 pt-0.5">{total.toLocaleString('fr-FR')} vote{total > 1 ? 's' : ''}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="px-4 mt-6">
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
              <button
                onClick={downloadOpenData}
                disabled={loading || entries.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors active:scale-95"
              >
                <FileText size={15} />
                Données open source
              </button>
              <p className="text-xs text-slate-500 mt-2.5 text-center leading-relaxed">
                Ces données sont librement réutilisables (licence Creative Commons CC0).{' '}
                Pour accéder à l'API :{' '}
                <span className="text-indigo-600 font-medium">contact@choisissons.fr</span>
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── Onglet Textes fondateurs ─────────────────────────── */}
      {libTab === 'fondateurs' && (
        <div className="mt-2">
          {renderFondateurs()}
        </div>
      )}

      {/* ── Modals de vote constitutionnel ──────────────────── */}
      {agoraProposal && !votingProposal && (
        <AgoraModal
          proposal={agoraProposal}
          onVote={() => setVotingProposal(agoraProposal)}
          onClose={() => { setAgoraProposal(null); setAgoraOriginalText('') }}
          hasVoted={votedIds.has(agoraProposal.id)}
          userHash={userHash}
          targetType="proposal"
          originalText={agoraOriginalText}
          onNavigateSupport={onNavigateSupport}
        />
      )}
      {votingProposal && (
        <VotingBooth
          proposal={votingProposal}
          onVoted={(choice, _hash) => handleConstitutionalVoted(votingProposal.id, choice)}
          onClose={() => setVotingProposal(null)}
        />
      )}
      {resultsId && (
        <ResultsModal
          proposalId={resultsId}
          onClose={() => setResultsId(null)}
        />
      )}
    </div>
  )
}
