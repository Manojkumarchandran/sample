'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function CreateProjectForm() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const form = event.currentTarget
    const data = new FormData(form)
    const title = String(data.get('title') || '').trim()
    const description = String(data.get('description') || '').trim()
    if (!title) { setError('Enter a project title.'); return }

    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session?.access_token) throw new Error('Your session expired. Sign in again and retry.')
      const response = await fetch(`${apiUrl}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ title, description: description || null }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.detail || `Could not create project (${response.status}).`)
      form.reset()
      setSuccess('Project created successfully.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the project.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-4">
      <input name="title" placeholder="Project title" required maxLength={120} className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900" />
      <textarea name="description" placeholder="Project description (optional)" className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900" />
      <button type="submit" disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50">{saving ? 'Creating…' : 'Create Project'}</button>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
    </form>
  )
}
