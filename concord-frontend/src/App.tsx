import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import SessionCreate from './pages/SessionCreate'
import NegotiationRoom from './pages/NegotiationRoom'
import ReviewApproval from './pages/ReviewApproval'
import JoinSession from './pages/JoinSession'
import ResetPassword from './pages/ResetPassword'
import { RefreshCw } from 'lucide-react'
import { GalaxyBackground } from './components/Galaxy/GalaxyBackground'

const AppContent: React.FC = () => {
  const { user, loading } = useAuth()
  const [currentPath, setCurrentPath] = useState(window.location.hash || '#/')

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(window.location.hash || '#/')
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const navigate = (path: string) => {
    window.location.hash = path
    setCurrentPath(path)
  }

  // Auth Guards loading page
  if (loading) {
    return (
      <div className="min-h-screen bg-background text-gray-100 flex justify-center items-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-accent animate-spin" />
          <span className="text-sm text-gray-400">Loading CONCORD...</span>
        </div>
      </div>
    )
  }

  // Routing Handler
  // 1. Join routes (handles internal login forwarding)
  if (currentPath.startsWith('#/join/')) {
    return <JoinSession navigate={navigate} />
  }

  // 2. Unauthenticated paths
  if (!user) {
    if (currentPath === '#/auth') {
      return <Auth navigate={navigate} />
    }
    return <Landing navigate={navigate} />
  }

  // 3. Authenticated paths
  if (currentPath === '#/reset-password') {
    return <ResetPassword navigate={navigate} />
  }

  if (currentPath === '#/' || currentPath === '#/auth') {
    // Authenticated users shouldn't see landing/auth pages, redirect to dashboard
    navigate('#/dashboard')
    return <Dashboard navigate={navigate} />
  }

  if (currentPath === '#/dashboard') {
    return <Dashboard navigate={navigate} />
  }

  if (currentPath.includes('/setup')) {
    return <SessionCreate navigate={navigate} />
  }

  if (currentPath.includes('/room')) {
    return <NegotiationRoom navigate={navigate} />
  }

  if (currentPath.includes('/review')) {
    return <ReviewApproval navigate={navigate} />
  }

  // Fallback to Dashboard
  return <Dashboard navigate={navigate} />
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <div className="relative min-h-screen">
        <GalaxyBackground />
        <AppContent />
      </div>
    </AuthProvider>
  )
}

export default App
