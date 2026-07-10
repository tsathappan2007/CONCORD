import React, { useEffect } from 'react'
import { useParams } from '../hooks/useParams'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../context/AuthContext'
import { useNegotiationStore } from '../store/negotiationStore'
import { motion } from 'framer-motion'
import { ShieldAlert, Cpu, Sparkles, FileCheck, RefreshCw } from 'lucide-react'

interface NegotiationRoomProps {
  navigate: (path: string) => void
}

const NegotiationRoom: React.FC<NegotiationRoomProps> = ({ navigate }) => {
  const { id } = useParams()
  const { session } = useAuth()
  const { 
    activeSession, 
    logs, 
    agreedTerms, 
    fetchSessionDetails, 
    subscribeToSessionUpdates,
    loading 
  } = useNegotiationStore()

  useEffect(() => {
    if (id && session) {
      // 1. Initial Fetch
      fetchSessionDetails(supabase, id)

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
      <div className="min-h-screen bg-background text-gray-100 flex justify-center items-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-accent animate-spin" />
          <span className="text-sm text-gray-400">Loading negotiation session...</span>
        </div>
      </div>
    )
  }

  if (!activeSession) {
    return (
      <div className="min-h-screen bg-background text-gray-100 flex justify-center items-center">
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
    <div className="min-h-screen bg-background text-gray-100 flex flex-col h-screen overflow-hidden">
      {/* Top Header Panel */}
      <header className="border-b border-borderLight bg-panel/30 px-8 py-4 flex justify-between items-center shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('#/dashboard')} className="text-xs text-gray-400 hover:text-white">
              &larr; Exit Room
            </button>
            <span className="text-zinc-600">/</span>
            <span className="text-xs text-gray-400">Negotiation Room</span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1">{activeSession.title}</h1>
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
        <div className="w-80 flex flex-col bg-zinc-950/40 overflow-hidden">
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
