import { createClient } from '@/utils/supabase/client'

export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data: { session } } = await createClient().auth.getSession()
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
  })
}