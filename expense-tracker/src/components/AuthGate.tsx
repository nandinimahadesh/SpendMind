'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | undefined
    let didRedirect = false

    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        didRedirect = true
        router.replace('/login')
        return
      }
      setReady(true)
      const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
        if (!sess && !didRedirect) {
          didRedirect = true
          router.replace('/login')
        }
      })
      unsub = () => sub.subscription.unsubscribe()
    })().finally(() => setChecking(false))

    return () => { if (unsub) unsub() }
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-sm text-gray-500">Checking sign-in…</span>
      </div>
    )
  }

  if (!ready) return null
  return <>{children}</>
}
