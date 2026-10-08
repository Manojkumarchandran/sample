'use client'

import { FormEvent, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { AgentStatus, type AgentStatusEvent } from './agent-status'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState<AgentStatusEvent | null>(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const abortController = useRef<AbortController | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = prompt.trim()
    if (!text || sending) return

    setPrompt('')
    setError('')
    setStatus({ action: 'node', label: 'Connecting to NexTask AI...' })
    const assistantIndex = messages.length + 1
    setMessages((current) => [...current, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    setSending(true)

    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session?.access_token) throw new Error('Your session expired. Sign in again and retry.')

      abortController.current = new AbortController()
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: [{ role: 'user', content: text }] }),
        signal: abortController.current.signal,
      })
      if (!response.ok) throw new Error((await response.text()) || `AI request failed (${response.status})`)
      if (!response.body) throw new Error('The AI service returned an empty response stream.')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() || ''

        for (const frame of frames) {
          const line = frame.split('\n').find((part) => part.startsWith('data: '))
          if (!line || line === 'data: [DONE]') continue
          const chunk = JSON.parse(line.slice(6))
          if (chunk.type === 'error') {
            throw new Error(chunk.errorText || 'The AI response failed. Please retry.')
          } else if (chunk.type === 'text-delta') {
            setMessages((current) => current.map((message, index) => index === assistantIndex
              ? { ...message, content: message.content + chunk.delta }
              : message))
          } else if (chunk.type === 'data-status') {
            setStatus(chunk.data)
          }
        }

        if (done) break
      }
      setStatus({ action: 'done', label: 'Ready' })
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') {
        setStatus(null)
        setMessages((current) => current[assistantIndex]?.content
          ? current
          : current.filter((_, index) => index !== assistantIndex))
        return
      }
      setStatus(null)
      setError(cause instanceof Error ? cause.message : 'Could not reach the AI service.')
      setMessages((current) => current.filter((_, index) => index !== assistantIndex))
    } finally {
      abortController.current = null
      setSending(false)
    }
  }

  return (
    <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Ask NexTask AI</h2>
          <p className="text-sm text-slate-500">Gemini-powered workspace assistant</p>
        </div>
        <AgentStatus status={status} />
      </div>

      <div className="mb-4 max-h-96 space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-4" aria-live="polite">
        {!messages.length && <p className="text-sm text-slate-500">Ask a question to get started. AI responses require the backend and a Gemini API key.</p>}
        {messages.map((message, index) => (
          <div key={`${index}-${message.role}`} className={`rounded-lg p-3 text-sm ${message.role === 'user' ? 'ml-8 bg-slate-900 text-white' : 'mr-8 border bg-white text-slate-700'}`}>
            <p className="mb-1 text-xs font-semibold opacity-70">{message.role === 'user' ? 'You' : 'NexTask AI'}</p>
            <p className="whitespace-pre-wrap">{message.content || (sending && index === messages.length - 1 ? 'Thinking…' : '')}</p>
          </div>
        ))}
      </div>

      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={submit} className="flex gap-3">
        <input value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={8000} placeholder="Ask about your workspace or a topic…" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900" disabled={sending} />
        {sending ? (
          <button type="button" onClick={() => abortController.current?.abort()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Stop</button>
        ) : (
          <button type="submit" disabled={!prompt.trim()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Ask AI</button>
        )}
      </form>
    </section>
  )
}
