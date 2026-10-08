-- IELTS_MATE 010: LMS terstruktur, placement test & CEFR, track TOEFL ITP, dukungan analitik
begin;

-- 1) Ekstensi skema yang ada (aman dijalankan ulang)
alter table public.profiles add column if not exists cefr_level text
  check (cefr_level in ('A1','A2','B1','B1+','B2','C1','C2'));
alter table public.profiles add column if not exists placement_completed_at timestamptz;
alter table public.programs add column if not exists audience text not null default 'umum'
  check (audience in ('anak','sma','mahasiswa','umum'));
alter table public.programs add column if not exists level_cefr text;
alter table public.tests add column if not exists score_format text not null default 'percent'
  check (score_format in ('percent','itp','ielts_band'));
alter table public.tests add column if not exists metadata jsonb not null default '{}';

-- 2) LMS terstruktur: modules -> lessons -> lesson_progress
create table if not exists public.modules (
 id uuid primary key default gen_random_uuid(),
 program_id uuid not null references public.programs(id) on delete cascade,
 title text not null, description text,
 position integer not null default 0,
 status public.content_status not null default 'draft',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.lessons (
 id uuid primary key default gen_random_uuid(),
 module_id uuid not null references public.modules(id) on delete cascade,
 title text not null, summary text,
 content_type text not null default 'reading' check(content_type in ('reading','video','exercise','assignment')),
 content text, video_url text, audio_url text, file_url text,
 duration_minutes integer not null default 15 check(duration_minutes>0),
 position integer not null default 0,
 status public.content_status not null default 'draft',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.lesson_progress (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 lesson_id uuid not null references public.lessons(id) on delete cascade,
 status text not null default 'in_progress' check(status in ('in_progress','completed')),
 completed_at timestamptz, updated_at timestamptz not null default now(),
 unique(user_id,lesson_id)
);
create index if not exists modules_program_position on public.modules(program_id,position);
create index if not exists lessons_module_position on public.lessons(module_id,position);
create index if not exists lesson_progress_user on public.lesson_progress(user_id,updated_at desc);

alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;
create policy modules_staff_read on public.modules for select
 using(status='published' or public.current_role() in ('admin','instructor'));
create policy modules_staff_write on public.modules for all
 using(public.current_role() in ('admin','instructor'))
 with check(public.current_role() in ('admin','instructor'));
create policy lessons_staff_read on public.lessons for select
 using(status='published' or public.current_role() in ('admin','instructor'));
create policy lessons_staff_write on public.lessons for all
 using(public.current_role() in ('admin','instructor'))
 with check(public.current_role() in ('admin','instructor'));
create policy lesson_progress_own on public.lesson_progress for all
 using(user_id=auth.uid() or public.current_role()='admin')
 with check(user_id=auth.uid() or public.current_role()='admin');

-- 3) Segmentasi audiens program yang sudah ada (berdasarkan judul seed)
update public.programs set audience='anak' where title ilike '%children%';
update public.programs set audience='mahasiswa' where title ilike any(array['%IELTS%','%TOEFL%','%Academic Writing%','%Beasiswa%','%Kampus%']);
update public.programs set audience='sma' where title ilike '%Smart English%' and audience='umum';

-- 4) Track TOEFL ITP (kerangka; item diisi lewat CMS admin karena answer key tetap server-side)
insert into public.programs(slug,title,description,price,duration_weeks,status,audience,level_cefr) values
('toefl-itp-preparation','TOEFL ITP Preparation (Exit Test Kampus)',
 'Persiapan TOEFL ITP untuk syarat kelulusan (exit test) mahasiswa: Listening Comprehension, Structure & Written Expression, dan Reading Comprehension, lengkap dengan simulasi penuh berformat ITP.',1500000,8,'published','mahasiswa','B1')
on conflict(slug) do update set title=excluded.title,description=excluded.description,price=excluded.price,duration_weeks=excluded.duration_weeks,status='published',audience='mahasiswa',level_cefr='B1',updated_at=now();

insert into public.tests(slug,title,test_type,duration_minutes,price,instructions,status,version,validation_status,validation_notes,score_format) values
('toefl-itp-form-a','TOEFL ITP Simulation — Form A','toefl',115,0,
 'Simulasi berformat ITP (Listening, Structure & Written Expression, Reading). skor ITP yang ditampilkan adalah estimasi internal, bukan skor resmi ETS/IELTS/TOEFL.',
 'draft',1,'unvalidated','Kerangka Form A ITP; item diisi via admin/questions lalu dipromosikan ke published setelah telaah.','itp')
