import React, { useEffect, useState } from 'react'
import { useParams } from '../hooks/useParams'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../context/AuthContext'
import { motion } from 'framer-motion'
import { Link2, RefreshCw, AlertCircle } from 'lucide-react'

interface JoinSessionProps {
  navigate: (path: string) => void
}

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const JoinSession: React.FC<JoinSessionProps> = ({ navigate }) => {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    // Wait for auth state to resolve
    if (authLoading) return

    if (!user) {
      // Force user to login or sign up first, pointing back to this path afterwards
      navigate('#/auth')
      return
    }

    const joinNegotiation = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/sessions/${id}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          }
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.detail || 'Failed to join the session.')
        }

        // Successfully joined. Go to setup constraints
        navigate(`#/session/${id}/setup`)
      } catch (err: any) {
        console.error(err)
        setErrorMsg(err.message || 'An error occurred while joining the negotiation.')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      joinNegotiation()
    }
  }, [id, user, authLoading])

  return (
    <div className="min-h-screen bg-transparent text-gray-100 flex justify-center items-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 rounded-2xl bg-panel border border-borderLight shadow-xl text-center"
      >
        <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-6 text-accent">
          <Link2 size={24} />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Joining Negotiation</h2>
        <p className="text-sm text-gray-400 mb-6">Connecting you as the counterparty to this agreement session...</p>

        {loading && (
          <div className="flex justify-center items-center gap-2 text-xs text-gray-400">
            <RefreshCw className="w-4 h-4 text-accent animate-spin" />
            <span>Verifying invitation status...</span>
          </div>
        )}

        {errorMsg && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-left flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => navigate('#/dashboard')}
              className="w-full py-2 bg-zinc-900 border border-borderLight hover:bg-zinc-800 text-xs font-semibold text-white rounded-lg transition"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default JoinSession
