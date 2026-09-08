create table if not exists public.institution_profile (
  id boolean primary key default true check (id = true),
  name text not null,
  legal_position text not null,
  profile_statement text not null,
  vision text not null,
  mission jsonb not null default '[]'::jsonb,
  values_list jsonb not null default '[]'::jsonb,
  learning_model jsonb not null default '[]'::jsonb,
  founder_name text not null,
  founder_title text not null,
  address text not null,
  phone text not null,
  email text not null,
  disclaimer text not null,
  updated_at timestamptz not null default now()
);
alter table public.institution_profile enable row level security;
drop policy if exists "Public can read institution profile" on public.institution_profile;
create policy "Public can read institution profile" on public.institution_profile for select using (true);
insert into public.institution_profile (id,name,legal_position,profile_statement,vision,mission,values_list,learning_model,founder_name,founder_title,address,phone,email,disclaimer) values (
 true,'IELTS_MATE','Lembaga persiapan dan pembelajaran bahasa Inggris independen',
 'IELTS_MATE adalah lembaga persiapan dan pembelajaran bahasa Inggris yang menghadirkan program terstruktur untuk membantu peserta mengembangkan kemampuan akademik, profesional, dan komunikasi sehari-hari. Pembelajaran memadukan diagnosis awal, kelas terarah, latihan mandiri, umpan balik, serta pemantauan progres dalam satu ekosistem digital.',
 'Menjadi lembaga persiapan bahasa Inggris yang tepercaya, mudah diakses, dan berorientasi pada perkembangan nyata peserta dari Nusa Tenggara Barat untuk peluang pendidikan dan karier yang lebih luas.',
 '["Menyediakan pembelajaran bahasa Inggris yang terstruktur, relevan, dan terjangkau.","Mendampingi peserta melalui target belajar yang jelas, latihan terukur, dan umpan balik berkala.","Memanfaatkan teknologi untuk memperluas akses, menjaga konsistensi belajar, dan memudahkan pemantauan progres.","Mengembangkan layanan IELTS, TOEFL, General English, Academic English, dan mentoring sesuai kebutuhan peserta.","Menjalankan layanan secara transparan, bertanggung jawab, dan terus meningkatkan mutu program."]'::jsonb,
 '["Integritas","Berpusat pada peserta","Progres terukur","Aksesibilitas","Perbaikan berkelanjutan"]'::jsonb,
 '["Diagnosis kebutuhan","Rencana belajar","Kelas dan materi","Latihan terarah","Feedback manusia","Evaluasi progres","Pengakuan penyelesaian"]'::jsonb,
 'Sumawartini, M.TESOL','Founder & Program Director','Perumahan Aghniya Harmony, Terong Tawah, Kec. Labuapi, Kab. Lombok Barat, Nusa Tenggara Barat 83361','+62 878-6405-3222','sumawartinitajalli@gmail.com',
 'IELTS_MATE merupakan lembaga persiapan independen. Program latihan, diagnostic, dan sertifikat pengakuan bukan tes, skor, atau sertifikat IELTS/TOEFL resmi.'
) on conflict (id) do nothing;
