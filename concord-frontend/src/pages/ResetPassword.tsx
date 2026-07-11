import React, { useState } from 'react'
import { supabase } from '../context/AuthContext'
import { motion } from 'framer-motion'
import { Key, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'

interface ResetPasswordProps {
  navigate: (path: string) => void
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ navigate }) => {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setSuccessMsg('Your password has been successfully reset!')
      setTimeout(() => {
        navigate('#/dashboard')
      }, 2000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password. Link might be expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-gray-100 flex flex-col justify-center items-center px-6">
      <button
        onClick={() => navigate('#/auth')}
        className="absolute top-6 left-6 text-sm text-gray-400 hover:text-white flex items-center gap-2 transition duration-150 cursor-pointer"
      >
        <ArrowLeft size={16} /> Back to Login
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md p-8 rounded-2xl bg-panel border border-borderLight shadow-xl"
      >
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.jpg" alt="CONCORD logo" className="w-12 h-12 rounded-xl object-cover mb-4" />
          <h2 className="text-2xl font-bold text-white">Choose New Password</h2>
          <p className="text-sm text-gray-400 mt-2 text-center">
            Set a strong and secure password for your account.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              New Password
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password (min 6 chars)"
                className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-borderLight rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-accent transition duration-150"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-borderLight rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-accent transition duration-150"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent hover:bg-accentHover disabled:bg-accent/50 text-white font-medium rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-accent/25 transition duration-150 mt-2 cursor-pointer"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <Key size={18} /> Update Password
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

export default ResetPassword
