-- Store the person responsible for a task as a name or email label.
alter table tasks
    add column if not exists assignee text;

alter table tasks
    drop constraint if exists tasks_assignee_length_check;

alter table tasks
    add constraint tasks_assignee_length_check
        check (assignee is null or char_length(assignee) <= 255);
