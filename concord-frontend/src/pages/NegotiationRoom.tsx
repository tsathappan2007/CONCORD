import React, { useEffect, useState } from 'react'
import { useParams } from '../hooks/useParams'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../context/AuthContext'
import { useNegotiationStore } from '../store/negotiationStore'
import { motion } from 'framer-motion'
import { ShieldAlert, Cpu, Sparkles, FileCheck, RefreshCw, Copy, Check, LogOut, Trash2, Upload, Eye, FileText } from 'lucide-react'

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface NegotiationRoomProps {
  navigate: (path: string) => void
}

const NegotiationRoom: React.FC<NegotiationRoomProps> = ({ navigate }) => {
  const { id } = useParams()
  const { session, user } = useAuth()
  const { 
    activeSession, 
    logs, 
    agreedTerms, 
    fetchSessionDetails, 
    subscribeToSessionUpdates,
    loading 
  } = useNegotiationStore()

  const [copied, setCopied] = useState(false)
  const [supportingFiles, setSupportingFiles] = useState<any[]>([])
  const [uploadingSupporting, setUploadingSupporting] = useState(false)

  const isCreator = activeSession && user && activeSession.creator_id === user.id

  const fetchSupportingFiles = async () => {
    if (!id || !session) return
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/sessions/${id}/supporting`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      if (!response.ok) throw new Error('Failed to fetch supporting docs')
      const data = await response.json()
      setSupportingFiles(data || [])
    } catch (err) {
      console.error('Failed to fetch supporting files:', err)
    }
  }

  const handleUploadSupportingFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !id || !session) return
    const fileToUpload = e.target.files[0]
    setUploadingSupporting(true)
    try {
      const formData = new FormData()
      formData.append('file', fileToUpload)
      
      const response = await fetch(`${apiBaseUrl}/api/v1/sessions/${id}/supporting`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: formData
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Upload failed')
      }
      fetchSupportingFiles()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to upload supporting document.')
    } finally {
      setUploadingSupporting(false)
    }
  }

  const handleDeleteSupportingFile = async (filename: string) => {
    if (!id || !session) return
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/sessions/${id}/supporting/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Delete failed')
      }
      fetchSupportingFiles()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to delete supporting document.')
    }
  }

  const handleDownloadSupportingFile = (filename: string) => {
    if (!id) return
    const { data } = supabase.storage
      .from('contracts')
      .getPublicUrl(`supporting/${id}/${filename}`)
    if (data?.publicUrl) {
      window.open(data.publicUrl, '_blank')
    }
  }

  const copyInviteLink = () => {
    if (!id) return
    const inviteLink = `${window.location.origin}/#/join/${id}`
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    if (id && session) {
      // 1. Initial Fetch
      fetchSessionDetails(supabase, id)
      fetchSupportingFiles()

      // 2. Real-time subscription
      const unsubscribe = subscribeToSessionUpdates(supabase, id, () => {
        // Triggered on realtime Postgres mutations
        console.log('Real-time update received for session')
      })

      return () => {
        unsubscribe()
      }
    }
  }, [id, session])

  if (loading && !activeSession) {
    return (
      <div className="min-h-screen bg-transparent text-gray-100 flex justify-center items-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-accent animate-spin" />
          <span className="text-sm text-gray-400">Loading negotiation session...</span>
        </div>
      </div>
    )
  }

  if (!activeSession) {
    return (
      <div className="min-h-screen bg-transparent text-gray-100 flex justify-center items-center">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold">Session Not Found</h3>
          <button onClick={() => navigate('#/dashboard')} className="mt-4 text-sm text-accent hover:underline">
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Filter logs for A and B
  const agentALogs = logs.filter(l => l.sender === 'party_a')
  const agentBLogs = logs.filter(l => l.sender === 'party_b')

  const latestALog = agentALogs[agentALogs.length - 1]
  const latestBLog = agentBLogs[agentBLogs.length - 1]

  return (
    <div className="min-h-screen bg-transparent text-gray-100 flex flex-col h-screen overflow-hidden">
      {/* Top Header Panel */}
      <header className="border-b border-borderLight bg-panel/30 px-8 py-4 flex justify-between items-center shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('#/dashboard')} 
              className="px-3 py-1.5 bg-zinc-900 border border-borderLight hover:bg-zinc-800 text-xs font-semibold text-red-400 hover:text-red-300 rounded-xl flex items-center gap-1.5 transition duration-150 cursor-pointer"
            >
              <LogOut size={12} className="rotate-180 text-red-400" /> Exit Room
            </button>
            <span className="text-zinc-600">/</span>
            <span className="text-xs text-gray-400 font-medium">Negotiation Room</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <h1 className="text-xl font-bold text-white">{activeSession.title}</h1>
            <button
              onClick={copyInviteLink}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-borderLight hover:bg-zinc-800 text-[10px] font-semibold text-gray-300 flex items-center gap-1.5 transition duration-150 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={10} className="text-emerald-400" /> Copied Invite
                </>
              ) : (
                <>
                  <Copy size={10} /> Copy Invite Link
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-gray-400">Round Count</div>
            <div className="text-sm font-bold text-white">
              {activeSession.round_count} / {activeSession.max_rounds}
            </div>
          </div>

          {activeSession.status === 'negotiating' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-400 font-semibold animate-pulse">
              <Cpu size={14} className="animate-spin" /> Agents Negotiating
            </div>
          )}

          {activeSession.status === 'awaiting_approval' && (
            <button
              onClick={() => navigate(`#/session/${id}/review`)}
              className="px-4 py-2 bg-success hover:bg-success/80 text-xs font-bold text-white rounded-lg flex items-center gap-1.5 transition duration-150"
            >
              <FileCheck size={14} /> Review Agreement
            </button>
          )}
        </div>
      </header>

      {/* Main Split Screen Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Real-time Agents Duel */}
        <div className="flex-1 flex flex-col border-r border-borderLight overflow-hidden">
          {/* Hero Concessions Tracker */}
          <div className="p-6 bg-zinc-950/60 border-b border-borderLight shrink-0">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1">
              <Sparkles size={14} className="text-accent" /> Term Convergence Progress
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {agreedTerms.map((t) => (
                <div key={t.id} className="p-3 bg-panel/30 border border-borderLight rounded-xl">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-semibold text-gray-300 truncate max-w-[120px]">
                      {t.term.replace(/_/g, ' ').title()}
                    </span>
                    {t.status === 'agreed' ? (
                      <span className="text-[10px] text-emerald-400 font-bold">AGREED</span>
                    ) : (
                      <span className="text-[10px] text-indigo-400 font-bold">PENDING</span>
                    )}
                  </div>
                  
                  {/* Convergence Bar */}
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${t.status === 'agreed' ? 'bg-success' : 'bg-accent'}`}
                      initial={{ width: 0 }}
                      animate={{ width: t.status === 'agreed' ? '100%' : '50%' }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1.5 truncate">
                    Value: <b>{t.value}</b>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agents reasoning panels */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-y-auto">
            {/* Agent A Console */}
            <div className="p-6 border-r border-borderLight bg-zinc-950/20 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                    <Cpu size={14} /> Agent A Console (Creator)
                  </h4>
                  {activeSession.current_turn === 'party_a' && (
                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping"></span>
                  )}
                </div>

                {latestALog ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-zinc-900 border border-borderLight">
                      <div className="text-xs font-semibold text-gray-400 uppercase">Latest Action</div>
                      <div className="text-sm font-bold text-white mt-1">
                        {latestALog.tool_called.replace(/_/g, ' ').toUpperCase()} on '{latestALog.term}'
                      </div>
                      <div className="text-xs text-indigo-400 mt-0.5">Value: {latestALog.value}</div>
                    </div>

                    <div className="p-4 rounded-xl bg-panel border border-borderLight">
                      <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Commercial Justification</div>
                      <p className="text-xs text-gray-300 leading-relaxed italic">
                        "{latestALog.reasoning}"
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 text-gray-500 text-xs">
                    Agent A has not taken any actions yet.
                  </div>
                )}
              </div>
              
              <div className="text-[10px] text-gray-500 border-t border-borderLight/50 pt-4 mt-6">
                Analyzing Party A Private Constraints
              </div>
            </div>

            {/* Agent B Console */}
            <div className="p-6 bg-zinc-950/20 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                    <Cpu size={14} /> Agent B Console (Counterparty)
                  </h4>
                  {activeSession.current_turn === 'party_b' && (
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                  )}
                </div>

                {latestBLog ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-zinc-900 border border-borderLight">
                      <div className="text-xs font-semibold text-gray-400 uppercase">Latest Action</div>
                      <div className="text-sm font-bold text-white mt-1">
                        {latestBLog.tool_called.replace(/_/g, ' ').toUpperCase()} on '{latestBLog.term}'
                      </div>
                      <div className="text-xs text-emerald-400 mt-0.5">Value: {latestBLog.value}</div>
                    </div>

                    <div className="p-4 rounded-xl bg-panel border border-borderLight">
                      <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Commercial Justification</div>
                      <p className="text-xs text-gray-300 leading-relaxed italic">
                        "{latestBLog.reasoning}"
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 text-gray-500 text-xs">
                    Agent B has not taken any actions yet.
                  </div>
                )}
              </div>

              <div className="text-[10px] text-gray-500 border-t border-borderLight/50 pt-4 mt-6">
                Analyzing Party B Private Constraints
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Timeline Audit Trail */}
        <div className="w-80 flex flex-col bg-zinc-950/40 border-l border-borderLight overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-borderLight shrink-0 bg-panel/10">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Negotiation Timeline Log</h3>
            </div>

            <div className="flex-grow p-4 overflow-y-auto space-y-4">
              {logs.length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-500">
                  No logs recorded yet. Waiting for negotiation to start...
                </div>
              ) : (
                logs.map((log) => {
                  const isSystem = log.sender === 'system'
                  const isMediator = log.sender === 'mediator'
                  
                  return (
                    <div key={log.id} className="text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span className={`font-semibold uppercase ${
                          isSystem ? 'text-zinc-400' : isMediator ? 'text-amber-400' : log.sender === 'party_a' ? 'text-indigo-400' : 'text-emerald-400'
                        }`}>
                          {log.sender.replace(/_/g, ' ')}
                        </span>
                        <span>Round {log.round}</span>
                      </div>
                      
                      <div className="p-3 bg-panel/30 border border-borderLight rounded-xl">
                        {!isSystem && (
                          <div className="font-semibold text-white mb-1">
                            {log.tool_called.replace(/_/g, ' ').toUpperCase()}
                            {log.term && ` on '${log.term}'`}
                            {log.value && ` = ${log.value}`}
                          </div>
                        )}
                        <p className="text-gray-400 italic">
                          {log.reasoning}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Supporting Documents Section */}
          <div className="border-t border-borderLight bg-zinc-950/60 p-4 shrink-0 flex flex-col gap-3 max-h-[300px]">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck size={14} className="text-accent" /> Supporting Docs
              </h4>
              {isCreator && (
                <label className="text-[10px] font-bold text-accent hover:text-accentHover cursor-pointer flex items-center gap-0.5">
                  <Upload size={10} />
                  <span>Upload</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleUploadSupportingFile}
                    disabled={uploadingSupporting}
                  />
                </label>
              )}
            </div>

            {uploadingSupporting && (
              <div className="text-[10px] text-gray-400 animate-pulse">Uploading file...</div>
            )}

            {supportingFiles.length === 0 ? (
              <div className="text-[10px] text-gray-500 italic py-2 text-center">
                No supporting documents.
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[180px] pr-1">
                {supportingFiles.map((f) => (
                  <div key={f.name} className="p-2 rounded-lg bg-zinc-900 border border-borderLight/40 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 truncate flex-grow">
                      <FileText size={14} className="text-accent shrink-0" />
                      <span className="text-xs font-medium text-white truncate" title={f.name}>{f.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleDownloadSupportingFile(f.name)}
                        className="p-1 rounded bg-zinc-950 border border-borderLight hover:border-accent hover:text-accent text-gray-400 transition cursor-pointer"
                        title="View Document"
                      >
                        <Eye size={12} />
                      </button>
                      {isCreator && (
                        <button
                          onClick={() => handleDeleteSupportingFile(f.name)}
                          className="p-1 rounded bg-zinc-950 border border-borderLight hover:border-red-500/30 hover:text-red-400 text-gray-400 transition cursor-pointer"
                          title="Delete Document"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Simple Title case helper
declare global {
  interface String {
    title(): string;
  }
}
String.prototype.title = function(this: string) {
  return this.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default NegotiationRoom
