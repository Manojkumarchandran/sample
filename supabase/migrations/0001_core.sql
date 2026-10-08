-- Extensions
create extension if not exists vector;

-- Projects Table
create table projects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    title text not null check (char_length(title) between 1 and 120),
    description text,
    created_at timestamptz not null default now()
);
create index projects_user_id_idx on projects(user_id);

-- Tasks Table
create table tasks (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    title text not null,
    priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
    status text not null default 'unassigned' check (status in ('unassigned', 'in_progress', 'completed')),
    assignee text constraint tasks_assignee_length_check check (assignee is null or char_length(assignee) <= 255),
    created_at timestamptz not null default now()
);
create index tasks_project_id_idx on tasks(project_id);

-- Documents Table (pgvector)
create table documents (
    id bigint generated always as identity primary key,
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    project_id uuid references projects(id) on delete cascade,
    file_name text not null,
    chunk_index int not null,
    content text not null,
    embedding vector(768) not null,
    created_at timestamptz not null default now()
);
create index documents_embedding_idx on documents using hnsw (embedding vector_cosine_ops);
create index documents_user_project_idx on documents (user_id, project_id);

-- Row Level Security (RLS)
alter table projects enable row level security;
alter table tasks enable row level security;
alter table documents enable row level security;

create policy "Users manage own projects" on projects
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own tasks" on tasks
    for all using (auth.uid() = user_id)
    with check (
        auth.uid() = user_id
        and exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
    );

create policy "Users manage own documents" on documents
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Match Documents Function (Security Invoker)
create or replace function match_documents(
    query_embedding vector(768),
    match_count int default 5,
    filter_project uuid default null
)
returns table (id bigint, file_name text, chunk_index int, content text, similarity float)
language sql stable security invoker
as $$
select d.id, d.file_name, d.chunk_index, d.content,
       1 - (d.embedding <=> query_embedding) as similarity
from documents d
where filter_project is null or d.project_id = filter_project
order by d.embedding <=> query_embedding
limit least(match_count, 20);
$$;
