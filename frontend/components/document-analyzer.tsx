'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Project = { id: string; title: string }

type SuggestedTask = {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  depends_on: string[]
  source_pages: number[]
  subtasks: { title: string; description: string }[]
}

type SuggestedStory = {
  title: string
  milestone: string
  description: string
  tasks: SuggestedTask[]
}

type DocumentAnalysis = {
  summary: string
  key_findings: string[]
  stories: SuggestedStory[]
  open_questions: string[]
}

const MAX_BYTES = 10 * 1024 * 1024
const demoProjectsKey = 'nextask-demo-projects'
const demoTasksKey = 'nextask-demo-tasks'
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function DocumentAnalyzer({ projects = [], demoMode = false }: { projects?: Project[]; demoMode?: boolean }) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null)
  const [error, setError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [demoProjects, setDemoProjects] = useState<Project[]>([])

  useEffect(() => {
    if (!demoMode) return
    const readProjects = () => {
      try {
        const value: unknown = JSON.parse(window.localStorage.getItem(demoProjectsKey) || '[]')
        setDemoProjects(Array.isArray(value) ? value : [])
      } catch {
        setDemoProjects([])
      }
    }
    readProjects()
    window.addEventListener('nextask:demo-projects-changed', readProjects)
    return () => window.removeEventListener('nextask:demo-projects-changed', readProjects)
  }, [demoMode])

  const availableProjects = demoMode ? demoProjects : projects
  const suggestedTaskCount = analysis?.stories.reduce((count, story) => count + story.tasks.length, 0) ?? 0

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    setFile(selected)
    setAnalysis(null)
    setError('')
    setSavedCount(0)
    if (selected && selected.size > MAX_BYTES) {
      setFile(null)
      setError('PDF must be 10 MB or smaller.')
      event.target.value = ''
    } else if (selected && selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      setFile(null)
      setError('Choose a PDF file.')
      event.target.value = ''
    }
  }

  async function saveTasks() {
    if (!analysis || suggestedTaskCount === 0 || !selectedProjectId || saving) return
    setError('')
    setSaving(true)
    const tasks = analysis.stories.flatMap((story) => story.tasks.map((task) => ({
      ...task,
      milestone: story.milestone,
      story: story.title,
      source_document: file?.name ?? null,
    })))
    try {
      if (demoMode) {
        const current: unknown = JSON.parse(window.localStorage.getItem(demoTasksKey) || '[]')
        const storedTasks = Array.isArray(current) ? current : []
        const newTasks = tasks.map((task) => ({ ...task, id: crypto.randomUUID(), project_id: selectedProjectId, status: 'unassigned', created_at: new Date().toISOString() }))
        window.localStorage.setItem(demoTasksKey, JSON.stringify([...storedTasks, ...newTasks]))
        window.dispatchEvent(new Event('nextask:demo-tasks-changed'))
        setSavedCount(newTasks.length)
      } else {
        const { data: { session } } = await createClient().auth.getSession()
        if (!session?.access_token) throw new Error('Your session expired. Sign in again and retry.')
        const response = await fetch(`${apiUrl}/projects/${encodeURIComponent(selectedProjectId)}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ tasks }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.detail || `Could not save tasks (${response.status}).`)
        setSavedCount(Array.isArray(result) ? result.length : tasks.length)
        router.refresh()
        window.setTimeout(() => {
          document.getElementById(`unassigned-${selectedProjectId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 300)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the suggested tasks.')
    } finally {
      setSaving(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || analyzing) return
    setError('')
    setAnalysis(null)
    setAnalyzing(true)

    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session?.access_token) throw new Error('Your session expired. Sign in again and retry.')

      const form = new FormData()
      form.append('file', file)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/documents/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.detail || `PDF analysis failed (${response.status}).`)
      setAnalysis(result as DocumentAnalysis)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not analyze this PDF.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Analyze a PDF and split it into tasks</h2>
        <p className="mt-1 text-sm text-slate-500">Upload a text-based PDF (up to 10 MB). Its text is sent to your configured Gemini model for analysis. Review the suggested tasks, then choose a project to save them.</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input type="file" accept="application/pdf,.pdf" onChange={selectFile} className="min-w-0 flex-1 rounded-lg border p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2" disabled={analyzing} />
        <button type="submit" disabled={!file || analyzing} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
          {analyzing ? 'Reading and analyzing…' : 'Analyze PDF'}
        </button>
      </form>

      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {analysis && (
        <div className="mt-6 space-y-5 border-t pt-5">
          <div>
            <h3 className="font-semibold">Summary</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{analysis.summary}</p>
          </div>

          {analysis.key_findings.length > 0 && (
            <div>
              <h3 className="font-semibold">Key findings</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {analysis.key_findings.map((finding, index) => <li key={`${index}-${finding}`}>{finding}</li>)}
              </ul>
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Stories ({analysis.stories.length}) · Tasks ({suggestedTaskCount})</h3>
              {suggestedTaskCount > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <select value={selectedProjectId} onChange={(event) => { setSelectedProjectId(event.target.value); setSavedCount(0) }} className="rounded-lg border px-3 py-2 text-sm" disabled={saving}>
                    <option value="">Choose a project</option>
                    {availableProjects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                  </select>
                  <button type="button" onClick={saveTasks} disabled={!selectedProjectId || saving || savedCount > 0} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {saving ? 'Saving tasks…' : savedCount ? `${savedCount} tasks saved` : 'Save tasks to project'}
                  </button>
                </div>
              )}
            </div>
            {demoMode && <p className="mt-1 text-xs text-slate-500">Demo tasks stay in this browser only.</p>}
            {!demoMode && availableProjects.length === 0 && <p className="mt-1 text-xs text-amber-700">Create a project first to save these tasks.</p>}
            {analysis.stories.length ? (
              <div className="mt-3 space-y-4">
                {analysis.stories.map((story, storyIndex) => (
                  <section key={`${storyIndex}-${story.title}`} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Story</span>
                      <h4 className="font-semibold">{story.title}</h4>
                      {story.milestone && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{story.milestone}</span>}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{story.description}</p>
                    <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4">
                      {story.tasks.map((task, taskIndex) => (
                        <li key={`${taskIndex}-${task.title}`} className="rounded-md bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">Task {taskIndex + 1}</span>
                            <h5 className="text-sm font-semibold">{task.title}</h5>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${task.priority === 'high' ? 'bg-red-100 text-red-700' : task.priority === 'low' ? 'bg-white text-slate-600' : 'bg-amber-100 text-amber-800'}`}>
                              {task.priority} priority
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{task.description}</p>
                          {task.depends_on.length > 0 && <p className="mt-2 text-xs text-slate-500">Depends on: {task.depends_on.join(', ')}</p>}
                          {task.source_pages.length > 0 && <p className="mt-1 text-xs text-slate-500">Source pages: {task.source_pages.join(', ')}</p>}
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-slate-600">Subtasks</p>
                            {task.subtasks.length ? <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-slate-600">
                              {task.subtasks.map((subtask, subtaskIndex) => <li key={`${subtaskIndex}-${subtask.title}`}><span className="font-medium">{subtask.title}</span>{subtask.description && ` — ${subtask.description}`}</li>)}
                            </ol> : <p className="mt-1 text-xs text-slate-400">No subtasks identified</p>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            ) : <p className="mt-2 text-sm text-slate-600">No actionable tasks were identified in this PDF.</p>}
          </div>

          {analysis.open_questions.length > 0 && (
            <div>
              <h3 className="font-semibold">Questions to clarify</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {analysis.open_questions.map((question, index) => <li key={`${index}-${question}`}>{question}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
