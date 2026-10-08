export type AgentStatusEvent = {
  action: string
  label: string
  name?: string
  steps?: string[]
}

export function AgentStatus({ status }: { status: AgentStatusEvent | null }) {
  if (!status) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm text-teal-800 shadow-sm"
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" aria-hidden />
      <span>{status.label}</span>
    </div>
  )
}