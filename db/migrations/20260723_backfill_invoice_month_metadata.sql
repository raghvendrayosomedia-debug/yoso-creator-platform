-- Safe backfill for older invoices that were uploaded before month_key was required.
-- This does not delete invoices or change files, approval status, payment status, creators, or amounts.

update invoices
set month_key = date_trunc(
  'month',
  to_date(replace(month_label, '''', ' 20'), 'FMMonth YYYY')
)::date
where month_key is null
  and month_label ~ '^[A-Za-z]+''[0-9]{2}$';

update invoices
set month_key = date_trunc('month', coalesce(uploaded_at, created_at, now())::date)::date
where month_key is null;

update invoices
set month_label = to_char(month_key, 'FMMonth') || '''' || to_char(month_key, 'YY')
where (month_label is null or month_label = '')
  and month_key is not null;

create index if not exists idx_invoices_month_key on invoices(month_key);
