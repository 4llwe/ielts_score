import fs from 'node:fs';
const files=['index.html','assets/styles.css','assets/futuristic.css','assets/app.js','assets/production-dashboard.js','assets/production-test.js','supabase/migrations/005_full_operations.sql','netlify.toml','netlify/functions/api.mjs','data/seed.json','manifest.webmanifest','sw.js','assets/icons/icon-192.png','assets/icons/icon-512.png','README.md'];
let ok=true; for(const f of files){const p=new URL(f,import.meta.url);if(!fs.existsSync(p)){console.error('Missing',f);ok=false}}
const html=fs.readFileSync(new URL('index.html',import.meta.url),'utf8');
for(const s of ['id="main"','aria-label="Navigasi utama"','viewport']) if(!html.includes(s)){console.error('HTML check failed:',s);ok=false}
JSON.parse(fs.readFileSync(new URL('data/seed.json',import.meta.url),'utf8'));
if(!ok)process.exit(1); console.log('Project checks passed.');
