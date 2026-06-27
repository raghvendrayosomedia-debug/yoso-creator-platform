create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  creator_id uuid references creators(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_creator on push_subscriptions(creator_id);
create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

drop policy if exists push_subscriptions_self on push_subscriptions;
create policy push_subscriptions_self on push_subscriptions
  for all
  using(user_id=(select id from users where email=(auth.jwt()->>'email') limit 1))
  with check(user_id=(select id from users where email=(auth.jwt()->>'email') limit 1));

drop policy if exists push_subscriptions_admin on push_subscriptions;
create policy push_subscriptions_admin on push_subscriptions
  for all
  using(is_admin())
  with check(is_admin());
