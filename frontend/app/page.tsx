'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      setStatus('sample mode')
      return
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`)
      .then((r) => r.json())
      .then((d) => setStatus(d.status))
      .catch(() => setStatus('unreachable'))
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-50 text-slate-900">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">NexTask AI</h1>
        <p className="text-slate-600 mb-6">AI-Augmented Collaborative Workspace</p>
        <p className="text-xs uppercase tracking-wider text-slate-400 mb-6">Backend Status: <span className="font-semibold text-slate-700">{status}</span></p>
        <Link
          href="/dashboard"
          className="inline-block w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium transition"
        >
          Open Workspace
        </Link>
      </div>
    </main>
  )
}
