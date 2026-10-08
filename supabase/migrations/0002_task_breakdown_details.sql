-- Preserve the context generated from a document when suggested tasks are saved.
alter table tasks
    add column if not exists milestone text not null default '',
    add column if not exists story text not null default '',
    add column if not exists description text not null default '',
    add column if not exists depends_on text[] not null default '{}',
    add column if not exists source_pages int[] not null default '{}',
    add column if not exists source_document text;
