alter table invoices add column if not exists claimed_amount numeric(12,2);
alter table invoices add column if not exists amount_check_state text not null default 'unchecked';
alter table invoices add column if not exists amount_check_message text;
