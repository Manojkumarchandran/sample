-- Keep task subtasks as structured, ordered child items on each task.
alter table public.tasks
    add column if not exists subtasks jsonb not null default '[]'::jsonb;

alter table public.tasks
    drop constraint if exists tasks_subtasks_array_check;

alter table public.tasks
    add constraint tasks_subtasks_array_check
        check (jsonb_typeof(subtasks) = 'array');

notify pgrst, 'reload schema';
