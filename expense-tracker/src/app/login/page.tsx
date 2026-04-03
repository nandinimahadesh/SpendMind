'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'http://localhost:3000' }
    })
    if (error) setErr(error.message); else setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/70 rounded-2xl shadow p-6">
        <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
        {sent ? (
          <p>Check your email for the sign-in link.</p>
        ) : (
          <form onSubmit={sendMagicLink} className="space-y-4">
            <input
              type="email"
              className="w-full border rounded-xl px-3 py-2"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {err && <p className="text-red-600 text-sm">{err}</p>}
            <button className="w-full bg-black text-white rounded-xl py-2">
              Send Magic Link
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
