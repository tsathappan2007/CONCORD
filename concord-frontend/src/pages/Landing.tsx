import React from 'react'
import { motion } from 'framer-motion'
import { Shield, Zap, ChevronRight, Scale } from 'lucide-react'

interface LandingProps {
  navigate: (path: string) => void
}

const Landing: React.FC<LandingProps> = ({ navigate }) => {
  return (
    <div className="min-h-screen bg-background text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-borderLight px-6 py-4 flex justify-between items-center bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="font-bold text-white text-lg">C</span>
          </div>
          <span className="font-semibold text-lg tracking-wider">CONCORD</span>
        </div>
        <button
          onClick={() => navigate('#/auth')}
          className="px-4 py-2 text-sm font-medium bg-zinc-900 border border-borderLight rounded-lg hover:bg-zinc-800 transition duration-150"
        >
          Sign In
        </button>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-20 flex flex-col items-center text-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold mb-6 uppercase tracking-widest"
        >
          <Zap size={12} /> Introducing Autonomous Contract Engineering
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl font-bold tracking-tight text-white mb-6 leading-tight max-w-3xl"
        >
          Where agreement is <span className="text-accent">engineered.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg text-gray-400 mb-10 max-w-2xl leading-relaxed"
        >
          CONCORD is an AI-mediated negotiation platform where autonomous agents represent each party's interests, negotiate terms within private constraints, explain concessions, and await human approval.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 mb-20"
        >
          <button
            onClick={() => navigate('#/auth')}
            className="px-8 py-4 bg-accent hover:bg-accentHover text-white font-medium rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-accent/20 transition duration-150"
          >
            Get Started <ChevronRight size={16} />
          </button>
          <a
            href="#features"
            className="px-8 py-4 bg-zinc-900 border border-borderLight hover:bg-zinc-800 text-gray-300 font-medium rounded-xl flex items-center justify-center transition duration-150"
          >
            Learn More
          </a>
        </motion.div>

        {/* Feature Grid */}
        <section id="features" className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left mt-10">
          <div className="p-6 rounded-2xl bg-panel border border-borderLight">
            <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4">
              <Shield size={20} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Private Constraints</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Define your walk-away points and targets. Your limits are cryptographically isolated and never shared with the counterparty.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-panel border border-borderLight">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Zap size={20} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">AI Turn Engine</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Watch autonomous agents play turns using structured tool calls, explain compromises, and resolve trade-offs in real-time.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-panel border border-borderLight">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <Scale size={20} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Neutral Mediator</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Stuck on complex terms? The neutral mediator steps in to find mathematical compromises within both parties' parameters.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-borderLight px-6 py-8 bg-zinc-950/50 mt-20">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <span>&copy; 2026 CONCORD Inc. All rights reserved.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-gray-400">Terms</a>
            <a href="#" className="hover:text-gray-400">Privacy</a>
            <a href="#" className="hover:text-gray-400">Security</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
