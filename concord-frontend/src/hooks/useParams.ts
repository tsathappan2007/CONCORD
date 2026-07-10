import { useState, useEffect } from 'react'

export function useParams() {
  const [params, setParams] = useState<Record<string, string>>({})

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#/'
      const parts = hash.split('/')
      const newParams: Record<string, string> = {}

      // Matches: #/session/:id/setup or #/session/:id/room or #/join/:id
      if (parts[1] === 'session' && parts[2]) {
        newParams.id = parts[2]
      } else if (parts[1] === 'join' && parts[2]) {
        newParams.id = parts[2]
      }
      
      setParams(newParams)
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return params
}
