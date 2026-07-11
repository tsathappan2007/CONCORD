import React, { useState, useEffect } from 'react'
import { useParams } from '../hooks/useParams' // Simple hash parameter hook
import { useAuth } from '../context/AuthContext'
import { supabase } from '../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, AlertTriangle, Plus, Trash2, Shield, Play, LogOut, Eye } from 'lucide-react'

interface SessionCreateProps {
  navigate: (path: string) => void
}

interface Term {
  name: string
  type: 'numeric' | 'date' | 'select'
  preferred: string
  walkaway_min?: string
  walkaway_max?: string
  walkaway_earliest?: string
  walkaway_latest?: string
  walkaway_exclude?: string[]
  priority: 'high' | 'medium' | 'low'
}

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const SessionCreate: React.FC<SessionCreateProps> = ({ navigate }) => {
  const { id } = useParams()
  const { user, session } = useAuth()
  
  const [sessionTitle, setSessionTitle] = useState('Loading session...')
  const [role, setRole] = useState<'party_a' | 'party_b'>('party_a')
  const [file, setFile] = useState<File | null>(null)
  
  const [uploading, setUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [warningMsg, setWarningMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [forceOcr, setForceOcr] = useState(false)

  const [supportingFiles, setSupportingFiles] = useState<any[]>([])
  const [uploadingSupporting, setUploadingSupporting] = useState(false)

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

  const handleDownloadSupportingFile = async (filename: string) => {
    if (!id || !session) return
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/sessions/${id}/supporting/${encodeURIComponent(filename)}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      if (!response.ok) throw new Error('Failed to get download URL')
      const data = await response.json()
      if (data && data.url) {
        window.open(data.url, '_blank')
      }
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to open document.')
    }
  }

  // Progress modal states
  const [showParsingModal, setShowParsingModal] = useState(false)
  const [parsingStep, setParsingStep] = useState<'validating' | 'structuring' | 'finalizing' | 'success' | 'error'>('validating')
  const [parsingProgress, setParsingProgress] = useState(0)
  const [parsingError, setParsingError] = useState<string | null>(null)

  // Form State for Terms
  const [terms, setTerms] = useState<Term[]>([
    { name: 'hourly_rate', type: 'numeric', preferred: '120', walkaway_min: '90', walkaway_max: '160', priority: 'high' }
  ])

  useEffect(() => {
    // Fetch session details to figure out title and role
    const fetchSessionMeta = async () => {
      if (!id || !user) return
      try {
        const { data, error } = await supabase
          .from('negotiation_sessions')
          .select('*')
          .eq('id', id)
          .single()
        
        if (error) throw error
        setSessionTitle(data.title)
        
        // Determine role
        if (data.party_b_id === user.id) {
          setRole('party_b')
        } else {
          setRole('party_a')
        }
      } catch (err) {
        console.error(err)
        setErrorMsg('Failed to load session metadata.')
      }
    }
    fetchSessionMeta()
    if (id) {
      fetchSupportingFiles()
    }
  }, [id, user])

  // Drag and drop controls
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0])
    }
  }

  const handleFileSelection = (selectedFile: File) => {
    setErrorMsg(null)
    setWarningMsg(null)
    setSuccessMsg(null)

    // Client-side quick checks
    const ext = selectedFile.name.split('.').pop()?.toLowerCase()
    if (!ext || !['pdf', 'docx', 'txt'].includes(ext)) {
      setErrorMsg('Unsupported file format. Please upload a PDF, DOCX, or TXT file.')
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setErrorMsg('File exceeds the 10MB size limit.')
      return
    }

    setFile(selectedFile)
  }

  const parseAndExtract = async () => {
    if (!file || !user) return
    
    // Reset modal states
    setShowParsingModal(true)
    setParsingStep('validating')
    setParsingProgress(5)
    setParsingError(null)
    setUploading(true)
    setErrorMsg(null)
    setWarningMsg(null)
    setSuccessMsg(null)

    // Start progress animation for validating phase (reaches max 45%)
    const validatingInterval = setInterval(() => {
      setParsingProgress((prev) => {
        if (prev < 45) return prev + Math.floor(Math.random() * 4) + 1
        return prev
      })
    }, 150)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('force_ocr', forceOcr.toString())

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/documents/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: formData
      })

      clearInterval(validatingInterval)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'Document validation failed.')
      }

      setParsingProgress(50)
      setParsingStep('structuring')

      // Start progress animation for structuring phase (reaches max 90%)
      const structuringInterval = setInterval(() => {
        setParsingProgress((prev) => {
          if (prev < 90) return prev + Math.floor(Math.random() * 3) + 1
          return prev
        })
      }, 200)

      // Automatically extract candidate structured terms from text
      const structureSuccess = await extractStructuredTerms(data.text)
      
      clearInterval(structuringInterval)
      
      if (!structureSuccess) {
        throw new Error('AI analysis of contract terms failed.')
      }

      setParsingProgress(95)
      setParsingStep('finalizing')
      
      setTimeout(() => {
        setParsingProgress(100)
        setParsingStep('success')
        setSuccessMsg(`✓ Document verified — ${data.word_count} words extracted`)
        if (data.warning) {
          setWarningMsg(data.warning)
        }
        
        // Auto close modal after a short delay
        setTimeout(() => {
          setShowParsingModal(false)
          setUploading(false)
        }, 1000)
      }, 600)

    } catch (err: any) {
      clearInterval(validatingInterval)
      const errMsg = err.message || 'Parsing failed.'
      setParsingError(errMsg)
      setParsingStep('error')
      setErrorMsg(errMsg)
      setFile(null)
      setUploading(false)
    }
  }

  const extractStructuredTerms = async (extractedText: string): Promise<boolean> => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/documents/structure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ text: extractedText })
      })

      const data = await response.json()
      if (data.success && data.terms) {
        // Pre-fill terms list
        const newTerms: Term[] = Object.entries(data.terms).map(([name, schema]: [string, any]) => ({
          name,
          type: schema.type,
          preferred: schema.preferred,
          walkaway_min: schema.walkaway_min || undefined,
          walkaway_max: schema.walkaway_max || undefined,
          walkaway_earliest: schema.walkaway_earliest || undefined,
          walkaway_latest: schema.walkaway_latest || undefined,
          walkaway_exclude: schema.walkaway_exclude || [],
          priority: schema.priority || 'medium'
        }))
        if (newTerms.length > 0) {
          setTerms(newTerms)
        }
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to extract structured candidate terms:', err)
      return false
    }
  }

  const addTermField = () => {
    setTerms([...terms, { name: '', type: 'numeric', preferred: '', priority: 'medium' }])
  }

  const removeTermField = (index: number) => {
    setTerms(terms.filter((_, i) => i !== index))
  }

  const updateTermField = (index: number, key: keyof Term, value: any) => {
    const updated = [...terms]
    updated[index] = { ...updated[index], [key]: value }
    setTerms(updated)
  }

  const handleSubmitConstraints = async () => {
    // 1. Structure the terms to payload format
    const structuredConstraints: Record<string, any> = {}
    for (const term of terms) {
      if (!term.name.trim()) continue
      
      const param: Record<string, any> = {
        type: term.type,
        preferred: term.preferred,
        priority: term.priority
      }
      
      if (term.type === 'numeric') {
        if (term.walkaway_min) param.walkaway_min = term.walkaway_min
        if (term.walkaway_max) param.walkaway_max = term.walkaway_max
      } else if (term.type === 'date') {
        if (term.walkaway_earliest) param.walkaway_earliest = term.walkaway_earliest
        if (term.walkaway_latest) param.walkaway_latest = term.walkaway_latest
      } else {
        if (term.walkaway_exclude) param.walkaway_exclude = term.walkaway_exclude
      }
      
      structuredConstraints[term.name.trim()] = param
    }

    if (Object.keys(structuredConstraints).length === 0) {
      setErrorMsg('Please configure at least one constraint term.')
      return
    }

    try {
      // Post constraints
      const res = await fetch(`${apiBaseUrl}/api/v1/sessions/${id}/constraints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          role,
          raw_text: file ? file.name : 'Manually Entered Constraints',
          structured_constraints: structuredConstraints
        })
      })

      if (!res.ok) throw new Error('Failed to save constraints')

      // Set ready
      const readyRes = await fetch(`${apiBaseUrl}/api/v1/sessions/${id}/ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ role })
      })

      if (!readyRes.ok) throw new Error('Failed to submit ready status')
      
      navigate(`#/session/${id}/room`)

    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed.')
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-gray-100 p-8 max-w-5xl mx-auto overflow-y-auto">
      <header className="mb-10 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white truncate max-w-xl">{sessionTitle}</h1>
          <p className="text-sm text-gray-400 mt-1">Configure your private negotiation parameters. These limits are only visible to your agent.</p>
        </div>
        <button
          onClick={() => navigate('#/dashboard')}
          className="px-4 py-2 bg-zinc-900 border border-borderLight hover:bg-zinc-800 text-xs font-semibold text-red-400 hover:text-red-300 rounded-xl flex items-center gap-1.5 transition duration-150 cursor-pointer"
        >
          <LogOut size={12} className="rotate-180 text-red-400" /> Exit Setup
        </button>
      </header>

      {errorMsg && (
        <div className="p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {errorMsg}
        </div>
      )}

      {warningMsg && (
        <div className="p-4 mb-6 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{warningMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {successMsg}
        </div>
      )}

      {/* Grid: Upload vs Form builder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Zone */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-2xl bg-panel border border-borderLight">
            <h3 className="text-md font-bold text-white mb-4">1. Document Upload</h3>
            
            <div className="relative min-h-[170px] flex items-center justify-center">
              <AnimatePresence mode="wait">
                {!file ? (
                  <motion.div
                    key="upload-dropzone"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className="w-full border-2 border-dashed border-zinc-800 hover:border-accent rounded-xl p-8 text-center cursor-pointer transition duration-150"
                    onClick={() => document.getElementById('file-picker')?.click()}
                  >
                    <Upload className="mx-auto w-10 h-10 text-gray-500 mb-4 animate-bounce" />
                    <div className="text-sm text-gray-300 font-medium">Click or Drag Contract</div>
                    <div className="text-xs text-gray-500 mt-2">Supports PDF, DOCX, TXT (10MB max)</div>
                    
                    <input
                      id="file-picker"
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.txt"
                      onChange={handleFileChange}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="file-details"
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25 }}
                    className="w-full border border-accent/30 bg-zinc-900/80 rounded-xl p-6 text-center space-y-4 shadow-lg flex flex-col justify-between"
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center text-accent">
                        <FileText size={24} />
                      </div>
                      <div className="text-sm font-semibold text-white truncate max-w-full px-4" title={file.name}>
                        {file.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setFile(null)
                          setErrorMsg(null)
                          setWarningMsg(null)
                          setSuccessMsg(null)
                        }}
                        className="flex-1 py-2 bg-zinc-950 border border-borderLight hover:bg-zinc-900 text-xs font-semibold text-red-400 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                      <button
                        onClick={parseAndExtract}
                        disabled={uploading}
                        className="flex-1 py-2 bg-accent hover:bg-accentHover disabled:bg-accent/50 text-xs font-semibold text-white rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        {uploading ? 'Parsing...' : 'Analyze'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                id="ocr-toggle"
                type="checkbox"
                checked={forceOcr}
                onChange={(e) => setForceOcr(e.target.checked)}
                className="rounded border-zinc-800 text-accent focus:ring-accent bg-zinc-950"
              />
              <label htmlFor="ocr-toggle" className="text-xs text-gray-400 select-none cursor-pointer">
                Enable Multimodal OCR (Scanned PDFs)
              </label>
            </div>
          </div>

          {/* Supporting Documents Card */}
          <div className="p-6 rounded-2xl bg-panel border border-borderLight">
            <h3 className="text-md font-bold text-white mb-2">Supporting Documents</h3>
            <p className="text-xs text-gray-400 mb-4">Upload extra files (briefs, specifications, schedules) for the counterparty to download.</p>
            
            <div className="space-y-4">
              <label
                className="w-full border border-dashed border-zinc-800 hover:border-accent rounded-xl p-4 text-center cursor-pointer transition duration-150 flex flex-col items-center justify-center gap-1.5"
                onClick={() => document.getElementById('supporting-file-picker')?.click()}
              >
                <Upload size={16} className="text-gray-500" />
                <span className="text-xs font-semibold text-gray-300">
                  {uploadingSupporting ? 'Uploading...' : 'Click to Upload Supporting Doc'}
                </span>
                <input
                  id="supporting-file-picker"
                  type="file"
                  className="hidden"
                  onChange={handleUploadSupportingFile}
                  disabled={uploadingSupporting}
                />
              </label>

              {supportingFiles.length > 0 && (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {supportingFiles.map((f) => (
                    <div key={f.name} className="p-2.5 rounded-lg bg-zinc-900 border border-borderLight/40 flex items-center justify-between gap-3">
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
                        <button
                          onClick={() => handleDeleteSupportingFile(f.name)}
                          className="p-1 rounded bg-zinc-950 border border-borderLight hover:border-red-500/30 hover:text-red-400 text-gray-400 transition cursor-pointer"
                          title="Delete Document"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-950 border border-borderLight text-xs text-gray-400 space-y-3">
            <div className="flex gap-2 items-start text-white font-semibold">
              <Shield className="w-4 h-4 text-accent mt-0.5" />
              <span>Concord Security Guarantee</span>
            </div>
            <p>
              Your constraints, walk-away boundaries, and priorities are never sent to the other side or visible to the counterparty agent. Only final compromises are suggested.
            </p>
          </div>
        </div>

        {/* Constraint Form builder */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-panel border border-borderLight">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-md font-bold text-white">2. Parameter Constraints Configuration</h3>
            <button
              onClick={addTermField}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-gray-300 rounded-lg flex items-center gap-1 transition duration-150"
            >
              <Plus size={12} /> Add Term
            </button>
          </div>

          <div className="space-y-4">
            {terms.map((term, index) => (
              <div key={index} className="p-4 bg-zinc-900/60 border border-borderLight rounded-xl relative space-y-4">
                <button
                  type="button"
                  onClick={() => removeTermField(index)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-red-400 transition"
                >
                  <Trash2 size={14} />
                </button>

                {/* Term Name & Type */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Term Name</label>
                    <input
                      type="text"
                      required
                      value={term.name}
                      onChange={(e) => updateTermField(index, 'name', e.target.value)}
                      placeholder="e.g. hourly_rate"
                      className="w-full px-3 py-2 bg-zinc-950 border border-borderLight rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Type</label>
                    <select
                      value={term.type}
                      onChange={(e) => updateTermField(index, 'type', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-borderLight rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                    >
                      <option value="numeric">Numeric Value</option>
                      <option value="date">Target Date</option>
                      <option value="select">Categorical (Text)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Priority</label>
                    <select
                      value={term.priority}
                      onChange={(e) => updateTermField(index, 'priority', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-borderLight rounded-lg text-xs text-white focus:outline-none"
                    >
                      <option value="high">High Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="low">Low Priority</option>
                    </select>
                  </div>
                </div>

                {/* Limits mapping based on type */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-zinc-800/50 pt-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Preferred Value</label>
                    <input
                      type="text"
                      required
                      value={term.preferred}
                      onChange={(e) => updateTermField(index, 'preferred', e.target.value)}
                      placeholder={term.type === 'date' ? '2026-12-31' : term.type === 'numeric' ? '120' : 'client'}
                      className="w-full px-3 py-2 bg-zinc-950 border border-borderLight rounded-lg text-xs text-white focus:outline-none"
                    />
                  </div>

                  {term.type === 'numeric' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">Walk-Away Min</label>
                        <input
                          type="text"
                          value={term.walkaway_min || ''}
                          onChange={(e) => updateTermField(index, 'walkaway_min', e.target.value)}
                          placeholder="e.g. 90"
                          className="w-full px-3 py-2 bg-zinc-950 border border-borderLight rounded-lg text-xs text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">Walk-Away Max</label>
                        <input
                          type="text"
                          value={term.walkaway_max || ''}
                          onChange={(e) => updateTermField(index, 'walkaway_max', e.target.value)}
                          placeholder="e.g. 150"
                          className="w-full px-3 py-2 bg-zinc-950 border border-borderLight rounded-lg text-xs text-white focus:outline-none"
                        />
                      </div>
                    </>
                  )}

                  {term.type === 'date' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">Walk-Away Earliest</label>
                        <input
                          type="date"
                          value={term.walkaway_earliest || ''}
                          onChange={(e) => updateTermField(index, 'walkaway_earliest', e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-950 border border-borderLight rounded-lg text-xs text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">Walk-Away Latest</label>
                        <input
                          type="date"
                          value={term.walkaway_latest || ''}
                          onChange={(e) => updateTermField(index, 'walkaway_latest', e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-950 border border-borderLight rounded-lg text-xs text-white focus:outline-none"
                        />
                      </div>
                    </>
                  )}

                  {term.type === 'select' && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Excluded Selections (Comma Separated)</label>
                      <input
                        type="text"
                        value={term.walkaway_exclude?.join(', ') || ''}
                        onChange={(e) => updateTermField(index, 'walkaway_exclude', e.target.value.split(',').map((s: string) => s.trim()))}
                        placeholder="contractor, shared"
                        className="w-full px-3 py-2 bg-zinc-950 border border-borderLight rounded-lg text-xs text-white focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button
              onClick={handleSubmitConstraints}
              className="px-6 py-3 bg-accent hover:bg-accentHover text-xs font-bold text-white rounded-xl flex items-center gap-1.5 shadow-lg shadow-accent/25 transition duration-150"
            >
              <Play size={14} /> Save & Launch Agent
            </button>
          </div>
        </div>
      </div>

      {showParsingModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex justify-center items-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md p-8 bg-panel border border-borderLight rounded-2xl shadow-2xl text-center space-y-6"
          >
            {/* Spinning Loader / Success check / Error cross */}
            <div className="flex justify-center">
              {parsingStep === 'error' ? (
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                  <AlertTriangle size={32} />
                </div>
              ) : parsingStep === 'success' ? (
                <div className="w-16 h-16 rounded-full bg-success/15 border border-success/20 flex items-center justify-center text-success animate-bounce">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="relative w-20 h-20">
                  {/* Outer spinning ring */}
                  <div className="absolute inset-0 border-4 border-zinc-800 border-t-accent rounded-full animate-spin"></div>
                  {/* Inner breathing ring */}
                  <div className="absolute inset-2 border-4 border-dashed border-zinc-700/60 rounded-full animate-pulse"></div>
                  {/* Center percentage */}
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-200">
                    {parsingProgress}%
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">
                {parsingStep === 'validating' && 'Reading Contract'}
                {parsingStep === 'structuring' && 'Analyzing with AI'}
                {parsingStep === 'finalizing' && 'Generating Fields'}
                {parsingStep === 'success' && 'Analysis Completed!'}
                {parsingStep === 'error' && 'Analysis Failed'}
              </h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                {parsingStep === 'validating' && 'Uploading document & validating structure...'}
                {parsingStep === 'structuring' && 'Identifying commercial clauses and key term candidates...'}
                {parsingStep === 'finalizing' && 'Mapping values, priorities, and boundaries to constraint form...'}
                {parsingStep === 'success' && 'Ready to review and save parameters!'}
                {parsingStep === 'error' && (parsingError || 'An error occurred during analysis.')}
              </p>
            </div>

            {/* Progress bar */}
            {parsingStep !== 'error' && (
              <div className="space-y-2">
                <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-borderLight/30">
                  <div
                    className={`h-full transition-all duration-300 ${
                      parsingStep === 'success' ? 'bg-success' : 'bg-accent'
                    }`}
                    style={{ width: `${parsingProgress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Progress</span>
                  <span>{parsingProgress}%</span>
                </div>
              </div>
            )}

            {/* Error Actions */}
            {parsingStep === 'error' && (
              <button
                onClick={() => setShowParsingModal(false)}
                className="w-full py-2.5 bg-zinc-900 border border-borderLight hover:bg-zinc-800 text-xs font-semibold text-white rounded-xl transition duration-150 cursor-pointer"
              >
                Close & Try Again
              </button>
            )}
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default SessionCreate
