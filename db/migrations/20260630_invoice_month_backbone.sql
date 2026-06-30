alter table invoices add column if not exists upload_group_id uuid;

alter table invoices drop constraint if exists invoices_creator_id_month_label_key;

create index if not exists idx_invoices_creator_month on invoices(creator_id, month_key);
create index if not exists idx_invoices_upload_group on invoices(upload_group_id);
