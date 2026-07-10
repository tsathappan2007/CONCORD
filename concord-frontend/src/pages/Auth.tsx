import React, { useState } from 'react'
import { supabase } from '../context/AuthContext'
import { motion } from 'framer-motion'
import { LogIn, Key, Mail, UserPlus, AlertCircle } from 'lucide-react'

interface AuthProps {
  navigate: (path: string) => void
}

const Auth: React.FC<AuthProps> = ({ navigate }) => {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        setSuccessMsg('Sign up successful! Please check your email for confirmation.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        navigate('#/dashboard')
      }
    } catch (err: any) {
      let msg = err.message || 'Authentication failed. Please verify credentials.'
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('email rate')) {
        msg = 'Supabase Auth email rate limit exceeded. To bypass this and sign up/log in instantly without email confirmations, please go to your Supabase Project Dashboard -> Authentication -> Providers -> Email, and disable "Confirm Email".'
      }
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-gray-100 flex flex-col justify-center items-center px-6">
      {/* Back button */}
      <button
        onClick={() => navigate('#/')}
        className="absolute top-6 left-6 text-sm text-gray-400 hover:text-white transition duration-150"
      >
        &larr; Back to Home
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md p-8 rounded-2xl bg-panel border border-borderLight shadow-xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
            <span className="font-bold text-white text-xl">C</span>
          </div>
          <h2 className="text-2xl font-bold text-white">
            {isSignUp ? 'Create your Account' : 'Welcome to CONCORD'}
          </h2>
          <p className="text-sm text-gray-400 mt-2">
            {isSignUp ? 'Engineering agreements starts here.' : 'Sign in to access your negotiations.'}
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
            <Mail className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-borderLight rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-accent transition duration-150"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-borderLight rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-accent transition duration-150"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent hover:bg-accentHover disabled:bg-accent/50 text-white font-medium rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-accent/25 transition duration-150 mt-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
            ) : isSignUp ? (
              <>
                <UserPlus size={18} /> Sign Up
              </>
            ) : (
              <>
                <LogIn size={18} /> Sign In
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-borderLight text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setErrorMsg(null)
              setSuccessMsg(null)
            }}
            className="text-sm text-accent hover:underline focus:outline-none"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default Auth
