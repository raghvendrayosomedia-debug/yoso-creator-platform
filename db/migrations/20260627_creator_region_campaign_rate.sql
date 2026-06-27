alter table creators add column if not exists region text;
alter table creators add column if not exists rate_campaign numeric(10,2);

create or replace function set_rate_status() returns trigger as $$
begin
  new.rate_status:=case
    when new.rate_repost is not null and new.rate_comment is not null and new.rate_campaign is not null
    then 'set'::rate_status
    else 'pending'::rate_status
  end;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_rate_status on creators;
create trigger trg_rate_status before insert or update of rate_repost,rate_comment,rate_campaign on creators for each row execute function set_rate_status();
