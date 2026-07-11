import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Zap, ChevronRight, Scale } from 'lucide-react'

interface LandingProps {
  navigate: (path: string) => void
}

const Landing: React.FC<LandingProps> = ({ navigate }) => {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setScrolled(true)
      } else {
        setScrolled(false)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-transparent text-gray-100 flex flex-col relative overflow-hidden select-none">
      {/* Decorative Radial Glows (Apple/Linear Style Lens Bloom) */}
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-accent/3 rounded-full blur-[140px] pointer-events-none -z-5" />
      <div className="absolute top-[40%] left-1/4 w-[600px] h-[600px] bg-indigo-500/2 rounded-full blur-[160px] pointer-events-none -z-5" />
      <div className="absolute top-[70%] right-1/4 w-[500px] h-[500px] bg-violet-500/3 rounded-full blur-[150px] pointer-events-none -z-5" />

      {/* Header */}
      <header className="border-b border-borderLight/30 px-6 py-4 flex justify-between items-center bg-[#050505]/40 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="CONCORD logo" className="w-8 h-8 rounded-lg object-cover" />
          <span className="font-semibold text-lg tracking-wider">CONCORD</span>
        </div>
        <button
          onClick={() => navigate('#/auth')}
          className="px-4 py-2 text-sm font-medium bg-zinc-900/80 border border-borderLight/50 rounded-lg hover:bg-zinc-800 hover:text-white transition duration-150 cursor-pointer"
        >
          Sign In
        </button>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-20 flex flex-col items-center text-center justify-center relative z-10">
        
        {/* Intro Tag */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold mb-8 uppercase tracking-widest"
        >
          <Zap size={12} /> Introducing Autonomous Contract Engineering
        </motion.div>

        {/* Hero title */}
        <motion.h1
          initial={{ opacity: 0, y: 15, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
          className="text-4xl sm:text-6xl font-bold tracking-tight text-white mb-6 leading-tight max-w-3xl font-sans"
        >
          Where agreement is <span className="text-accent">engineered.</span>
        </motion.h1>

        {/* Hero subtext */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: "easeOut" }}
          className="text-base sm:text-lg text-gray-400 mb-12 max-w-2xl leading-relaxed"
        >
          CONCORD is an AI-mediated negotiation platform where autonomous agents represent each party's interests, negotiate terms within private constraints, explain concessions, and await human approval.
        </motion.p>

        {/* Hero Actions */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: "easeOut" }}
          className="flex flex-col sm:flex-row gap-4 mb-28"
        >
          <button
            onClick={() => navigate('#/auth')}
            className="px-8 py-4 bg-accent hover:bg-accentHover text-white font-medium rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-accent/25 transition duration-150 cursor-pointer"
          >
            Get Started <ChevronRight size={16} />
          </button>
          <a
            href="#features"
            className="px-8 py-4 bg-zinc-900/60 border border-borderLight/40 hover:bg-zinc-800 text-gray-300 font-medium rounded-xl flex items-center justify-center transition duration-150"
          >
            Learn More
          </a>
        </motion.div>

        {/* Scroll To Explore Indicator */}
        <AnimatePresence>
          {!scrolled && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6, y: [0, 6, 0] }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              transition={{
                y: { duration: 2.0, repeat: Infinity, ease: "easeInOut" },
                opacity: { duration: 0.4 }
              }}
              className="absolute bottom-10 flex flex-col items-center gap-1.5 text-[10px] text-gray-500 tracking-wider pointer-events-none"
            >
              <span>SCROLL TO EXPLORE</span>
              <span className="text-xs">↓</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature Grid with Smooth Viewport Fade-In */}
        <section id="features" className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left mt-16 w-full">
          <motion.div
            initial={{ opacity: 0, y: 25, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="p-6 rounded-2xl bg-panel border border-borderLight/30 hover:border-accent/30 transition duration-150"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4">
              <Shield size={20} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Private Constraints</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Define your walk-away points and targets. Your limits are cryptographically isolated and never shared with the counterparty.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 25, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="p-6 rounded-2xl bg-panel border border-borderLight/30 hover:border-accent/30 transition duration-150"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Zap size={20} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">AI Turn Engine</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Watch autonomous agents play turns using structured tool calls, explain compromises, and resolve trade-offs in real-time.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 25, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="p-6 rounded-2xl bg-panel border border-borderLight/30 hover:border-accent/30 transition duration-150"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <Scale size={20} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Neutral Mediator</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Stuck on complex terms? The neutral mediator steps in to find mathematical compromises within both parties' parameters.
            </p>
          </motion.div>
        </section>

        {/* Pricing Section with Viewport Transitions */}
        <section id="pricing" className="w-full mt-32 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-white mb-3">Simple, Transparent Pricing</h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto">Choose the plan that fits your agreement engineering needs.</p>
          </motion.div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            {/* Freemium */}
            <motion.div
              initial={{ opacity: 0, y: 25, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="p-6 rounded-2xl bg-panel/60 border border-borderLight/30 flex flex-col justify-between h-full hover:border-borderLight transition"
            >
              <div>
                <h3 className="text-base font-bold text-white mb-2">Freemium</h3>
                <div className="text-3xl font-black text-white mb-6">Free</div>
                <ul className="text-xs text-gray-400 space-y-3 mb-8">
                  <li className="flex items-center gap-2">
                    <span className="text-accent font-bold">✓</span> 2 negotiations/month
                  </li>
                </ul>
              </div>
              <button
                onClick={() => navigate('#/auth')}
                className="w-full py-2.5 bg-zinc-900 border border-borderLight/30 hover:bg-zinc-800 text-xs font-semibold text-white rounded-xl transition cursor-pointer text-center"
              >
                Get Started
              </button>
            </motion.div>

            {/* Premium Individual */}
            <motion.div
              initial={{ opacity: 0, y: 25, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="p-6 rounded-2xl bg-panel/60 border border-accent/40 relative flex flex-col justify-between h-full shadow-lg shadow-accent/5 hover:border-accent transition"
            >
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
                onClick={() => navigate('#/auth')}
                className="w-full py-2.5 bg-accent hover:bg-accentHover text-xs font-semibold text-white rounded-xl shadow-lg shadow-accent/20 transition cursor-pointer text-center"
              >
                Upgrade Now
              </button>
            </motion.div>

            {/* Business Plan */}
            <motion.div
              initial={{ opacity: 0, y: 25, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="p-6 rounded-2xl bg-panel/60 border border-borderLight/30 flex flex-col justify-between h-full hover:border-borderLight transition"
            >
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
                onClick={() => navigate('#/auth')}
                className="w-full py-2.5 bg-zinc-900 border border-borderLight/30 hover:bg-zinc-800 text-xs font-semibold text-white rounded-xl transition cursor-pointer text-center"
              >
                Choose Business
              </button>
            </motion.div>

            {/* Enterprise */}
            <motion.div
              initial={{ opacity: 0, y: 25, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="p-6 rounded-2xl bg-panel/60 border border-borderLight/30 flex flex-col justify-between h-full hover:border-borderLight transition"
            >
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
                onClick={() => navigate('#/auth')}
                className="w-full py-2.5 bg-zinc-900 border border-borderLight/30 hover:bg-zinc-800 text-xs font-semibold text-white rounded-xl transition cursor-pointer text-center"
              >
                Contact Sales
              </button>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-borderLight/30 px-6 py-8 bg-[#050505]/60 z-10">
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
