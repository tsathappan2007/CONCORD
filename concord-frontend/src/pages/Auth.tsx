import React, { useState } from 'react'
import { supabase } from '../context/AuthContext'
import { motion } from 'framer-motion'
import { LogIn, Key, Mail, UserPlus, AlertCircle, Eye, EyeOff, ArrowLeft, Phone } from 'lucide-react'

interface AuthProps {
  navigate: (path: string) => void
}

const Auth: React.FC<AuthProps> = ({ navigate }) => {
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Forgot Password States
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState<string | null>(null)
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null)

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
          options: {
            data: {
              name,
              phone
            }
          }
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



  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotPasswordError(null)
    setForgotPasswordSuccess(null)
    setForgotPasswordLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/#/reset-password`
      })
      if (error) throw error
      setForgotPasswordSuccess('Password reset link sent! Please check your email.')
    } catch (err: any) {
      setForgotPasswordError(err.message || 'Failed to send password reset email.')
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-gray-100 flex flex-col justify-center items-center px-6">
      {/* Back button */}
      <button
        onClick={() => {
          if (isForgotPassword) {
            setIsForgotPassword(false)
            setForgotPasswordError(null)
            setForgotPasswordSuccess(null)
          } else {
            navigate('#/')
          }
        }}
        className="absolute top-6 left-6 text-sm text-gray-400 hover:text-white flex items-center gap-2 transition duration-150"
      >
        <ArrowLeft size={16} /> {isForgotPassword ? 'Back to Sign In' : 'Back to Home'}
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md p-8 rounded-2xl bg-panel border border-borderLight shadow-xl"
      >
        {isForgotPassword ? (
          // Forgot Password UI
          <div>
            <div className="flex flex-col items-center mb-8">
              <img src="/logo.jpg" alt="CONCORD logo" className="w-12 h-12 rounded-xl object-cover mb-4" />
              <h2 className="text-2xl font-bold text-white">Reset Password</h2>
              <p className="text-sm text-gray-400 mt-2 text-center">
                Enter your email address and we'll send you a password recovery link.
              </p>
            </div>

            {forgotPasswordError && (
              <div className="p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{forgotPasswordError}</span>
              </div>
            )}

            {forgotPasswordSuccess && (
              <div className="p-4 mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-2">
                <Mail className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{forgotPasswordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    required
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-borderLight rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-accent transition duration-150"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotPasswordLoading}
                className="w-full py-3 bg-accent hover:bg-accentHover disabled:bg-accent/50 text-white font-medium rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-accent/25 transition duration-150"
              >
                {forgotPasswordLoading ? (
                  <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Mail size={18} /> Send Reset Link
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-borderLight text-center">
              <button
                onClick={() => {
                  setIsForgotPassword(false)
                  setForgotPasswordError(null)
                  setForgotPasswordSuccess(null)
                }}
                className="text-sm text-accent hover:underline focus:outline-none"
              >
                Already have an account? Sign In
              </button>
            </div>
          </div>
        ) : (
          // Login / Signup UI
          <div>
            <div className="flex flex-col items-center mb-8">
              <img src="/logo.jpg" alt="CONCORD logo" className="w-12 h-12 rounded-xl object-cover mb-4" />
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
              {isSignUp && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserPlus className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-borderLight rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-accent transition duration-150"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-borderLight rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-accent transition duration-150"
                      />
                    </div>
                  </div>
                </>
              )}

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
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Password
                  </label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true)
                        setErrorMsg(null)
                        setSuccessMsg(null)
                      }}
                      className="text-xs text-accent hover:underline focus:outline-none"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Key className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-3 bg-zinc-950 border border-borderLight rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-accent transition duration-150"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300 transition duration-150 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-accent hover:bg-accentHover disabled:bg-accent/50 text-white font-medium rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-accent/25 transition duration-150 mt-2 cursor-pointer"
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
                className="text-sm text-accent hover:underline focus:outline-none cursor-pointer"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default Auth
