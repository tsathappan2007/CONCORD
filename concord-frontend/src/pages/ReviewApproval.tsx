import React, { useEffect, useState } from 'react'
import { useParams } from '../hooks/useParams'
import { supabase } from '../context/AuthContext'
import { useNegotiationStore } from '../store/negotiationStore'
import { FileText, Download, CheckCircle, XCircle, RefreshCw, LogOut } from 'lucide-react'

interface ReviewApprovalProps {
  navigate: (path: string) => void
}

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const ReviewApproval: React.FC<ReviewApprovalProps> = ({ navigate }) => {
  const { id } = useParams()
  const { activeSession, agreedTerms, fetchSessionDetails, loading } = useNegotiationStore()
  
  const [submitting, setSubmitting] = useState(false)
  const [exportUrls, setExportUrls] = useState<{ pdf_url?: string; docx_url?: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [hasApproved, setHasApproved] = useState(false)

  const fetchExportUrls = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/sessions/${id}/export`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setExportUrls(data)
      }
    } catch (err) {
      console.error('Failed to retrieve export urls:', err)
    }
  }

  const checkUserApproval = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || !id) return
      
      const { data } = await supabase
        .from('agreement_versions')
        .select('*')
        .eq('session_id', id)
        .eq('created_by', session.user.id)
        .eq('status', 'draft')
        .eq('version', 888)
        
      if (data && data.length > 0) {
        setHasApproved(true)
      }
    } catch (err) {
      console.error('Failed to check user approval:', err)
    }
  }

  useEffect(() => {
    if (id) {
      fetchSessionDetails(supabase, id)
      fetchExportUrls()
      checkUserApproval()
    }
  }, [id])

  const handleApprove = async () => {
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/sessions/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'Approval failed.')
      }

      if (data.status === 'completed') {
        setExportUrls({ pdf_url: data.pdf_url, docx_url: data.docx_url })
      } else {
        setHasApproved(true)
      }
      fetchSessionDetails(supabase, id!)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit approval.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/sessions/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Rejection failed.')
      }

      navigate('#/dashboard')
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit rejection.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !activeSession) {
    return (
      <div className="min-h-screen bg-transparent text-gray-100 flex justify-center items-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-accent animate-spin" />
          <span className="text-sm text-gray-400">Loading agreement details...</span>
        </div>
      </div>
    )
  }

  if (!activeSession) {
    return (
      <div className="min-h-screen bg-transparent text-gray-100 flex justify-center items-center">
        <div className="text-center">
          <h3 className="text-lg font-bold">Session Not Found</h3>
          <button onClick={() => navigate('#/dashboard')} className="mt-4 text-sm text-accent hover:underline">
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent text-gray-100 p-8 max-w-4xl mx-auto overflow-y-auto">
      <header className="mb-10 flex justify-between items-start">
        <div>
          <button onClick={() => navigate(`#/session/${id}/room`)} className="text-xs text-gray-400 hover:text-white mb-3 block cursor-pointer">
            &larr; Back to Room
          </button>
          <h1 className="text-3xl font-bold text-white">Final Agreement Review</h1>
          <p className="text-sm text-gray-400 mt-1">Review the negotiated contract terms and grant your approval to sign and close the session.</p>
        </div>
        <button
          onClick={() => navigate('#/dashboard')}
          className="px-4 py-2 bg-zinc-900 border border-borderLight hover:bg-zinc-800 text-xs font-semibold text-red-400 hover:text-red-300 rounded-xl flex items-center gap-1.5 transition duration-150 cursor-pointer"
        >
          <LogOut size={12} className="rotate-180 text-red-400" /> Exit Review
        </button>
      </header>

      {errorMsg && (
        <div className="p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {errorMsg}
        </div>
      )}

      {hasApproved && activeSession.status === 'awaiting_approval' && (
        <div className="p-4 mb-6 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-accent" />
          <span>You have approved this agreement. Awaiting counterparty approval to finalize and generate signed PDF.</span>
        </div>
      )}

      {/* Main Review Panel */}
      <div className="p-8 rounded-2xl bg-panel border border-borderLight shadow-xl space-y-8">
        <div className="border-b border-borderLight pb-6">
          <div className="text-center">
            <h2 className="text-lg font-bold text-white tracking-widest uppercase">CONCORD AGREEMENT</h2>
            <div className="text-xs text-gray-500 mt-1">Session: {activeSession.title}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">ID: {activeSession.id}</div>
          </div>
        </div>

        {/* Agreed Terms list */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">1. Agreed Terms Summary</h3>
          <div className="border border-borderLight rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-950/60 border-b border-borderLight">
                  <th className="p-3 text-gray-400 font-semibold uppercase">Term Name</th>
                  <th className="p-3 text-gray-400 font-semibold uppercase">Negotiated Value</th>
                  <th className="p-3 text-gray-400 font-semibold uppercase text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {agreedTerms.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-900/20">
                    <td className="p-3 font-semibold text-gray-300">
                      {t.term.replace(/_/g, ' ').title()}
                    </td>
                    <td className="p-3 text-gray-400">
                      {t.value}
                    </td>
                    <td className="p-3 text-right">
                      {t.status === 'agreed' ? (
                        <span className="text-emerald-400 font-bold uppercase text-[10px]">Agreed</span>
                      ) : (
                        <span className="text-amber-400 font-bold uppercase text-[10px]">{t.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Export Files Download section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-borderLight">
          {/* Word document - Talks of Negotiation */}
          <div className="p-5 rounded-xl bg-zinc-900/60 border border-borderLight flex flex-col justify-between space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <FileText size={20} />
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs font-bold text-white truncate">Talks of Negotiation</div>
                <div className="text-[10px] text-gray-400 mt-1 leading-normal font-medium">
                  Download the complete agent negotiation logs and audit trail in Word format.
                </div>
              </div>
            </div>
            {exportUrls?.docx_url ? (
              <a
                href={exportUrls.docx_url}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 bg-zinc-950 hover:bg-zinc-900 border border-borderLight text-xs font-semibold text-white rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Download size={12} /> Download Word Document
              </a>
            ) : (
              <div className="text-center py-2 text-[10px] text-gray-500 italic">
                Generating logs...
              </div>
            )}
          </div>

          {/* PDF document - Final signed agreement */}
          <div className="p-5 rounded-xl bg-zinc-900/60 border border-borderLight flex flex-col justify-between space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/15 border border-success/20 flex items-center justify-center text-success shrink-0">
                <CheckCircle size={20} />
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs font-bold text-white truncate">Download Agreement</div>
                <div className="text-[10px] text-gray-400 mt-1 leading-normal font-medium">
                  Download the final legally binding signed agreement in secure PDF format.
                </div>
              </div>
            </div>
            {activeSession.status === 'completed' && exportUrls?.pdf_url ? (
              <a
                href={exportUrls.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 bg-success hover:bg-success/80 text-xs font-semibold text-white rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Download size={12} /> Download PDF Agreement
              </a>
            ) : (
              <div className="w-full py-2 bg-zinc-950/40 border border-dashed border-borderLight text-center text-[10px] font-semibold text-zinc-500 rounded-lg select-none">
                Awaiting Counterparty Signature
              </div>
            )}
          </div>
        </div>

        {/* Signature panels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-borderLight pt-6">
          <div className="p-4 rounded-xl bg-zinc-950/40 border border-borderLight text-center">
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-4">Party A Signature Block</div>
            <div className="border-b border-dashed border-zinc-700 h-10 mb-2 flex items-center justify-center italic text-xs text-gray-400">
              {activeSession.status === 'completed' ? '✓ Signed Electronically via CONCORD' : 'Awaiting Final Approval'}
            </div>
            <div className="text-[10px] text-gray-500">Creator Authorized Signatory</div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/40 border border-borderLight text-center">
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-4">Party B Signature Block</div>
            <div className="border-b border-dashed border-zinc-700 h-10 mb-2 flex items-center justify-center italic text-xs text-gray-400">
              {activeSession.status === 'completed' ? '✓ Signed Electronically via CONCORD' : 'Awaiting Final Approval'}
            </div>
            <div className="text-[10px] text-gray-500">Counterparty Authorized Signatory</div>
          </div>
        </div>

        {/* Buttons */}
        {activeSession.status === 'awaiting_approval' && !hasApproved && (
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={handleReject}
              disabled={submitting}
              className="px-5 py-2.5 border border-red-500/20 hover:bg-red-500/5 text-xs font-semibold text-red-400 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            >
              <XCircle size={14} /> Reject Agreement
            </button>
            <button
              onClick={handleApprove}
              disabled={submitting}
              className="px-5 py-2.5 bg-success hover:bg-success/80 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 shadow-lg shadow-success/20 transition cursor-pointer"
            >
              {submitting ? 'Signing...' : (
                <>
                  <CheckCircle size={14} /> Approve & Sign
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReviewApproval
