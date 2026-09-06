import { getStore } from '@netlify/blobs';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import seed from '../../data/seed.json' with { type: 'json' };

const headers={ 'content-type':'application/json; charset=utf-8','cache-control':'no-store' };
const json=(statusCode,body)=>({statusCode,headers,body:JSON.stringify(body)});
const secret=()=>new TextEncoder().encode(process.env.JWT_SECRET || 'CHANGE-ME-IN-NETLIFY');
async function store(){ return getStore({name:'ielts-mate-data',consistency:'strong'}); }
async function read(key,fallback){ try{return (await (await store()).get(key,{type:'json'})) ?? fallback}catch{return fallback} }
async function write(key,value){ await (await store()).setJSON(key,value); }
async function actor(event){const raw=event.headers.authorization?.replace(/^Bearer /,'');if(!raw)return null;try{return (await jwtVerify(raw,secret())).payload}catch{return null}}
const allowed=(user,roles)=>user&&roles.includes(user.role);

export default async (request,context)=>{
 const url=new URL(request.url); const path=url.pathname.replace(/^\/api\/?/,''); const method=request.method;
 if(path==='health') return Response.json({ok:true,service:'IELTS_MATE API',time:new Date().toISOString()});
 if(path==='auth/login'&&method==='POST'){
   const {email,password,role='student'}=await request.json();
   if(!email||!password||password.length<8) return new Response(JSON.stringify({error:'Kredensial tidak valid'}),{status:400,headers});
   const demo=process.env.DEMO_MODE!=='false';
   if(!demo){
     const validEmail=email===process.env.ADMIN_EMAIL;
     const validPassword=process.env.ADMIN_PASSWORD_HASH && await bcrypt.compare(password,process.env.ADMIN_PASSWORD_HASH);
     if(!validEmail||!validPassword) return new Response(JSON.stringify({error:'Email atau password salah'}),{status:401,headers});
   }
   const safeRole=demo?role:'admin';
   const token=await new SignJWT({email,role:safeRole}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('2h').sign(secret());
   return Response.json({token,user:{email,role:safeRole},demo});
 }
 if(path==='public'&&method==='GET'){
   const data=await read('content',seed); return Response.json(data,{headers:{'cache-control':'public,max-age=60'}});
 }
 const user=await actor({headers:Object.fromEntries(request.headers)});
 if(path==='admin/content'&&method==='GET'){
   if(!allowed(user,['admin'])) return new Response(JSON.stringify({error:'Forbidden'}),{status:403,headers});
   return Response.json(await read('content',seed));
 }
 if(path==='admin/content'&&method==='PUT'){
   if(!allowed(user,['admin'])) return new Response(JSON.stringify({error:'Forbidden'}),{status:403,headers});
   const data=await request.json(); await write('content',data);
   const logs=await read('audit',[]); logs.unshift({id:crypto.randomUUID(),actor:user.email,action:'content.update',time:new Date().toISOString()}); await write('audit',logs.slice(0,500));
   return Response.json({ok:true});
 }
 if(path==='admin/audit'&&method==='GET'){
   if(!allowed(user,['admin'])) return new Response(JSON.stringify({error:'Forbidden'}),{status:403,headers});
   return Response.json(await read('audit',[]));
 }
 return new Response(JSON.stringify({error:'Not found'}),{status:404,headers});
};

export const config={path:'/api/*'};
