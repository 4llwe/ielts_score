const required=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','MIDTRANS_SERVER_KEY','MIDTRANS_CLIENT_KEY','SITE_URL'];
const missing=required.filter(k=>!process.env[k]);
const weak=[];
if(process.env.DEMO_MODE!=='false') weak.push('DEMO_MODE must be false');
if(process.env.SITE_URL&&!process.env.SITE_URL.startsWith('https://')) weak.push('SITE_URL must use HTTPS');
if(missing.length||weak.length){console.error(JSON.stringify({ok:false,missing,issues:weak},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,mode:'production',site:process.env.SITE_URL},null,2));
