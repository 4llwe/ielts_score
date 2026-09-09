-- Commercial hardening: abuse controls, privacy/support operations, and content release gates
create table if not exists public.security_rate_limits (
 bucket_key text primary key, request_count integer not null default 1,
 window_started_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare allowed boolean;
begin
 insert into public.security_rate_limits(bucket_key,request_count,window_started_at,updated_at)
 values(p_key,1,now(),now())
 on conflict(bucket_key) do update set
   request_count=case when public.security_rate_limits.window_started_at < now()-(p_window_seconds||' seconds')::interval then 1 else public.security_rate_limits.request_count+1 end,
   window_started_at=case when public.security_rate_limits.window_started_at < now()-(p_window_seconds||' seconds')::interval then now() else public.security_rate_limits.window_started_at end,
   updated_at=now()
 returning request_count <= p_limit into allowed;
 return allowed;
end $$;
revoke all on function public.consume_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer) to service_role;
alter table public.security_rate_limits enable row level security;

create table if not exists public.privacy_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 request_type text not null check(request_type in ('delete','correct','restrict')), details text,
 status text not null default 'received' check(status in ('received','verifying','approved','rejected','completed')),
 resolution_notes text, created_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.support_tickets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 category text not null default 'general', subject text not null, message text not null,
 status text not null default 'open' check(status in ('open','in_progress','waiting_user','resolved','closed')),
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 assigned_to uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists privacy_requests_user_created on public.privacy_requests(user_id,created_at desc);
create index if not exists support_tickets_user_status on public.support_tickets(user_id,status,created_at desc);
alter table public.privacy_requests enable row level security;
alter table public.support_tickets enable row level security;
create policy privacy_request_own_read on public.privacy_requests for select using(user_id=auth.uid() or public.current_role()='admin');
create policy support_ticket_own_read on public.support_tickets for select using(user_id=auth.uid() or public.current_role()='admin');

alter table public.questions add column if not exists rights_status text not null default 'unverified' check(rights_status in ('unverified','original','licensed','cleared'));
alter table public.questions add column if not exists source_reference text;
alter table public.questions add column if not exists reviewed_by uuid references public.profiles(id);
alter table public.questions add column if not exists reviewed_at timestamptz;
alter table public.tests add column if not exists validation_status text not null default 'unvalidated' check(validation_status in ('unvalidated','pilot','approved','suspended'));
alter table public.tests add column if not exists validation_notes text;
-- Existing demonstration material must not remain commercially published by accident.
update public.questions set status='review' where status='published' and rights_status='unverified';
update public.tests set status='review' where status='published' and validation_status<>'approved';
