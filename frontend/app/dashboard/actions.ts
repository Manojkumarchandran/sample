'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function createProject(formData: FormData) {
  const supabase = await createClient()
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return

  const { error } = await supabase.from('projects').insert({
    title,
    description: String(formData.get('description') ?? '') || null,
  })

  if (error) throw new Error('Could not create the project. Please retry.')
  revalidatePath('/dashboard')
}

export async function deleteProject(id: string) {
  const supabase = await createClient()
  await supabase.from('projects').delete().eq('id', id)
  revalidatePath('/dashboard')
}
