import React, { useEffect, useState } from 'react'
import { useAuth, supabase } from '../context/AuthContext'
import { useNegotiationStore } from '../store/negotiationStore'
import type { Session } from '../store/negotiationStore'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Copy, Check, LogOut, ArrowRight, FolderOpen, Trash2, Menu, X, Sparkles, Clock, LayoutDashboard } from 'lucide-react'

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

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'negotiations' | 'agreements' | 'profile' | 'premium'>('overview')
  const [profileName, setProfileName] = useState(user?.user_metadata?.name || '')
  const [profilePhone, setProfilePhone] = useState(user?.user_metadata?.phone || '')
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    if (user) {
      fetchSessions(supabase, user.id)
      setProfileName(user.user_metadata?.name || '')
      setProfilePhone(user.user_metadata?.phone || '')
    }
  }, [user])

  const copyInviteLink = (sessionId: string) => {
    const inviteLink = `${window.location.origin}/#/join/${sessionId}`
    navigator.clipboard.writeText(inviteLink)
    setCopiedId(sessionId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to delete this negotiation room? This action cannot be undone.')) {
      return
    }
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      })
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to delete session')
      }
      
      // Refresh list
      if (user) {
        fetchSessions(supabase, user.id)
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    }
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

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileSuccess(null)
    setProfileError(null)
    setProfileLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          name: profileName,
          phone: profilePhone
        }
      })
      if (updateError) throw updateError
      setProfileSuccess('Profile details saved successfully!')
    } catch (err: any) {
      console.error(err)
      setProfileError(err.message || 'Failed to update profile.')
    } finally {
      setProfileLoading(false)
    }
  }

  const filteredSessions = sessions.filter((s) => {
    if (activeTab === 'negotiations') {
      return s.status !== 'completed'
    } else if (activeTab === 'agreements') {
      return s.status === 'completed'
    }
    return false
  })

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
    <div className="min-h-screen bg-transparent text-gray-100 flex relative overflow-hidden">
      {/* Hamburger menu toggle button */}
      <button
        onClick={() => setIsSidebarOpen(true)}
        className="fixed top-6 left-6 p-2.5 rounded-xl bg-[#0a0a0b]/40 backdrop-blur-md border border-borderLight/30 text-gray-400 hover:text-accent hover:border-accent/40 shadow-lg shadow-black/40 transition duration-150 cursor-pointer z-40 flex items-center justify-center"
        title="Open Menu"
      >
        <Menu size={20} />
      </button>

      {/* Top Right Profile Button */}
      <button
        onClick={() => setActiveTab('profile')}
        className="fixed top-6 right-6 px-4 py-2 rounded-xl bg-[#0a0a0b]/40 backdrop-blur-md border border-borderLight/30 hover:border-accent/40 shadow-lg shadow-black/40 transition duration-150 cursor-pointer z-40 flex items-center gap-3 group"
        title="View Profile Settings"
      >
        <div className="flex flex-col items-end">
          <span className="text-xs font-semibold text-white group-hover:text-accent transition duration-150 truncate max-w-[120px]">
            {profileName || user?.user_metadata?.name || 'Signatory Profile'}
          </span>
          <span className="text-[9px] text-gray-500 truncate max-w-[120px]">
            {user?.email}
          </span>
        </div>
        
        {/* Profile Logo / Avatar */}
        <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center text-accent font-bold text-xs uppercase group-hover:bg-accent group-hover:text-white transition duration-150">
          {(profileName || user?.user_metadata?.name || user?.email || 'U').substring(0, 2)}
        </div>
      </button>

      {/* Sidebar Drawer Container */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/70 z-45"
            />
            
            {/* Sliding Sidebar Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-64 bg-[#0a0a0b]/40 backdrop-blur-xl border-r border-borderLight/30 z-50 flex flex-col justify-between p-6 shadow-2xl"
            >
              <div>
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-3">
                    <img src="/logo.jpg" alt="CONCORD logo" className="w-8 h-8 rounded-lg object-cover" />
                    <span className="font-semibold text-md tracking-wider">CONCORD</span>
                  </div>
                  
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1.5 rounded-lg border border-borderLight text-gray-500 hover:text-white transition duration-150 cursor-pointer flex items-center justify-center"
                    title="Close Menu"
                  >
                    <X size={16} />
                  </button>
                </div>

                <nav className="space-y-2">
                  <button
                    onClick={() => {
                      setActiveTab('overview')
                      setIsSidebarOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm text-left transition duration-150 cursor-pointer ${
                      activeTab === 'overview'
                        ? 'bg-accent/10 border border-accent/20 text-accent font-bold'
                        : 'text-gray-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <LayoutDashboard size={16} /> Overview
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('negotiations')
                      setIsSidebarOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm text-left transition duration-150 cursor-pointer ${
                      activeTab === 'negotiations'
                        ? 'bg-accent/10 border border-accent/20 text-accent font-bold'
                        : 'text-gray-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <FolderOpen size={16} /> Negotiations
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('agreements')
                      setIsSidebarOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm text-left transition duration-150 cursor-pointer ${
                      activeTab === 'agreements'
                        ? 'bg-accent/10 border border-accent/20 text-accent font-bold'
                        : 'text-gray-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <Check size={16} /> Agreements
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('premium')
                      setIsSidebarOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm text-left transition duration-150 cursor-pointer ${
                      activeTab === 'premium'
                        ? 'bg-accent/10 border border-accent/20 text-accent font-bold'
                        : 'text-gray-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <Sparkles size={16} /> Premium
                  </button>
                </nav>
              </div>

              <div className="pt-6 border-t border-borderLight space-y-4">
                <div>
                  <div className="text-xs text-gray-400 mb-4 truncate px-4" title={user?.email}>
                    {user?.email}
                  </div>
                  <button
                    onClick={() => {
                      signOut()
                      setIsSidebarOpen(false)
                    }}
                    className="w-full flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition duration-150 cursor-pointer px-4"
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-grow p-10 pt-24 pl-10 sm:pl-20 max-w-6xl mx-auto overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white">
              {activeTab === 'overview' ? 'Workspace Overview' : activeTab === 'negotiations' ? 'Negotiations' : activeTab === 'agreements' ? 'Agreements' : activeTab === 'profile' ? 'Profile Settings' : 'Premium Plans'}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {activeTab === 'overview'
                ? 'Monitor and analyze your signatory performance and active contract stages.'
                : activeTab === 'negotiations' 
                ? 'Manage, inspect, and engineer your active contract agreements.' 
                : activeTab === 'agreements' 
                ? 'Inspect and download your finalized contract agreements.' 
                : activeTab === 'profile'
                ? 'Update your official signatory details used in Service Agreements.'
                : 'Select a subscription plan that suits your negotiation volume.'}
            </p>
          </div>
          {(activeTab === 'overview' || activeTab === 'negotiations') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 bg-accent hover:bg-accentHover text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-accent/25 transition duration-150 cursor-pointer"
            >
              <Plus size={16} /> New Session
            </button>
          )}
        </header>

        {error && (
          <div className="p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {activeTab === 'overview' ? (
          <div className="space-y-10">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Agreements Signed Card */}
              <div className="p-6 rounded-2xl bg-[#0a0a0b]/40 backdrop-blur-md border border-borderLight/30 flex flex-col justify-between h-full hover:border-accent/30 transition duration-150 relative group">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Agreements Signed</div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Check size={16} />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold text-white mb-1">
                    {sessions.filter(s => s.status === 'completed').length}
                  </div>
                  <div className="text-[10px] text-gray-500 leading-normal">
                    Legally binding contracts completed & signed by all parties.
                  </div>
                </div>
              </div>

              {/* Pending Approval Card */}
              <div className="p-6 rounded-2xl bg-[#0a0a0b]/40 backdrop-blur-md border border-borderLight/30 flex flex-col justify-between h-full hover:border-accent/30 transition duration-150 relative group">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Pending Approval</div>
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Clock size={16} />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold text-white mb-1">
                    {sessions.filter(s => s.status === 'awaiting_approval').length}
                  </div>
                  <div className="text-[10px] text-gray-500 leading-normal">
                    Contracts awaiting signatures from one or both parties.
                  </div>
                </div>
              </div>

              {/* Active Drafts Card */}
              <div className="p-6 rounded-2xl bg-[#0a0a0b]/40 backdrop-blur-md border border-borderLight/30 flex flex-col justify-between h-full hover:border-accent/30 transition duration-150 relative group">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Active Drafts</div>
                  <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/25 text-accent flex items-center justify-center">
                    <FolderOpen size={16} />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold text-white mb-1">
                    {sessions.filter(s => ['draft', 'awaiting_second_party', 'ready', 'negotiating'].includes(s.status)).length}
                  </div>
                  <div className="text-[10px] text-gray-500 leading-normal">
                    Active contract negotiations currently in draft mode.
                  </div>
                </div>
              </div>

              {/* Total Rooms Card */}
              <div className="p-6 rounded-2xl bg-[#0a0a0b]/40 backdrop-blur-md border border-borderLight/30 flex flex-col justify-between h-full hover:border-accent/30 transition duration-150 relative group">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Total Rooms</div>
                  <div className="w-8 h-8 rounded-lg bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 flex items-center justify-center">
                    <Menu size={16} />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold text-white mb-1">
                    {sessions.length}
                  </div>
                  <div className="text-[10px] text-gray-500 leading-normal">
                    Total active and completed contract session environments.
                  </div>
                </div>
              </div>
            </div>

            {/* Negotiation Summary Section */}
            <div className="p-6 rounded-2xl bg-[#0a0a0b]/40 backdrop-blur-md border border-borderLight/30 space-y-6 text-left">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-white">Negotiation Summary</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Overview of recent contract stages and states.</p>
                </div>
                {sessions.length > 5 && (
                  <button
                    onClick={() => setActiveTab('negotiations')}
                    className="text-xs text-accent hover:text-accentHover font-semibold transition"
                  >
                    View All
                  </button>
                )}
              </div>

              {sessions.length === 0 ? (
                <div className="text-center py-10 italic text-xs text-gray-500">
                  No active negotiations or signed contracts found. Click "New Session" to start.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-gray-300">
                    <thead>
                      <tr className="border-b border-borderLight/30 text-gray-400 font-semibold uppercase tracking-wider">
                        <th className="pb-3 text-left">Contract / Title</th>
                        <th className="pb-3 text-left">Status</th>
                        <th className="pb-3 text-left">Counterparty</th>
                        <th className="pb-3 text-left">Turn</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderLight/20">
                      {sessions.slice(0, 5).map((session) => (
                        <tr key={session.id} className="hover:bg-white/[0.02] transition duration-150">
                          <td className="py-3.5 font-bold text-white min-w-[200px]">
                            {session.title || 'Untitled Negotiation'}
                          </td>
                          <td className="py-3.5">
                            <span className="inline-block">{getStatusBadge(session.status)}</span>
                          </td>
                          <td className="py-3.5 text-gray-400">
                            {session.party_b_id ? 'Counterparty Joined' : 'Invite Pending'}
                          </td>
                          <td className="py-3.5 capitalize text-gray-400">
                            {session.current_turn === 'none'
                              ? 'none'
                              : (session.current_turn === 'party_a' && (session.creator_id === user?.id || session.party_a_id === user?.id)) ||
                                (session.current_turn === 'party_b' && session.party_b_id === user?.id)
                              ? 'Your Turn'
                              : 'Counterparty Turn'}
                          </td>
                          <td className="py-3.5 text-right">
                            <button
                              onClick={() => {
                                if (session.status === 'completed') {
                                  navigate(`#/session/${session.id}/review`)
                                } else if (['draft', 'awaiting_second_party', 'ready'].includes(session.status)) {
                                  navigate(`#/session/${session.id}/setup`)
                                } else {
                                  navigate(`#/session/${session.id}/room`)
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-borderLight hover:bg-zinc-800 text-white font-medium transition cursor-pointer"
                            >
                              {session.status === 'completed' ? 'View Agreement' : 'Open Room'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'profile' ? (
          <div className="max-w-md p-8 rounded-2xl bg-panel border border-borderLight shadow-xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Edit Profile Details</h2>
              <p className="text-xs text-gray-400 mt-1">Configure your official signatory details used in Service Agreements.</p>
            </div>
            
            {profileSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                {profileSuccess}
              </div>
            )}
            {profileError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {profileError}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 bg-zinc-950 border border-borderLight rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-accent transition duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-3 bg-zinc-950 border border-borderLight rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-accent transition duration-150"
                />
              </div>

              <button
                type="submit"
                disabled={profileLoading}
                className="w-full py-2.5 bg-accent hover:bg-accentHover disabled:bg-accent/50 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-accent/25 transition duration-150 cursor-pointer"
              >
                {profileLoading ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </div>
        ) : activeTab === 'premium' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left pt-4">
              {/* Freemium */}
              <div className="p-6 rounded-2xl bg-panel border border-borderLight flex flex-col justify-between h-full">
                <div>
                  <h3 className="text-base font-bold text-white mb-2">Freemium</h3>
                  <div className="text-3xl font-black text-white mb-6">Free</div>
                  <ul className="text-xs text-gray-400 space-y-3 mb-8">
                    <li className="flex items-center gap-2">
                      <span className="text-accent font-bold">✓</span> 2 negotiations/month
                    </li>
                  </ul>
                </div>
                <div className="w-full py-2 bg-zinc-950/40 border border-dashed border-borderLight text-center text-xs font-semibold text-zinc-500 rounded-xl select-none">
                  Current Plan
                </div>
              </div>

              {/* Premium Individual */}
              <div className="p-6 rounded-2xl bg-panel border border-accent/40 relative flex flex-col justify-between h-full shadow-lg shadow-accent/5">
                <div className="absolute -top-3 left-6 px-2.5 py-0.5 bg-accent text-[10px] font-bold text-white rounded-full uppercase tracking-wider">
                  Popular
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-2">Premium Individual</h3>
                  <div className="text-3xl font-black text-white mb-1">₹499<span className="text-xs font-normal text-gray-400">/month</span></div>
                  <ul className="text-xs text-gray-400 space-y-3 mb-8 mt-6">
                    <li className="flex items-center gap-2">
                      <span className="text-accent font-bold">✓</span> Unlimited negotiations
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent font-bold">✓</span> AI insights
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent font-bold">✓</span> Advanced exports
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent font-bold">✓</span> Priority processing
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => alert('Payment gateways integration coming soon!')}
                  className="w-full py-2 bg-accent hover:bg-accentHover text-xs font-semibold text-white rounded-xl shadow-lg shadow-accent/20 transition cursor-pointer text-center"
                >
                  Upgrade Now
                </button>
              </div>

              {/* Business Plan */}
              <div className="p-6 rounded-2xl bg-panel border border-borderLight flex flex-col justify-between h-full">
                <div>
                  <h3 className="text-base font-bold text-white mb-2">Business Plan</h3>
                  <div className="text-3xl font-black text-white mb-1">₹2999<span className="text-xs font-normal text-gray-400">/month</span></div>
                  <ul className="text-xs text-gray-400 space-y-3 mb-8 mt-6">
                    <li className="flex items-center gap-2">
                      <span className="text-accent font-bold">✓</span> Multiple team members
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent font-bold">✓</span> Shared workspace
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent font-bold">✓</span> Analytics
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent font-bold">✓</span> Negotiation history
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent font-bold">✓</span> API integration
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => alert('Contacting sales setup coming soon!')}
                  className="w-full py-2 bg-zinc-900 border border-borderLight hover:bg-zinc-800 text-xs font-semibold text-white rounded-xl transition cursor-pointer text-center"
                >
                  Choose Business
                </button>
              </div>

              {/* Enterprise */}
              <div className="p-6 rounded-2xl bg-panel border border-borderLight flex flex-col justify-between h-full">
                <div>
                  <h3 className="text-base font-bold text-white mb-2">Enterprise</h3>
                  <div className="text-3xl font-black text-white mb-6">Custom</div>
                  <ul className="text-xs text-gray-400 space-y-3 mb-8">
                    <li className="flex items-center gap-2">
                      <span className="text-accent font-bold">✓</span> On-premise deployment
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent font-bold">✓</span> Custom AI models
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent font-bold">✓</span> SSO
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent font-bold">✓</span> Compliance
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent font-bold">✓</span> Dedicated support
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => alert('Enterprise request form coming soon!')}
                  className="w-full py-2 bg-zinc-900 border border-borderLight hover:bg-zinc-800 text-xs font-semibold text-white rounded-xl transition cursor-pointer text-center"
                >
                  Contact Sales
                </button>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-44 bg-panel/30 border border-borderLight rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-20 bg-panel/20 border border-dashed border-borderLight rounded-2xl">
            <FolderOpen className="mx-auto w-12 h-12 text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-white">
              {activeTab === 'agreements' ? 'No signed agreements' : 'No active negotiations'}
            </h3>
            <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
              {activeTab === 'agreements' 
                ? 'Your finalized contracts will appear here once negotiations are approved.'
                : 'Create a new negotiation session, upload constraints, and invite counterparties to start.'}
            </p>
            {activeTab !== 'agreements' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-6 px-4 py-2 bg-zinc-900 border border-borderLight hover:bg-zinc-800 text-gray-300 rounded-lg text-sm transition duration-150 cursor-pointer"
              >
                Get Started
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredSessions.map((session) => (
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
                  <div className="flex items-center gap-2">
                    {/* Action or Invitation */}
                    {session.status === 'draft' || session.status === 'awaiting_second_party' ? (
                      <button
                        onClick={() => copyInviteLink(session.id)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-gray-300 flex items-center gap-1.5 transition duration-150 cursor-pointer"
                      >
                        {copiedId === session.id ? (
                          <>
                            <Check size={12} className="text-emerald-400" /> Copied Invite
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Copy Invite
                          </>
                        )}
                      </button>
                    ) : session.status === 'awaiting_approval' ? (
                      <button
                        onClick={() => navigate(`#/session/${session.id}/review`)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-semibold text-emerald-400 transition duration-150 cursor-pointer"
                      >
                        View Results
                      </button>
                    ) : (
                      <div className="text-xs text-gray-500">
                        Active Participant
                      </div>
                    )}
                    
                    {/* Delete Room Button */}
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      className="p-1.5 rounded-lg bg-zinc-950 border border-borderLight hover:bg-red-500/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 transition duration-150 cursor-pointer"
                      title="Delete Room"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (activeTab === 'agreements' || session.status === 'completed') {
                        navigate(`#/session/${session.id}/review`)
                      } else if (session.status === 'draft') {
                        navigate(`#/session/${session.id}/setup`)
                      } else {
                        navigate(`#/session/${session.id}/room`)
                      }
                    }}
                    className="text-xs font-bold text-accent hover:text-accentHover flex items-center gap-1 group transition duration-150 cursor-pointer"
                  >
                    {activeTab === 'agreements' || session.status === 'completed' ? 'View Agreement' : 'Open Room'} <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
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
