-- IELTS_MATE full operational schema: real classes, enrollments, CMS, leads and notifications
alter table public.profiles add column if not exists status text not null default 'active' check (status in ('active','suspended','archived'));
alter table public.profiles add column if not exists last_active_at timestamptz;
alter table public.enrollments add column if not exists payment_id uuid references public.payments(id);
alter table public.enrollments add column if not exists progress numeric(5,2) not null default 0 check(progress between 0 and 100);
alter table public.enrollments add column if not exists completed_at timestamptz;
alter table public.programs add column if not exists description text;

create table if not exists public.classes (
 id uuid primary key default gen_random_uuid(), program_id uuid not null references public.programs(id) on delete cascade,
 name text not null, instructor_id uuid references public.profiles(id), capacity integer not null default 20 check(capacity>0),
 starts_at timestamptz, ends_at timestamptz, meeting_url text, location text,
 status text not null default 'draft' check(status in ('draft','open','active','completed','cancelled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.enrollments add column if not exists class_id uuid references public.classes(id);

create table if not exists public.class_members (
 class_id uuid not null references public.classes(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 joined_at timestamptz not null default now(), primary key(class_id,user_id)
);
create table if not exists public.materials (
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes(id) on delete cascade,
 title text not null, description text, file_url text, published_at timestamptz, position integer not null default 0,
 created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.assignments (
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes(id) on delete cascade,
 title text not null, instructions text not null, due_at timestamptz, max_score numeric(6,2) not null default 100,
 status text not null default 'draft' check(status in ('draft','published','closed')),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.assignment_submissions (
 id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.assignments(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade, response_text text, file_path text,
 submitted_at timestamptz not null default now(), score numeric(6,2), feedback text, graded_by uuid references public.profiles(id),
 graded_at timestamptz, unique(assignment_id,user_id)
);
create table if not exists public.attendance (
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade, session_at timestamptz not null,
 status text not null check(status in ('present','late','excused','absent')), notes text,
 recorded_by uuid references public.profiles(id), unique(class_id,user_id,session_at)
);
create table if not exists public.schedules (
 id uuid primary key default gen_random_uuid(), class_id uuid references public.classes(id) on delete cascade,
 title text not null, starts_at timestamptz not null, ends_at timestamptz not null,
 meeting_url text, location text, created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.leads (
 id uuid primary key default gen_random_uuid(), name text not null, email text not null, phone text not null,
 topic text, message text not null, source text not null default 'website', status text not null default 'new' check(status in ('new','contacted','qualified','closed')),
 assigned_to uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.site_content (
 key text primary key, value jsonb not null, published boolean not null default false,
 updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null, body text not null, link text, read_at timestamptz, created_at timestamptz not null default now()
);

create index if not exists classes_program on public.classes(program_id,status);
create index if not exists class_members_user on public.class_members(user_id);
create index if not exists assignments_class_due on public.assignments(class_id,due_at);
create index if not exists attendance_user_session on public.attendance(user_id,session_at desc);
create index if not exists schedules_start on public.schedules(starts_at);
create index if not exists leads_status_created on public.leads(status,created_at desc);
create index if not exists notifications_user_created on public.notifications(user_id,created_at desc);

alter table public.classes enable row level security; alter table public.class_members enable row level security;
alter table public.materials enable row level security; alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security; alter table public.attendance enable row level security;
alter table public.schedules enable row level security; alter table public.leads enable row level security;
alter table public.site_content enable row level security; alter table public.notifications enable row level security;

create policy classes_member_read on public.classes for select using(public.current_role()='admin' or instructor_id=auth.uid() or exists(select 1 from public.class_members m where m.class_id=id and m.user_id=auth.uid()));
create policy class_members_read on public.class_members for select using(user_id=auth.uid() or public.current_role()='admin' or exists(select 1 from public.classes c where c.id=class_id and c.instructor_id=auth.uid()));
create policy materials_member_read on public.materials for select using(public.current_role()='admin' or exists(select 1 from public.classes c left join public.class_members m on m.class_id=c.id where c.id=class_id and (c.instructor_id=auth.uid() or m.user_id=auth.uid())));
create policy assignments_member_read on public.assignments for select using(public.current_role()='admin' or exists(select 1 from public.classes c left join public.class_members m on m.class_id=c.id where c.id=class_id and (c.instructor_id=auth.uid() or m.user_id=auth.uid())));
create policy assignment_submission_access on public.assignment_submissions for select using(user_id=auth.uid() or public.current_role()='admin' or exists(select 1 from public.assignments a join public.classes c on c.id=a.class_id where a.id=assignment_id and c.instructor_id=auth.uid()));
create policy attendance_access on public.attendance for select using(user_id=auth.uid() or public.current_role()='admin' or exists(select 1 from public.classes c where c.id=class_id and c.instructor_id=auth.uid()));
create policy schedules_member_read on public.schedules for select using(public.current_role()='admin' or exists(select 1 from public.classes c left join public.class_members m on m.class_id=c.id where c.id=class_id and (c.instructor_id=auth.uid() or m.user_id=auth.uid())));
create policy published_site_content on public.site_content for select using(published or public.current_role()='admin');
create policy own_notifications on public.notifications for select using(user_id=auth.uid());

-- Ensure staff can update queued submissions and profiles cannot self-escalate roles.
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using(id=auth.uid()) with check(id=auth.uid() and role=public.current_role());
create policy staff_submissions_update on public.submissions for update using(public.current_role() in ('examiner','admin') or examiner_id=auth.uid()) with check(public.current_role() in ('examiner','admin') or examiner_id=auth.uid());

insert into public.site_content(key,value,published) values
('navigation','[{"id":"home","label":"Home","href":"/home","order":1,"active":true},{"id":"programs","label":"Program","href":"/programs","order":2,"active":true},{"id":"tests","label":"Tes Online","href":"/tests","order":3,"active":true},{"id":"pricing","label":"Paket & Harga","href":"/pricing","order":4,"active":true},{"id":"resources","label":"Sumber Belajar","href":"/resources","order":5,"active":true},{"id":"about","label":"Profil Lembaga","href":"/about","order":6,"active":true},{"id":"method","label":"Kajian Tes","href":"/method","order":7,"active":true},{"id":"contact","label":"Kontak","href":"/contact","order":8,"active":true}]'::jsonb,true)
on conflict(key) do nothing;
