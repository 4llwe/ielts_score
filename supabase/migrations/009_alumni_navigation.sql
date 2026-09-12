update public.site_content
set value = '[{"id":"home","label":"Home","href":"/home","order":1,"active":true},{"id":"programs","label":"Program","href":"/programs","order":2,"active":true},{"id":"tests","label":"Tes Online","href":"/tests","order":3,"active":true},{"id":"pricing","label":"Paket & Harga","href":"/pricing","order":4,"active":true},{"id":"resources","label":"Sumber Belajar","href":"/resources","order":5,"active":true},{"id":"about","label":"Profil Lembaga","href":"/about","order":6,"active":true},{"id":"alumni","label":"Alumni & Testimoni","href":"/alumni","order":7,"active":true},{"id":"contact","label":"Kontak","href":"/contact","order":8,"active":true}]'::jsonb,
    updated_at = now()
where key = 'navigation';
