'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/utils/supabase/client'

export type TaskStatus = 'unassigned' | 'in_progress' | 'completed'
export type ProjectTask = {
  id: string
  project_id?: string
  title: string
  description?: string
  priority: string
  status: string
  assignee?: string | null
  assignee_id?: string | null
  milestone?: string
  story?: string
  subtasks?: { title: string; description?: string }[]
}

const taskStorageKey = 'nextask-demo-tasks'
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

function normalizeStatus(status: string): TaskStatus {
  if (status === 'todo') return 'unassigned'
  if (status === 'done') return 'completed'
  return statusOptions.some((option) => option.value === status) ? status as TaskStatus : 'unassigned'
}

export function ProjectTaskList({
  projectId,
  initialTasks,
  demoMode = false,
}: {
  projectId: string
  initialTasks: ProjectTask[]
  demoMode?: boolean
}) {
  const [tasks, setTasks] = useState(() => initialTasks.map((task) => ({ ...task, status: normalizeStatus(task.status) })))
  const [savingId, setSavingId] = useState<string | null>(null)
  const [assigneeDrafts, setAssigneeDrafts] = useState<Record<string, string>>({})
  const [developers, setDevelopers] = useState<{ user_id: string; profiles: { username: string } | null }[]>([])
  const [canManageDevelopers, setCanManageDevelopers] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [developerMessage, setDeveloperMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    setTasks(initialTasks.map((task) => ({ ...task, status: normalizeStatus(task.status) })))
  }, [initialTasks])

  useEffect(() => {
    if (demoMode) return
    let cancelled = false
    async function loadDevelopers() {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session?.access_token) return
      const response = await fetch(`${apiUrl}/projects/${encodeURIComponent(projectId)}/developers`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (response.ok && !cancelled) {
        setDevelopers(await response.json())
        setCanManageDevelopers(true)
      } else if (!cancelled) {
        const result = await response.json().catch(() => ({}))
        setDeveloperMessage(result.detail || 'Could not load project developers. Check that migration 0005 has been applied.')
      }
    }
    void loadDevelopers()
    return () => { cancelled = true }
  }, [demoMode, projectId])

  async function addDeveloper(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDeveloperMessage('')
    const { data: { session } } = await createClient().auth.getSession()
    if (!session?.access_token) { setDeveloperMessage('Sign in again and retry.'); return }
    const response = await fetch(`${apiUrl}/projects/${encodeURIComponent(projectId)}/developers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ username, password }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { setDeveloperMessage(result.detail || 'Could not add developer.'); return }
    setDevelopers((current) => [...current, { user_id: result.user_id, profiles: { username: result.username } }])
    setUsername('')
    setPassword('')
    setDeveloperMessage(`Developer ${result.username} added to this project.`)
  }

  async function removeDeveloper(developerId: string) {
    const developer = developers.find((item) => item.user_id === developerId)
    if (!developer || !window.confirm(`Remove ${developer.profiles?.username ?? 'this developer'} from this project?`)) return
    setDeveloperMessage('')
    const { data: { session } } = await createClient().auth.getSession()
    if (!session?.access_token) { setDeveloperMessage('Sign in again and retry.'); return }
    const response = await fetch(`${apiUrl}/projects/${encodeURIComponent(projectId)}/developers/${encodeURIComponent(developerId)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { setDeveloperMessage(result.detail || 'Could not remove developer.'); return }
    setDevelopers((current) => current.filter((item) => item.user_id !== developerId))
    setTasks((current) => current.map((task) => task.assignee_id === developerId
      ? { ...task, assignee_id: null, assignee: null, status: 'unassigned' }
      : task))
    setDeveloperMessage('Developer removed from this project. Their account still exists.')
  }

  async function changeStatus(taskId: string, status: TaskStatus) {
    const previous = tasks
    setError('')
    setSavingId(taskId)
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status } : task))

    try {
      if (demoMode) {
        const saved: unknown = JSON.parse(window.localStorage.getItem(taskStorageKey) || '[]')
        const allTasks: ProjectTask[] = Array.isArray(saved) ? saved : []
        window.localStorage.setItem(taskStorageKey, JSON.stringify(allTasks.map((task) => task.id === taskId ? { ...task, status } : task)))
        window.dispatchEvent(new Event('nextask:demo-tasks-changed'))
        return
      }

      const { data: { session } } = await createClient().auth.getSession()
      if (!session?.access_token) throw new Error('Your session expired. Sign in again and retry.')
      const response = await fetch(`${apiUrl}/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.detail || `Could not update task (${response.status}).`)
    } catch (cause) {
      setTasks(previous)
      setError(cause instanceof Error ? cause.message : 'Could not update task status.')
    } finally {
      setSavingId(null)
    }
  }

  async function saveAssignee(taskId: string) {
    if (savingId) return
    const assigneeId = assigneeDrafts[taskId] ?? tasks.find((task) => task.id === taskId)?.assignee_id ?? ''
    const assignee = demoMode
      ? (assigneeDrafts[taskId]?.trim() || null)
      : (developers.find((developer) => developer.user_id === assigneeId)?.profiles?.username ?? null)
    const previous = tasks
    setError('')
    setSavingId(taskId)
    try {
      if (demoMode) {
        const saved: unknown = JSON.parse(window.localStorage.getItem(taskStorageKey) || '[]')
        const allTasks: ProjectTask[] = Array.isArray(saved) ? saved : []
        window.localStorage.setItem(taskStorageKey, JSON.stringify(allTasks.map((task) => task.id === taskId ? { ...task, assignee } : task)))
        window.dispatchEvent(new Event('nextask:demo-tasks-changed'))
      } else {
        const { data: { session } } = await createClient().auth.getSession()
        if (!session?.access_token) throw new Error('Your session expired. Sign in again and retry.')
        const response = await fetch(`${apiUrl}/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ assignee_id: assigneeId || null }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.detail || `Could not assign task (${response.status}).`)
      }
      setTasks((current) => current.map((task) => task.id === taskId ? { ...task, assignee, assignee_id: demoMode ? null : (assigneeId || null) } : task))
    } catch (cause) {
      setTasks(previous)
      setError(cause instanceof Error ? cause.message : 'Could not assign this task.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      <div className="mt-4 grid gap-3 border-t pt-3 md:grid-cols-3">
        {statusOptions.map((column) => {
          const columnTasks = tasks.filter((task) => normalizeStatus(task.status) === column.value)
          const storyGroups = new Map<string, ProjectTask[]>()
          columnTasks.forEach((task) => {
            const storyName = task.story?.trim() || 'Other tasks'
            storyGroups.set(storyName, [...(storyGroups.get(storyName) ?? []), task])
          })
          return <section key={column.value} id={column.value === 'unassigned' ? `unassigned-${projectId}` : undefined} className="min-w-0 rounded-lg bg-slate-50 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{column.label}</h3>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">{columnTasks.length}</span>
          </div>
          <ul className="space-y-4">
        {Array.from(storyGroups, ([storyName, storyTasks]) => (
          <li key={storyName}>
            <h4 className="mb-2 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">Story: {storyName}</h4>
            <ul className="space-y-3">
        {storyTasks.map((task) => (
          <li key={task.id} className="rounded-lg border bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{task.title}</p>
                {task.description && <p className="mt-1 text-xs text-slate-600">{task.description}</p>}
                {(task.milestone || task.story) && <p className="mt-1 text-xs text-slate-500">{[task.milestone, task.story].filter(Boolean).join(' · ')}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="sr-only">Status for {task.title}</span>
                  <select
                    aria-label={`Status for ${task.title}`}
                    value={normalizeStatus(task.status)}
                    onChange={(event) => changeStatus(task.id, event.target.value as TaskStatus)}
                    disabled={savingId === task.id}
                    className="rounded-md border bg-white px-2 py-1.5 text-xs text-slate-700 disabled:opacity-50"
                  >
                    {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {demoMode && <>
                <input
                  type="text"
                  maxLength={255}
                  value={assigneeDrafts[task.id] ?? task.assignee ?? ''}
                  onChange={(event) => setAssigneeDrafts((current) => ({ ...current, [task.id]: event.target.value }))}
                  placeholder="Assignee name or email"
                  aria-label={`Assignee for ${task.title}`}
                  className="min-w-0 flex-1 rounded-md border bg-white px-2 py-1.5 text-xs"
                />
                <button type="button" onClick={() => saveAssignee(task.id)} disabled={savingId === task.id} className="rounded-md border px-2 py-1.5 text-xs font-medium text-slate-700">{task.assignee ? 'Update assignee' : 'Assign'}</button>
              </>}
              {(!demoMode && canManageDevelopers) && <>
                <select
                  value={assigneeDrafts[task.id] ?? task.assignee_id ?? ''}
                  onChange={(event) => setAssigneeDrafts((current) => ({ ...current, [task.id]: event.target.value }))}
                  aria-label={`Assignee for ${task.title}`}
                  disabled={savingId === task.id}
                  className="min-w-0 flex-1 rounded-md border bg-white px-2 py-1.5 text-xs disabled:opacity-50"
                >
                  <option value="">Unassigned</option>
                  {developers.map((developer) => <option key={developer.user_id} value={developer.user_id}>{developer.profiles?.username || 'Developer'}</option>)}
                </select>
                <button type="button" onClick={() => saveAssignee(task.id)} disabled={savingId === task.id} className="rounded-md border px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-50">
                  {savingId === task.id ? 'Saving…' : task.assignee ? 'Update assignee' : 'Assign'}
                </button>
              </>}
              {demoMode && <span className="text-xs text-slate-600">{task.assignee ? `Assigned to ${task.assignee}` : 'Unassigned'}</span>}
              <span className="text-xs text-slate-500">{task.priority} priority</span>
            </div>
            <div className="mt-3 border-t pt-2">
              {!!task.subtasks?.length ? <>
              <p className="text-xs font-semibold text-slate-600">Subtasks ({task.subtasks.length})</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-slate-600">
                {task.subtasks.map((subtask, index) => <li key={`${index}-${subtask.title}`}><span className="font-medium">{subtask.title}</span>{subtask.description && ` — ${subtask.description}`}</li>)}
              </ol>
              </> : <p className="text-xs text-slate-400">No subtasks for this task.</p>}
            </div>
          </li>
        ))}
            </ul>
          </li>
        ))}
          {columnTasks.length === 0 && <li className="rounded-md border border-dashed border-slate-300 p-3 text-center text-xs text-slate-400">No tasks</li>}
          </ul>
          </section>
        })}
      </div>
      {!demoMode && canManageDevelopers && <section className="mt-4 rounded-lg border border-dashed p-3">
        <h3 className="mb-2 text-xs font-semibold text-slate-700">Project developers</h3>
        {developers.length ? <ul className="mb-3 space-y-2">
          {developers.map((developer) => <li key={developer.user_id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
            <span className="text-xs text-slate-700">{developer.profiles?.username}</span>
            <button type="button" onClick={() => removeDeveloper(developer.user_id)} className="text-xs font-medium text-red-700 hover:text-red-900">Remove</button>
          </li>)}
        </ul> : <p className="mb-3 text-xs text-slate-500">No developers added yet.</p>}
        <form onSubmit={addDeveloper} className="flex flex-wrap gap-2">
          <input required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" className="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-xs" />
          <input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (8+ characters)" className="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-xs" />
          <button className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">Add developer</button>
        </form>
        {developerMessage && <p role="status" className="mt-2 text-xs text-slate-600">{developerMessage}</p>}
      </section>}
      {!demoMode && !canManageDevelopers && developerMessage && <p role="alert" className="mt-2 text-xs text-amber-800">{developerMessage}</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  )
}
