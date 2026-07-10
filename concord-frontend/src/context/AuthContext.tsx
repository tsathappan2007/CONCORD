import React, { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { User, Session } from '@supabase/supabase-js'

// Initialize Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project-id.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  syncProfile: (session: Session) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const syncProfile = async (currentSession: Session) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`
        }
      })
      if (!response.ok) {
        console.error('Failed to sync profile with backend')
      }
    } catch (err) {
      console.error('Network error during profile sync:', err)
    }
  }

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      setSession(activeSession)
      setUser(activeSession?.user ?? null)
      if (activeSession) {
        syncProfile(activeSession)
      }
      setLoading(false)
    })

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      setSession(activeSession)
      setUser(activeSession?.user ?? null)
      if (activeSession) {
        syncProfile(activeSession)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, syncProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
