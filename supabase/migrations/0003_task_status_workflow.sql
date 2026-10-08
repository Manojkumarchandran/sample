-- Use the user-facing workflow labels and keep existing tasks intact.
alter table tasks drop constraint if exists tasks_status_check;

update tasks
set status = case status
    when 'todo' then 'unassigned'
    when 'done' then 'completed'
    else status
end;

alter table tasks
    alter column status set default 'unassigned',
    add constraint tasks_status_check
        check (status in ('unassigned', 'in_progress', 'completed'));
