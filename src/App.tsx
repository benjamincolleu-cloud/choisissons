import { useState, useCallback, useEffect, type ElementType } from 'react'
import { supabase } from './supabaseClient'
import {
  Home, Compass, User, Heart, Plus, TrendingUp, BookOpen, Globe
} from 'lucide-react'

import type { NavPage, Organisation, CommuneRole, ToastEntry } from './types'
import { ADMIN_EMAILS } from './lib/constants'
import { showToast, setToastHandler } from './lib/toast'
import { useAuth } from './context/AuthContext'

import LandingPage from './components/LandingPage'
import LoginScreen from './components/auth/LoginScreen'
import ToastContainer from './components/common/Toast'
import ProposeModal from './components/modals/ProposeModal'
import HomePage from './pages/HomePage'
import ExplorePage from './pages/ExplorePage'
import ProfilePage from './pages/ProfilePage'
import SupportPage from './pages/SupportPage'
import ImpactPage from './pages/ImpactPage'
import LibraryPage from './pages/LibraryPage'
import ElectedDashboard from './pages/ElectedDashboard'
import OrgDashboard from './pages/OrgDashboard'
import AdminDashboard from './pages/AdminDashboard'
import CommunePage from './pages/CommunePage'
import CommuneRegistration from './CommuneRegistration'
import AssociationRegistration from './AssociationRegistration'
import AmbassadorPage from './pages/AmbassadorPage'

