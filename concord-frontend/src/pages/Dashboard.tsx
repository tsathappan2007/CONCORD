import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNegotiationStore } from '../store/negotiationStore'
import type { Session } from '../store/negotiationStore'
import { supabase } from '../context/AuthContext'
import { motion } from 'framer-motion'
import { Plus, Copy, Check, LogOut, ArrowRight, FolderOpen } from 'lucide-react'

interface DashboardProps {
  navigate: (path: string) => void
}

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const Dashboard: React.FC<DashboardProps> = ({ navigate }) => {
  const { user, signOut } = useAuth()
  const { sessions, fetchSessions, loading, error, setError } = useNegotiationStore()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [newSessionTitle, setNewSessionTitle] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    if (user) {
      fetchSessions(supabase, user.id)
    }
  }, [user])

  const copyInviteLink = (sessionId: string) => {
    const inviteLink = `${window.location.origin}/#/join/${sessionId}`
    navigator.clipboard.writeText(inviteLink)
    setCopiedId(sessionId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSessionTitle.trim() || !user) return
    setCreateLoading(true)
    setError(null)

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ title: newSessionTitle })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to create session')
      }
      
      const newSession = await response.json()
      setIsModalOpen(false)
      setNewSessionTitle('')
      // Refresh list
      fetchSessions(supabase, user.id)
      // Navigate to create flow (upload details)
      navigate(`#/session/${newSession.id}/setup`)
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setCreateLoading(false)
    }
  }

  const getStatusBadge = (status: Session['status']) => {
    const styles: Record<Session['status'], string> = {
      draft: 'bg-zinc-800 text-zinc-400 border-zinc-700',
      awaiting_second_party: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      ready: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      negotiating: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse',
      awaiting_approval: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
      rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
      expired: 'bg-zinc-900 text-zinc-600 border-zinc-800',
    }

    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${styles[status]}`}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-background text-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-borderLight bg-panel/30 flex flex-col justify-between p-6">
        <div>
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="font-bold text-white text-md">C</span>
            </div>
            <span className="font-semibold text-md tracking-wider">CONCORD</span>
          </div>

          <nav className="space-y-2">
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent font-medium text-sm text-left">
              <FolderOpen size={16} /> Negotiations
            </button>
          </nav>
        </div>

        <div className="pt-6 border-t border-borderLight">
          <div className="text-xs text-gray-400 mb-4 truncate" title={user?.email}>
            {user?.email}
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition duration-150"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-10 max-w-6xl mx-auto overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white">Negotiations</h1>
            <p className="text-sm text-gray-400 mt-1">Manage, inspect, and engineer your active contract agreements.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-accent hover:bg-accentHover text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-accent/25 transition duration-150"
          >
            <Plus size={16} /> New Session
          </button>
        </header>

        {error && (
          <div className="p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-44 bg-panel/30 border border-borderLight rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 bg-panel/20 border border-dashed border-borderLight rounded-2xl">
            <FolderOpen className="mx-auto w-12 h-12 text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-white">No active negotiations</h3>
            <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
              Create a new negotiation session, upload constraints, and invite counterparties to start.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-6 px-4 py-2 bg-zinc-900 border border-borderLight hover:bg-zinc-800 text-gray-300 rounded-lg text-sm transition duration-150"
            >
              Get Started
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sessions.map((session) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-2xl bg-panel border border-borderLight flex flex-col justify-between hover:border-accent/40 transition duration-150"
              >
                <div>
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <h3 className="text-lg font-bold text-white truncate max-w-[240px]">
                      {session.title}
                    </h3>
                    {getStatusBadge(session.status)}
                  </div>
                  
                  <div className="text-xs text-gray-400 space-y-1">
                    <div><b>Round:</b> {session.round_count} / {session.max_rounds}</div>
                    <div><b>Created:</b> {new Date(session.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-borderLight flex items-center justify-between">
                  {/* Action or Invitation */}
                  {session.status === 'draft' || session.status === 'awaiting_second_party' ? (
                    <button
                      onClick={() => copyInviteLink(session.id)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-gray-300 flex items-center gap-1.5 transition duration-150"
                    >
                      {copiedId === session.id ? (
                        <>
                          <Check size={12} className="text-emerald-400" /> Copied Invite
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Copy Invite Link
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="text-xs text-gray-500">
                      Active Participant
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (session.status === 'draft') {
                        navigate(`#/session/${session.id}/setup`)
                      } else {
                        navigate(`#/session/${session.id}/room`)
                      }
                    }}
                    className="text-xs font-bold text-accent hover:text-accentHover flex items-center gap-1 group transition duration-150"
                  >
                    Open Room <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* New Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="w-full max-w-md p-6 bg-panel border border-borderLight rounded-2xl shadow-xl"
          >
            <h3 className="text-lg font-bold text-white mb-2">Create Negotiation Session</h3>
            <p className="text-xs text-gray-400 mb-6">Initialize a session title representing your commercial contract negotiation.</p>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Session Title
                </label>
                <input
                  type="text"
                  required
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder="e.g. Freelance Development Agreement"
                  className="w-full px-4 py-3 bg-zinc-950 border border-borderLight rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-accent transition duration-150"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-accent hover:bg-accentHover disabled:bg-accent/50 text-sm font-semibold text-white rounded-lg flex items-center gap-1.5 transition duration-150"
                >
                  {createLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
