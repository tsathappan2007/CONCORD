import { create } from 'zustand'

export interface Session {
  id: string
  title: string
  status: 'draft' | 'awaiting_second_party' | 'ready' | 'negotiating' | 'awaiting_approval' | 'completed' | 'rejected' | 'expired'
  creator_id: string
  party_a_id: string | null
  party_b_id: string | null
  current_turn: 'party_a' | 'party_b' | 'mediator' | 'none'
  round_count: number
  max_rounds: number
  created_at: string
  updated_at: string
}

export interface NegotiationLog {
  id: string
  session_id: string
  round: number
  sender: 'party_a' | 'party_b' | 'mediator' | 'system'
  tool_called: 'propose_term' | 'accept_term' | 'counter_propose' | 'request_concession' | 'escalate_to_mediator' | 'system_start' | 'system_end'
  term: string | null
  value: string | null
  reasoning: string
  created_at: string
}

export interface AgreedTerm {
  id: string
  session_id: string
  term: string
  value: string
  status: 'agreed' | 'pending' | 'unresolved'
  last_modified_by: 'party_a' | 'party_b' | 'mediator'
  version: number
  created_at: string
  updated_at: string
}

interface NegotiationStore {
  sessions: Session[]
  activeSession: Session | null
  logs: NegotiationLog[]
  agreedTerms: AgreedTerm[]
  loading: boolean
  error: string | null
  
  setSessions: (sessions: Session[]) => void
  setActiveSession: (session: Session | null) => void
  setLogs: (logs: NegotiationLog[]) => void
  setAgreedTerms: (terms: AgreedTerm[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  fetchSessions: (supabase: any, userId: string) => Promise<void>
  fetchSessionDetails: (supabase: any, sessionId: string) => Promise<void>
  subscribeToSessionUpdates: (supabase: any, sessionId: string, onUpdate: () => void) => () => void
}

export const useNegotiationStore = create<NegotiationStore>((set) => ({
  sessions: [],
  activeSession: null,
  logs: [],
  agreedTerms: [],
  loading: false,
  error: null,

  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (activeSession) => set({ activeSession }),
  setLogs: (logs) => set({ logs }),
  setAgreedTerms: (agreedTerms) => set({ agreedTerms }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  fetchSessions: async (supabase, userId) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('negotiation_sessions')
        .select('*')
        .or(`creator_id.eq.${userId},party_a_id.eq.${userId},party_b_id.eq.${userId}`)
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ sessions: data || [] })
    } catch (err: any) {
      logger.error('Error fetching sessions:', err)
      set({ error: err.message })
    } finally {
      set({ loading: false })
    }
  },

  fetchSessionDetails: async (supabase, sessionId) => {
    set({ loading: true, error: null })
    try {
      // 1. Fetch Session Info
      const { data: sessionData, error: sessionErr } = await supabase
        .from('negotiation_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (sessionErr) throw sessionErr
      set({ activeSession: sessionData })

      // 2. Fetch Logs
      const { data: logsData, error: logsErr } = await supabase
        .from('negotiation_logs')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (logsErr) throw logsErr
      set({ logs: logsData || [] })

      // 3. Fetch Agreed/Pending Terms
      const { data: termsData, error: termsErr } = await supabase
        .from('agreed_terms')
        .select('*')
        .eq('session_id', sessionId)
        .order('term', { ascending: true })

      if (termsErr) throw termsErr
      set({ agreedTerms: termsData || [] })
    } catch (err: any) {
      logger.error('Error fetching session details:', err)
      set({ error: err.message })
    } finally {
      set({ loading: false })
    }
  },

  subscribeToSessionUpdates: (supabase, sessionId, onUpdate) => {
    // Set up Realtime subscriptions for both negotiation_logs and agreed_terms
    const logsSubscription = supabase
      .channel(`session-${sessionId}-logs`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'negotiation_logs', filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data } = await supabase
            .from('negotiation_logs')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true })
          set({ logs: data || [] })
          onUpdate()
        }
      )
      .subscribe()

    const termsSubscription = supabase
      .channel(`session-${sessionId}-terms`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agreed_terms', filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data } = await supabase
            .from('agreed_terms')
            .select('*')
            .eq('session_id', sessionId)
            .order('term', { ascending: true })
          set({ agreedTerms: data || [] })
          onUpdate()
        }
      )
      .subscribe()

    const sessionSubscription = supabase
      .channel(`session-${sessionId}-self`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'negotiation_sessions', filter: `id=eq.${sessionId}` },
        (payload: any) => {
          set({ activeSession: payload.new })
          onUpdate()
        }
      )
      .subscribe()

    // Return cleanup function
    return () => {
      supabase.removeChannel(logsSubscription)
      supabase.removeChannel(termsSubscription)
      supabase.removeChannel(sessionSubscription)
    }
  }
}))

// Simple inline logging utility to avoid module import issues
const logger = {
  error: (...args: any[]) => console.error('[Zustand]', ...args)
}
