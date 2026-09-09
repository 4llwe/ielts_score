-- Normalize exam-brand usage to independent preparation descriptions.
begin;
update public.programs set
  title = case slug
    when 'ielts-private' then 'IELTS Preparation Private Coaching'
    when 'ielts-whv' then 'IELTS Preparation for WHV'
    when 'toefl-ielts-private' then 'TOEFL & IELTS Preparation Private Coaching'
    when 'prediction-test' then 'TOEFL & IELTS Preparation Practice'
    when 'toefl-official-registration' then 'TOEFL Preparation Consultation'
    else title end,
  category = case
    when category = 'IELTS' then 'IELTS Preparation'
    when category = 'TOEFL' then 'TOEFL Preparation'
    else category end,
  description = case when slug = 'toefl-official-registration'
    then 'Konsultasi strategi belajar independen. Tidak mencakup pendaftaran atau penyelenggaraan tes resmi.'
    else description end
where slug in ('ielts-online','ielts-private','ielts-academic','ielts-whv','toefl-preparation','toefl-ielts-private','prediction-test','toefl-official-registration');

update public.tests set title = case
  when title = 'TOEFL Full Practice' then 'TOEFL Preparation Full Practice'
  when title = 'IELTS Full Practice' then 'IELTS Preparation Full Practice'
  when title like 'IELTS %' and title not like 'IELTS Preparation %' then regexp_replace(title, '^IELTS ', 'IELTS Preparation ')
  when title like 'TOEFL %' and title not like 'TOEFL Preparation %' then regexp_replace(title, '^TOEFL ', 'TOEFL Preparation ')
  else title end;
commit;