on conflict(slug) do update set title=excluded.title,test_type=excluded.test_type,duration_minutes=excluded.duration_minutes,instructions=excluded.instructions,score_format='itp',updated_at=now();

-- 5) Placement test diagnostik (item orisinal, 24 butir, tiga bagian)
insert into public.tests(slug,title,test_type,duration_minutes,price,instructions,status,version,validation_status,validation_notes,score_format) values
('placement-diagnostik-v1','Placement Test Diagnostik','placement',40,0,
 'Tes penempatan 24 butir pilihan ganda (Grammar & Structure, Vocabulary, Reading). Hasil dipetakan ke level CEFR untuk merekomendasikan jalur belajar. Bukan skor resmi tes mana pun.',
 'published',1,'classroom_ready','Item orisinal internal untuk penempatan berisiko rendah; belum dikalibrasi psikometrik penuh.','percent')
on conflict(slug) do update set title=excluded.title,duration_minutes=excluded.duration_minutes,instructions=excluded.instructions,status='published',validation_status='classroom_ready',updated_at=now();

do $$ declare pt uuid; begin
select id into pt from public.tests where slug='placement-diagnostik-v1';
delete from public.questions where test_id=pt;
insert into public.questions(test_id,section,item_type,prompt,passage,audio_url,options,answer_key,difficulty,status,position,rights_status,source_reference,reviewed_at) values
(pt,'Structure & Grammar','choice','She ___ to the library every Saturday.','',null,'["go","goes","going","gone"]'::jsonb,'"goes"'::jsonb,0.30,'published'::public.content_status,1,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Structure & Grammar','choice','Yesterday they ___ a movie at the cinema.','',null,'["watch","watches","watched","watching"]'::jsonb,'"watched"'::jsonb,0.30,'published'::public.content_status,2,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Structure & Grammar','choice','There ___ several students in the laboratory.','',null,'["is","are","was","be"]'::jsonb,'"are"'::jsonb,0.35,'published'::public.content_status,3,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Structure & Grammar','choice','I have lived in Mataram ___ 2019.','',null,'["for","since","from","during"]'::jsonb,'"since"'::jsonb,0.40,'published'::public.content_status,4,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Structure & Grammar','choice','If it rains tomorrow, we ___ the field trip.','',null,'["cancel","will cancel","cancelled","would cancel"]'::jsonb,'"will cancel"'::jsonb,0.45,'published'::public.content_status,5,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Structure & Grammar','choice','The report ___ by the committee last week.','',null,'["reviews","reviewed","was reviewed","is reviewing"]'::jsonb,'"was reviewed"'::jsonb,0.50,'published'::public.content_status,6,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Structure & Grammar','choice','He is the researcher ___ paper won the award.','',null,'["who","whom","which","whose"]'::jsonb,'"whose"'::jsonb,0.55,'published'::public.content_status,7,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Structure & Grammar','choice','By the time we arrived, the lecture ___ already begun.','',null,'["has","had","have","having"]'::jsonb,'"had"'::jsonb,0.55,'published'::public.content_status,8,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Structure & Grammar','choice','She suggested ___ the meeting until Monday.','',null,'["postpone","to postpone","postponing","postponed"]'::jsonb,'"postponing"'::jsonb,0.60,'published'::public.content_status,9,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Structure & Grammar','choice','Hardly ___ sat down when the phone rang.','',null,'["I had","had I","I have","did I"]'::jsonb,'"had I"'::jsonb,0.75,'published'::public.content_status,10,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Structure & Grammar','choice','The committee demanded that the data ___ verified before publication.','',null,'["is","be","was","were being"]'::jsonb,'"be"'::jsonb,0.80,'published'::public.content_status,11,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Structure & Grammar','choice','Not only the results ___ disputed, but also the method itself.','',null,'["was","were","has been","is"]'::jsonb,'"were"'::jsonb,0.80,'published'::public.content_status,12,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Vocabulary','choice','The medicine should be kept in a cool, ___ place.','',null,'["dry","humid","shady","locked"]'::jsonb,'"dry"'::jsonb,0.35,'published'::public.content_status,13,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Vocabulary','choice','The manager gave a ___ explanation that everyone could follow.','',null,'["vague","clear","lengthy","formal"]'::jsonb,'"clear"'::jsonb,0.35,'published'::public.content_status,14,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Vocabulary','choice','The two accounts of the accident are ___; they do not match at all.','',null,'["consistent","identical","contradictory","parallel"]'::jsonb,'"contradictory"'::jsonb,0.55,'published'::public.content_status,15,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Vocabulary','choice','Regular exercise can ___ the risk of heart disease.','',null,'["mitigate","aggravate","induce","suspend"]'::jsonb,'"mitigate"'::jsonb,0.60,'published'::public.content_status,16,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Vocabulary','choice','The witness gave a ___ account, omitting nothing important.','',null,'["partial","cursory","meticulous","tentative"]'::jsonb,'"meticulous"'::jsonb,0.70,'published'::public.content_status,17,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Vocabulary','choice','The committee deemed the proposal ___, lacking both evidence and a feasible plan.','',null,'["compelling","tentative","tenuous","salient"]'::jsonb,'"tenuous"'::jsonb,0.85,'published'::public.content_status,18,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Reading Comprehension','choice','Why was the workshop rescheduled?','The faculty development workshop originally set for Thursday has been moved to Friday afternoon because the keynote speaker''s flight was delayed. Participants who cannot attend the new slot may watch the recorded session on the learning portal.','',null,'["The room was double-booked","The keynote speaker''s flight was delayed","The portal crashed on Thursday","The faculty requested Friday"]'::jsonb,'"The keynote speaker''s flight was delayed"'::jsonb,0.35,'published'::public.content_status,19,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Reading Comprehension','choice','What option is available for those who cannot attend?','The faculty development workshop originally set for Thursday has been moved to Friday afternoon because the keynote speaker''s flight was delayed. Participants who cannot attend the new slot may watch the recorded session on the learning portal.','',null,'["Join another workshop","Watch the recorded session","Request a refund","Attend by video call"]'::jsonb,'"Watch the recorded session"'::jsonb,0.35,'published'::public.content_status,20,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Reading Comprehension','choice','What is the main idea of the passage?','Mangrove forests act as natural barriers between land and sea. Their tangled roots trap sediments and slow incoming waves, which reduces coastal erosion and lessens damage during storms. Mangroves also store large amounts of carbon in their waterlogged soils. When these forests are cleared for ponds or development, both the shoreline and the carbon store are affected. Restoration projects therefore often prioritize replanting native mangrove species in areas where tidal flow remains intact.','',null,'["Mangroves grow fastest in cleared areas","Mangroves protect coasts and store carbon","Storms benefit from mangrove clearing","Ponds improve tidal flow"]'::jsonb,'"Mangroves protect coasts and store carbon"'::jsonb,0.45,'published'::public.content_status,21,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Reading Comprehension','choice','According to the passage, why is tidal flow important for restoration?','Mangrove forests act as natural barriers between land and sea. Their tangled roots trap sediments and slow incoming waves, which reduces coastal erosion and lessens damage during storms. Mangroves also store large amounts of carbon in their waterlogged soils. When these forests are cleared for ponds or development, both the shoreline and the carbon store are affected. Restoration projects therefore often prioritize replanting native mangrove species in areas where tidal flow remains intact.','',null,'["It brings nutrients to ponds","It keeps sediments moving inland","Restoration depends on natural water movement","It lowers the cost of replanting"]'::jsonb,'"Restoration depends on natural water movement"'::jsonb,0.60,'published'::public.content_status,22,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Reading Comprehension','choice','What can be inferred about single-use plastics under the new policy?','Beginning next semester, campus canteens will charge a small deposit for reusable food containers. Students who return the containers to collection points receive the deposit back in their campus account. The policy replaces the earlier ban on single-use plastics, which proved difficult to enforce because vendors continued to receive shipments. Administrators expect the deposit system to reduce plastic waste without costing vendors additional money.','',null,'["The plastics ban was strictly enforced","The deposit system replaces the ban","Vendors will pay for the containers","Collection points will be removed"]'::jsonb,'"The deposit system replaces the ban"'::jsonb,0.70,'published'::public.content_status,23,'original','Placement Diagnostik v1 — item orisinal internal.',now()),
(pt,'Reading Comprehension','choice','Which claim is best supported by the passage?','Sleep researchers have long noted that adolescents experience a shift in circadian rhythm, making later sleep and later waking biologically natural. Schools that moved their start times later report modest gains in attendance and self-reported alertness, though academic gains are smaller and take longer to appear. Critics worry about scheduling conflicts with sports and family routines. The evidence suggests that start-time changes are helpful but not a complete solution to adolescent sleep deprivation.','',null,'["Later start times solve adolescent sleep problems","Circadian shifts make late waking natural for adolescents","Sports schedules have no effect on school policy","Academic gains appear immediately"]'::jsonb,'"Circadian shifts make late waking natural for adolescents"'::jsonb,0.75,'published'::public.content_status,24,'original','Placement Diagnostik v1 — item orisinal internal.',now());
end $$;

commit;
