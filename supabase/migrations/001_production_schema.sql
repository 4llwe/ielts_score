-- IELTS_MATE production schema for Supabase PostgreSQL
create extension if not exists pgcrypto;

create type public.user_role as enum ('student','instructor','examiner','admin');
create type public.content_status as enum ('draft','review','published','archived');
create type public.attempt_status as enum ('started','submitted','scored','cancelled');
create type public.submission_kind as enum ('writing','speaking');
create type public.payment_status as enum ('pending','settlement','capture','deny','cancel','expire','refund');

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 full_name text,
 phone text,
 role public.user_role not null default 'student',
 target text,
 timezone text not null default 'Asia/Makassar',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.programs (
 id uuid primary key default gen_random_uuid(), slug text unique not null, title text not null,
 description text, price integer not null default 0 check(price>=0), duration_weeks integer,
 status public.content_status not null default 'draft', created_at timestamptz not null default now()
);
create table public.tests (
 id uuid primary key default gen_random_uuid(), slug text unique not null, title text not null,
 test_type text not null check(test_type in ('placement','ielts','toefl','course')),
 duration_minutes integer not null check(duration_minutes>0), price integer not null default 0 check(price>=0),
 instructions text, status public.content_status not null default 'draft', version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.questions (
 id uuid primary key default gen_random_uuid(), test_id uuid not null references public.tests(id) on delete cascade,
 section text not null, item_type text not null, prompt text not null, passage text, audio_url text,
 options jsonb not null default '[]', answer_key jsonb, rubric jsonb, difficulty numeric(4,2), discrimination numeric(4,2),
 status public.content_status not null default 'draft', position integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.enrollments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 program_id uuid not null references public.programs(id) on delete cascade, status text not null default 'active',
 started_at timestamptz not null default now(), ends_at timestamptz, unique(user_id,program_id)
);
create table public.attempts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 test_id uuid references public.tests(id), test_slug text not null, status public.attempt_status not null default 'started',
 started_at timestamptz not null default now(), submitted_at timestamptz, elapsed_seconds integer,
 objective_score numeric(5,2), final_score numeric(5,2), metadata jsonb not null default '{}'
);
create table public.answers (
 id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.attempts(id) on delete cascade,
 question_id uuid references public.questions(id), item_key text not null, answer jsonb not null,
 is_correct boolean, score numeric(6,2), saved_at timestamptz not null default now(), unique(attempt_id,item_key)
);
create table public.submissions (
 id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.attempts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade, kind public.submission_kind not null,
 response_text text, file_path text, status text not null default 'queued', examiner_id uuid references public.profiles(id),
 submitted_at timestamptz not null default now(), due_at timestamptz not null default (now()+interval '24 hours')
);
create table public.evaluations (
 id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.submissions(id) on delete cascade,
 examiner_id uuid not null references public.profiles(id), rubric_scores jsonb not null, overall_score numeric(5,2) not null,
 feedback text not null, moderation_status text not null default 'pending', created_at timestamptz not null default now()
);
create table public.payments (
 id uuid primary key default gen_random_uuid(), order_id text unique not null, user_id uuid not null references public.profiles(id),
 program_id uuid references public.programs(id), test_id uuid references public.tests(id), amount integer not null check(amount>0),
 status public.payment_status not null default 'pending', snap_token text, transaction_id text,
 raw_notification jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.certificates (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 program_id uuid references public.programs(id), certificate_no text unique not null,
 issued_at timestamptz not null default now(), verification_hash text unique not null, revoked_at timestamptz
);
create table public.audit_logs (
 id bigint generated always as identity primary key, actor_id uuid references public.profiles(id),
 action text not null, entity_type text not null, entity_id text, metadata jsonb not null default '{}',
 ip_hash text, created_at timestamptz not null default now()
);

create index attempts_user_created on public.attempts(user_id,started_at desc);
create index submissions_queue on public.submissions(status,due_at);
create index questions_test_position on public.questions(test_id,position);
create index payments_user_created on public.payments(user_id,created_at desc);
create index audit_created on public.audit_logs(created_at desc);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,email,full_name) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name','')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.current_role() returns public.user_role language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() $$;

alter table public.profiles enable row level security; alter table public.programs enable row level security;
alter table public.tests enable row level security; alter table public.questions enable row level security;
alter table public.enrollments enable row level security; alter table public.attempts enable row level security;
alter table public.answers enable row level security; alter table public.submissions enable row level security;
alter table public.evaluations enable row level security; alter table public.payments enable row level security;
alter table public.certificates enable row level security; alter table public.audit_logs enable row level security;

create policy profiles_self_read on public.profiles for select using(id=auth.uid() or public.current_role()='admin');
create policy profiles_self_update on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy public_programs on public.programs for select using(status='published' or public.current_role()='admin');
create policy public_tests on public.tests for select using(status='published' or public.current_role() in ('admin','instructor','examiner'));
create policy staff_questions on public.questions for select using(public.current_role() in ('admin','instructor','examiner'));
create policy own_enrollments on public.enrollments for select using(user_id=auth.uid() or public.current_role()='admin');
create policy own_attempts_read on public.attempts for select using(user_id=auth.uid() or public.current_role() in ('admin','examiner'));
create policy own_attempts_insert on public.attempts for insert with check(user_id=auth.uid());
create policy own_attempts_update on public.attempts for update using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own_answers on public.answers for all using(exists(select 1 from public.attempts a where a.id=attempt_id and a.user_id=auth.uid())) with check(exists(select 1 from public.attempts a where a.id=attempt_id and a.user_id=auth.uid()));
create policy own_submissions_read on public.submissions for select using(user_id=auth.uid() or examiner_id=auth.uid() or public.current_role()='admin');
create policy own_submissions_insert on public.submissions for insert with check(user_id=auth.uid());
create policy examiner_evaluations on public.evaluations for all using(examiner_id=auth.uid() or public.current_role()='admin') with check(examiner_id=auth.uid() or public.current_role()='admin');
create policy own_payments on public.payments for select using(user_id=auth.uid() or public.current_role()='admin');
create policy own_certificates on public.certificates for select using(user_id=auth.uid() or public.current_role()='admin');
create policy admin_audit on public.audit_logs for select using(public.current_role()='admin');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('speaking','speaking',false,26214400,array['audio/webm','audio/mpeg','audio/mp4']),
('writing','writing',false,10485760,array['application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do nothing;
create policy storage_owner_insert on storage.objects for insert to authenticated with check(bucket_id in ('speaking','writing') and (storage.foldername(name))[1]=auth.uid()::text);
create policy storage_owner_read on storage.objects for select to authenticated using((storage.foldername(name))[1]=auth.uid()::text or public.current_role() in ('admin','examiner'));
