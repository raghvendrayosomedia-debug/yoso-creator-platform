alter table invoices add column if not exists claimed_reposts integer not null default 0;
alter table invoices add column if not exists claimed_comments integer not null default 0;
alter table invoices add column if not exists verification_state text not null default 'unchecked';
alter table invoices add column if not exists verification_message text;
