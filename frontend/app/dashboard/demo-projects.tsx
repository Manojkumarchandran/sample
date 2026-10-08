'use client'

import { useEffect, useState } from 'react'
import { ProjectTaskList } from '@/components/project-task-list'

type Project = { id: string; title: string; description: string }
type DemoTask = { id: string; project_id: string; title: string; description: string; priority: string; status: string; assignee?: string | null; milestone?: string; story?: string }

const initialProjects: Project[] = [
  { id: 'sample-1', title: 'Website Redesign', description: 'Plan the new landing page, design system, and launch checklist.' },
  { id: 'sample-2', title: 'Q4 Marketing Campaign', description: 'Coordinate campaign research, creative assets, and channel deadlines.' },
  { id: 'sample-3', title: 'Customer Research', description: 'Collect interview notes and turn recurring feedback into product ideas.' },
]

const storageKey = 'nextask-demo-projects'
const taskStorageKey = 'nextask-demo-tasks'

export default function DemoProjects() {
  const [projects, setProjects] = useState(initialProjects)
  const [tasks, setTasks] = useState<DemoTask[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (Array.isArray(parsed)) setProjects(parsed)
      }
    } catch {
      // Keep the bundled sample projects if browser storage is unavailable.
    }
    setReady(true)
  }, [])

  useEffect(() => {
    const readTasks = () => {
      try {
        const saved: unknown = JSON.parse(window.localStorage.getItem(taskStorageKey) || '[]')
        setTasks(Array.isArray(saved) ? saved : [])
      } catch {
        setTasks([])
      }
    }
    readTasks()
    window.addEventListener('nextask:demo-tasks-changed', readTasks)
    return () => window.removeEventListener('nextask:demo-tasks-changed', readTasks)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(projects))
      window.dispatchEvent(new Event('nextask:demo-projects-changed'))
    } catch {
      // The demo remains usable for this session if browser storage is unavailable.
    }
  }, [projects, ready])

  function addProject(formData: FormData) {
    const title = String(formData.get('title') ?? '').trim()
    if (!title) return
    const description = String(formData.get('description') ?? '').trim()
    setProjects((current) => [{ id: `demo-${Date.now()}`, title, description }, ...current])
  }

  return (
    <>
      <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Create New Project</h2>
        <form action={addProject} className="flex max-w-md flex-col gap-4">
          <input name="title" placeholder="Project title" required maxLength={120} className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900" />
          <textarea name="description" placeholder="Project description (optional)" className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900" />
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">Create Sample Project</button>
        </form>
        <p className="mt-3 text-xs text-slate-500">Demo projects are saved in this browser only.</p>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Your Projects</h2>
        {projects.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id} className="flex flex-col justify-between rounded-xl border bg-white p-5 shadow-sm">
                <div>
                  <h3 className="text-lg font-semibold">{project.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-600">{project.description || 'No description provided.'}</p>
                  {tasks.some((task) => task.project_id === project.id) && (
                    <ProjectTaskList projectId={project.id} initialTasks={tasks.filter((task) => task.project_id === project.id)} demoMode />
                  )}
                </div>
                <button type="button" onClick={() => setProjects((current) => current.filter(({ id }) => id !== project.id))} className="mt-4 self-start text-xs font-medium text-red-600 hover:text-red-800">Delete Project</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed p-10 text-center text-slate-500">No projects yet. Create your first project above.</p>
        )}
      </section>
    </>
  )
}