export default function App() {
  const { isLoggedIn, isLoading, userEmail } = useAuth()
  const [showLanding, setShowLanding] = useState(() => {
    return localStorage.getItem('has_seen_landing') !== 'true'
  })
  const [activePage, setActivePage] = useState<NavPage>('home')
  const [showPropose, setShowPropose] = useState(false)
  const [pendingCategory, setPendingCategory] = useState<string | undefined>(undefined)
  const [selectedCommune, setSelectedCommune] = useState<Organisation | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<Organisation | null>(null)
  const [selectedCommunePage, setSelectedCommunePage] = useState<Organisation | null>(null)
  const [communePageRole, setCommunePageRole] = useState<CommuneRole>('member')
  const [communeEluRole, setCommuneEluRole] = useState<CommuneRole>('admin')
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  useEffect(() => {
    setToastHandler((entry) => setToasts(prev => [...prev, entry]))

    // Invitation commune via ?commune=nom — saved here so AuthContext can process it on SIGNED_IN
    const params = new URLSearchParams(window.location.search)
    const communeParam = params.get('commune')
    if (communeParam) {
      try {
        localStorage.setItem('pending_commune', communeParam)
        window.history.replaceState(null, '', window.location.pathname)
      } catch (e) {
        console.warn("Impossible de sauvegarder la commune en attente:", e)
      }
    }

    if (window.location.pathname === '/merci') {
      window.history.replaceState(null, '', '/')
      showToast('Merci pour votre soutien ! Votre abonnement est maintenant actif.', 'info')
    }
    return () => { setToastHandler(null) }
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const handleSelectCategory = (cat: string) => {
    setPendingCategory(cat)
    setActivePage('home')
  }

  const handleNavigateElu = (commune: Organisation, role: CommuneRole) => {
    setSelectedCommune(commune)
    setCommuneEluRole(role)
    setActivePage('elu')
  }

  const handleNavigateOrg = (org: Organisation) => {
    setSelectedOrg(org)
    setActivePage('org')
  }

  const handleNavigateCommune = (commune: Organisation, role: CommuneRole) => {
    setSelectedCommunePage(commune)
    setCommunePageRole(role)
    setActivePage('commune')
  }

  const navItems: { page: NavPage; label: string; icon: ElementType }[] = [
    { page: 'home', label: 'Accueil', icon: Home },
    { page: 'explore', label: 'Explorer', icon: Compass },
    { page: 'reseau', label: 'Réseau', icon: Globe },
    { page: 'profile', label: 'Mon Compte', icon: User },
    { page: 'support', label: 'Soutenir', icon: Heart },
    { page: 'impact', label: 'Impact', icon: TrendingUp },
    { page: 'library', label: 'Bibliothèque', icon: BookOpen },
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!isLoggedIn && activePage !== 'library') {
    if (showLanding) {
      return <LandingPage onEnter={() => {
        localStorage.setItem('has_seen_landing', 'true')
        setShowLanding(false)
      }} />
    }
    return <LoginScreen />
  }

  // Full-screen dashboards — no nav bar
  if (activePage === 'elu' && selectedCommune) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="max-w-md mx-auto md:max-w-[900px] xl:max-w-[1100px] min-h-screen overflow-y-auto">
          <ElectedDashboard
            commune={selectedCommune}
            userRole={communeEluRole}
            onBack={() => setActivePage('profile')}
          />
        </div>
      </>
    )
  }

  if (activePage === 'org' && selectedOrg) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="max-w-md mx-auto md:max-w-[900px] xl:max-w-[1100px] min-h-screen overflow-y-auto">
          <OrgDashboard
            org={selectedOrg}
            onBack={() => setActivePage('profile')}
          />
        </div>
      </>
    )
  }

  if (activePage === 'admin' && ADMIN_EMAILS.includes(userEmail)) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="max-w-md mx-auto md:max-w-[900px] xl:max-w-[1100px] min-h-screen overflow-y-auto">
          <AdminDashboard onBack={() => setActivePage('profile')} />
        </div>
      </>
    )
  }

  if (activePage === 'commune-register') {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="max-w-md mx-auto md:max-w-[640px] min-h-screen overflow-y-auto">
          <CommuneRegistration onBack={() => setActivePage('explore')} />
        </div>
      </>
    )
  }

  if (activePage === 'assoc-register') {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="max-w-md mx-auto md:max-w-[640px] min-h-screen overflow-y-auto">
          <AssociationRegistration onBack={() => setActivePage('explore')} />
        </div>
      </>
    )
  }

  if (activePage === 'commune' && selectedCommunePage) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="max-w-md mx-auto md:max-w-[900px] xl:max-w-[1100px] min-h-screen overflow-y-auto">
          <CommunePage
            commune={selectedCommunePage}
            userRole={communePageRole}
            onBack={() => setActivePage('profile')}
          />
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:w-56 xl:w-64 md:flex-col md:bg-white md:border-r md:border-slate-100 md:z-30">
        <div className="p-5 xl:p-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="" className="h-12 w-auto" />
            <span className="font-bold text-indigo-600 text-xl">CHOISISSONS</span>
          </div>
          <p className="hidden xl:block text-xs text-slate-400 mt-1">La démocratie participative</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {navItems.map(({ page, label, icon: Icon }) => {
            const active = activePage === page
            return (
              <button
                key={page}
                onClick={() => setActivePage(page)}
                className={`w-full flex items-center gap-3 px-4 xl:px-5 py-3 text-sm xl:text-base text-left transition-colors ${active
                  ? 'text-indigo-600 bg-indigo-50 font-semibold border-r-2 border-indigo-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>
        <div className="p-4 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={() => setShowPropose(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Proposer
          </button>
        </div>
      </aside>

      {/* ── Desktop header ───────────────────────────────────── */}
      <header className="hidden md:flex md:fixed md:top-0 md:left-56 xl:left-64 md:right-0 md:h-14 md:bg-white md:border-b md:border-slate-100 md:z-20 md:items-center md:px-6 md:gap-4">
        <h2 className="font-bold text-slate-800 text-base">
          {navItems.find(n => n.page === activePage)?.label ?? ''}
        </h2>
        <div className="ml-auto flex items-center">
          <button
            onClick={() => setActivePage('profile')}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-indigo-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-50"
          >
            <User size={17} />
            <span className="max-w-[180px] truncate">{userEmail || 'Mon compte'}</span>
          </button>
        </div>
      </header>

      {/* ── Content area ─────────────────────────────────────── */}
      <div className="md:pl-56 xl:pl-64 md:pt-14">
        <main className="pb-24 md:pb-10 md:max-w-[900px] xl:max-w-[1100px] md:mx-auto">
          {activePage === 'home' && <HomePage initialCategory={pendingCategory} onNavigateSupport={() => setActivePage('support')} onNavigateLibrary={() => setActivePage('library')} />}
          {activePage === 'explore' && <ExplorePage onSelectCategory={handleSelectCategory} onNavigateCommuneRegister={() => setActivePage('commune-register')} onNavigateAssocRegister={() => setActivePage('assoc-register')} />}
          {activePage === 'reseau' && <AmbassadorPage />}
          {activePage === 'profile' && (
            <ProfilePage
              onLogout={() => { void supabase.auth.signOut(); setActivePage('home') }}
              onNavigateElu={handleNavigateElu}
              onNavigateOrg={handleNavigateOrg}
              onNavigateAdmin={() => setActivePage('admin')}
              onNavigateCommune={handleNavigateCommune}
            />
          )}
          {activePage === 'support' && <SupportPage />}
          {activePage === 'impact' && <ImpactPage />}
          {activePage === 'library' && <LibraryPage onNavigateSupport={() => setActivePage('support')} />}
        </main>
      </div>

      {/* ── Mobile FAB ───────────────────────────────────────── */}
      <button
        onClick={() => setShowPropose(true)}
        aria-label="Proposer une idée"
        className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-300 flex items-center justify-center text-white active:scale-90 transition-all z-40"
      >
        <Plus size={26} />
      </button>

      {/* ── Mobile bottom navigation ─────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 z-30">
        <div className="flex">
          {navItems.map(({ page, label, icon: Icon }) => {
            const active = activePage === page
            return (
              <button
                key={page}
                onClick={() => setActivePage(page)}
                className={`relative flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${active ? 'text-indigo-600' : 'text-slate-400'
                  }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-indigo-600 rounded-full" />
                )}
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className={`text-xs ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Propose modal */}
      {showPropose && <ProposeModal onClose={() => setShowPropose(false)} />}
    </div>
  )
}
