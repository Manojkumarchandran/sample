'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function LoginPage() {
  const [setupRequired, setSetupRequired] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && supabaseKey)

  useEffect(() => {
    setSetupRequired(new URLSearchParams(window.location.search).get('setup') === 'required')
  }, [])

  const signInWithGithub = () => {
    if (!isConfigured) return
    const supabase = createClient()
    supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const signInWithPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const email = username.includes('@') ? username.trim() : `${username.trim().toLowerCase()}@users.nextask.local`
    const { error: authError } = await createClient().auth.signInWithPassword({ email, password })
    if (authError) setError('Username or password is incorrect.')
    else window.location.assign('/dashboard')
    setBusy(false)
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-sm text-center">
        <h1 className="text-2xl font-bold mb-2">NexTask AI</h1>
        <p className="text-sm text-slate-600 mb-6">Sign in to your private workspace</p>
        {!isConfigured && (
          <p role="alert" className="mb-5 rounded-lg bg-amber-50 p-3 text-left text-sm text-amber-800">
            Sign-in is not set up yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to frontend/.env.local, then restart the app.
          </p>
        )}
        {setupRequired && isConfigured && (
          <p role="alert" className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Please sign in to open your workspace.
          </p>
        )}
        <form onSubmit={signInWithPassword} className="mb-4 space-y-3 text-left">
          <label className="block text-sm font-medium text-slate-700">Username
            <input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="e.g. alex_dev" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Password
            <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={!isConfigured || busy} className="w-full rounded-xl bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-600 disabled:opacity-50">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <button
          onClick={signInWithGithub}
          disabled={!isConfigured}
          aria-disabled={!isConfigured}
          className="w-full rounded-xl bg-slate-900 px-5 py-3 text-white font-medium hover:bg-slate-800 transition"
        >
          Continue with GitHub
        </button>
      </div>
    </main>
  )
}
