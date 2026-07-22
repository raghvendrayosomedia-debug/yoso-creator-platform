with ranked as (
  select
    id,
    row_number() over (
      partition by post_id, creator_id, type
      order by assigned_at asc, id asc
    ) as rn
  from tasks
  where state = 'sent'
)
update tasks
set
  state = 'timeout',
  responded_at = coalesce(responded_at, now()),
  reject_reason = coalesce(reject_reason, 'Duplicate active assignment cleared automatically.')
where id in (select id from ranked where rn > 1);

create unique index if not exists idx_tasks_one_sent_per_creator_post_type
  on tasks(post_id, creator_id, type)
  where state = 'sent';
