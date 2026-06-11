import { useState, useEffect, createContext, useContext, type ReactNode } from 'react'
import { supabase } from '../supabaseClient'
import { getSupabaseIdentity } from '../lib/identity'
import { flushPendingVotes } from '../lib/votes'
import { showToast } from '../lib/toast'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
    user: User | null
    userHash: string
    userEmail: string
    isLoggedIn: boolean
    isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [userHash, setUserHash] = useState('')
    const [userEmail, setUserEmail] = useState('')
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Auth listener must be registered before getSession so we don't miss
        // the SIGNED_IN event triggered by the magic-link token in the URL.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
                // TODO Phase 2: FranceConnect — remplacer session.user.id par l'identifiant FranceConnect vérifié
                const hash = await getSupabaseIdentity(session.user.id)
                setUser(session.user)
                setUserHash(hash)
                setUserEmail(session.user.email ?? '')
                flushPendingVotes()
                window.history.replaceState(null, '', window.location.pathname)

                if (event === 'SIGNED_IN') {
                    const pendingCommune = localStorage.getItem('pending_commune')
                    if (pendingCommune) {
                        try {
                            const { error } = await supabase.from('profiles').update({ commune_name: pendingCommune }).eq('id', session.user.id)
                            if (error) throw error
                            localStorage.removeItem('pending_commune')
                            showToast(`Bienvenue ! Vous êtes rattaché à ${pendingCommune}`, 'info')
                        } catch (e) {
                            console.error("Erreur de rattachement commune:", e)
                            showToast("Impossible de rattacher la commune. Veuillez réessayer depuis votre profil.", 'warning')
                        }
                    }
                    const pendingProfile = localStorage.getItem('pending_profile')
                    if (pendingProfile) {
                        try {
                            const { code_postal, date_naissance_hash } = JSON.parse(pendingProfile) as {
                                code_postal: string
                                date_naissance_hash: string
                            }
                            const { error } = await supabase.from('profiles').upsert({
                                id: session.user.id,
                                code_postal,
                                date_naissance_hash,
                                verification_status: 'unverified',
                            }, { onConflict: 'id' })
                            if (error) throw error
                            localStorage.removeItem('pending_profile')
                        } catch (e) {
                            console.error("Erreur de sauvegarde profil:", e)
                        }
                    }
                }
            }
            if (event === 'SIGNED_OUT') {
                setUser(null)
                setUserHash('')
                setUserEmail('')
            }
        })

        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session) {
                const hash = await getSupabaseIdentity(session.user.id)
                setUser(session.user)
                setUserHash(hash)
                setUserEmail(session.user.email ?? '')
                flushPendingVotes()
                setIsLoading(false)
                return
            }
            // iOS PWA standalone: getSession() may not find the session saved in Safari context —
            // try restoring manually from the known storage key
            try {
                const saved = localStorage.getItem('choisissons-auth')
                if (saved) {
                    const parsed = JSON.parse(saved) as { access_token?: string; refresh_token?: string }
                    if (parsed?.access_token && parsed?.refresh_token) {
                        const { error } = await supabase.auth.setSession({
                            access_token: parsed.access_token,
                            refresh_token: parsed.refresh_token,
                        })
                        if (error) {
                            localStorage.removeItem('choisissons-auth')
                        }
                        setIsLoading(false)
                        return
                    }
                }
            } catch { /* malformed storage entry — ignore */ }
            setIsLoading(false)
        })

        // iOS PWA: when the user returns to the app after clicking the magic link in Safari,
        // Safari has already stored the session in localStorage (shared origin on iOS 14.3+).
        const handleVisibilityChange = async () => {
            if (document.visibilityState !== 'visible') return
            const { data: { session } } = await supabase.auth.getSession()
            if (session) return
            try {
                const saved = localStorage.getItem('choisissons-auth')
                if (saved) {
                    const parsed = JSON.parse(saved) as { access_token?: string; refresh_token?: string }
                    if (parsed?.access_token && parsed?.refresh_token) {
                        const { error } = await supabase.auth.setSession({
                            access_token: parsed.access_token,
                            refresh_token: parsed.refresh_token,
                        })
                        if (error) {
                            localStorage.removeItem('choisissons-auth')
                        }
                    }
                }
            } catch { /* ignore */ }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            subscription.unsubscribe()
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [])

    return (
        <AuthContext.Provider value={{ user, userHash, userEmail, isLoggedIn: !!user, isLoading }}>
            {children}
        </AuthContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
