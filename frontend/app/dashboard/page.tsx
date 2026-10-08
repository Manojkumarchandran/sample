import { createClient } from '@/utils/supabase/server'
import { deleteProject } from './actions'
import DemoProjects from './demo-projects'
import { ChatPanel } from '@/components/chat-panel'
import { DocumentAnalyzer } from '@/components/document-analyzer'
import { ProjectTaskList } from '@/components/project-task-list'
import { CreateProjectForm } from '@/components/create-project-form'

export default async function Dashboard() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <header className="mb-8 flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-3xl font-bold">NexTask AI</h1>
            <p className="text-sm text-slate-500">Workspace Dashboard · Sample data</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">Demo mode</span>
        </header>
        <DocumentAnalyzer demoMode />
        <ChatPanel />
        <DemoProjects />
      </main>
    )
  }

  const { data: projects, error: projectsError } = await (await createClient())
    .from('projects')
    .select('*, tasks(*)')
    .order('created_at', { ascending: false })

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-8 flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold">NexTask AI</h1>
          <p className="text-sm text-slate-500">Workspace Dashboard</p>
        </div>
      </header>

      <DocumentAnalyzer projects={(projects ?? []).map(({ id, title }) => ({ id, title }))} />
      <ChatPanel />

      {projectsError && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Could not load projects: {projectsError.message}</p>}

      <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Create New Project</h2>
        <CreateProjectForm />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Your Projects</h2>
        {projects?.length ? (
          <ul className="grid gap-4">
            {projects.map((project) => (
              <li key={project.id} className="flex flex-col justify-between rounded-xl border bg-white p-5 shadow-sm">
                <div>
                  <h3 className="text-lg font-semibold">{project.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-600">{project.description || 'No description provided.'}</p>
                  <ProjectTaskList projectId={project.id} initialTasks={project.tasks || []} />
                </div>
                <form action={deleteProject.bind(null, project.id)} className="mt-4">
                  <button type="submit" className="text-xs font-medium text-red-600 hover:text-red-800">Delete Project</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed p-10 text-center text-slate-500">No projects yet. Create your first project above.</p>
        )}
      </section>
    </main>
  )
}
