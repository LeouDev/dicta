-- Report alerts: every new report emails the moderator (web/api/report-alert.js,
-- through Resend), so the Terms' promise to review reports within 24 hours
-- doesn't rest on remembering to look. Like the welcome email, pg_net calls
-- the website once the report commits. No new table: the website reads the
-- report with the service role, and Resend's idempotency key makes a repeated
-- call send nothing.
create or replace function private.queue_report_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A report must never fail because its alert couldn't be queued.
  begin
    perform net.http_post(
      url := 'https://dicta-orcin.vercel.app/api/report-alert',
      body := jsonb_build_object('id', new.id),
      timeout_milliseconds := 10000
    );
  exception when others then
    raise warning 'report alert for % not queued: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;
revoke execute on function private.queue_report_alert() from public;

create trigger reports_after_insert_alert
after insert on public.reports
for each row execute function private.queue_report_alert();
