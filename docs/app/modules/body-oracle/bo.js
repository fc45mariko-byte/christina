/* Body Oracle — the self-observation module of Christina.
 *
 * Ported from fc45mariko-byte/bodyoracle (index.html). Body Oracle's own logic is kept as it was;
 * what changed is where it lives:
 *   - storage goes through store.js into Christina's shared database
 *   - screens render inside Christina's page (boRoot), with Christina's tab bar or sidebar around them
 *   - its four sections (Today, Rituals, Prayers, Archive) are a segmented control at the top
 *   - the + menu is a list sheet; overlays use #bo-sheet / #bo-modal
 *   - past months are read-only, and archetype readings are opt-in (Settings → Oracle readings)
 * From here on this file is the module's source. Body Oracle's original code style (compact lines) is kept
 * so it can still be compared with the original repository. */
import { render as christinaRender } from '../../core/render.js';
import { register, registry } from '../../core/registry.js';
import { openModule } from '../../shell/nav.js';
import { DB as CDB, data as CData } from '../../core/db.js';
import { OTHER_CATEGORY_ID } from '../../core/catalog.js';
import { extendIcons, ICON_PATHS } from '../../ui/icons.js';
import { BODB, mergeShared } from './store.js';

/* BODY ORACLE — local-first personal world. All data lives in this browser's IndexedDB on the device. */

/* ================= helpers ================= */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jp=o=>esc(JSON.stringify(o));
const uid=()=>{try{return crypto.randomUUID()}catch(e){return Date.now().toString(36)+Math.random().toString(36).slice(2,10)}};
const pad=n=>String(n).padStart(2,'0');
const DAY=864e5;
const dkey=d=>{d=new Date(d);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const fmt={
  day:d=>new Date(d).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}),
  dayLong:d=>new Date(d).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}),
  short:d=>new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'}),
  month:d=>new Date(d).toLocaleDateString('en-US',{month:'long',year:'numeric'}),
  time:d=>{d=new Date(d);return pad(d.getHours())+':'+pad(d.getMinutes())},
};
const toLocalInput=d=>dkey(d)+'T'+fmt.time(d);
const plural=(n,a,b)=>`${n} ${n===1?a:b}`;
const times=n=>n===1?'once':n===2?'twice':n+' times';
function setPath(o,p,v){const k=p.split('.');let t=o;for(let i=0;i<k.length-1;i++){if(t[k[i]]==null)t[k[i]]={};t=t[k[i]];}t[k[k.length-1]]=v;}
function lum(hex){const m=/^#?([0-9a-f]{6})$/i.exec(hex||'');if(!m)return 1;const n=parseInt(m[1],16);const c=[n>>16,(n>>8)&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*c[0]+.7152*c[1]+.0722*c[2];}
const clone=o=>JSON.parse(JSON.stringify(o));

/* ================= icons ================= */
const IC={
  home:'<path d="M4 10.5 12 4l8 6.5V20h-5.5v-6h-5v6H4z"/>',
  map:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4"/>',
  threads:'<path d="M4.5 7.5c4.5-3 10.5-3 15 0M4.5 12.5c4.5-3 10.5-3 15 0M4.5 17.5c4.5-3 10.5-3 15 0"/>',
  archive:'<rect x="3.5" y="4.5" width="17" height="5" rx="1"/><path d="M5 9.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M10 13h4"/>',
  settings:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  chev:'<path d="M9 5l7 7-7 7"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  up:'<path d="m6 15 6-6 6 6"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  body:'<circle cx="12" cy="4.5" r="2"/><path d="M12 7.5v6.5M6.5 9.5 12 8l5.5 1.5M9.5 21l2.5-7 2.5 7"/>',
  mind:'<path d="M9.5 4.5A3 3 0 0 0 6.5 7.3 3 3 0 0 0 4.8 12a3 3 0 0 0 1.7 4.7 3 3 0 0 0 3 2.8c1.4 0 2.5-1 2.5-2.5V7c0-1.4-1.1-2.5-2.5-2.5zM14.5 4.5a3 3 0 0 1 3 2.8 3 3 0 0 1 1.7 4.7 3 3 0 0 1-1.7 4.7 3 3 0 0 1-3 2.8c-1.4 0-2.5-1-2.5-2.5"/>',
  ritual:'<path d="M12 3c1.6 2.1 1.6 3.6 0 5.2-1.6-1.6-1.6-3.1 0-5.2zM9 10.5h6V20H9zM6 20h12"/>',
  intention:'<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  sign:'<path d="M12 3l1.8 6.2L20 12l-6.2 1.8L12 21l-1.8-7.2L4 12l6.2-2.8z"/>',
  note:'<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M9.5 12h6M9.5 15.5h6"/>',
  photo:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
  dream:'<path d="M17 18H8a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 19.6 11 3.5 3.5 0 0 1 17 18z"/>',
  state:'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',
  study:'<path d="M4 5.5c3-1 5.5-1 8 1 2.5-2 5-2 8-1V19c-3-1-5.5-1-8 1-2.5-2-5-2-8-1zM12 6.5V20"/>',
  heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.5"/>',
  leaf:'<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7"/>',
  plane:'<path d="M3.5 13 20.5 5l-6 15.5-3-6.5z"/><path d="m11.5 14 9-9"/>',
  money:'<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.3c-.5-.9-1.4-1.3-2.5-1.3-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2-.4-2.5-1.3M12 6.5v11"/>',
  oracle:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7l1.2 3.8L17 12l-3.8 1.2L12 17l-1.2-3.8L7 12l3.8-1.2z"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash:'<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  drag:'<path d="M5 7h14M5 12h14M5 17h14"/>',
  location:'<path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 0 0-13 0c0 5 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  tag:'<path d="M3.5 12.5V4h8.5l8.5 8.5-8 8z"/><circle cx="8" cy="8.5" r="1.3"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  eraser:'<path d="M8 20h12M4.5 15.5l9-9 5 5-9 9H8.5z"/>',
  pen:'<path d="M4 20l1.5-5L16 4.5l3.5 3.5L9 18.5zM14 6.5l3.5 3.5"/>',
  undo:'<path d="M9 7 4.5 11.5 9 16"/><path d="M4.5 11.5H14a5.5 5.5 0 0 1 0 11h-2"/>',
  candle:'<path d="M12 3c1.4 1.8 1.4 3.2 0 4.6-1.4-1.4-1.4-2.8 0-4.6zM9.5 10h5v10h-5z"/>',
  flower:'<circle cx="12" cy="9" r="2.2"/><path d="M12 6.8c0-3 3.5-3 3.5 0s-3.5 2.2-3.5 2.2M12 6.8c0-3-3.5-3-3.5 0s3.5 2.2 3.5 2.2M14.2 9c3 0 3 3.5 0 3.5s-2.2-3.5-2.2-3.5M9.8 9c-3 0-3 3.5 0 3.5S12 9 12 9M12 11.2V21M12 17c-2-2-4.5-2-5.5-1"/>',
  key:'<circle cx="8" cy="15" r="3.5"/><path d="m10.5 12.5 9-9M16.5 6.5l2 2M14 9l2 2"/>',
  wave:'<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/>',
  prayer:'<path d="M3.5 6.2c3-1.1 5.6-.8 8.5 1.1 2.9-1.9 5.5-2.2 8.5-1.1v12.6c-3-1-5.6-.7-8.5 1.2-2.9-1.9-5.5-2.2-8.5-1.2z"/><path d="M12 7.3v12.6"/>',
  star:'<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
  more:'<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  play:'<path d="M8 5.5v13l10-6.5z"/>',
  bag:'<path d="M5.5 8h13l-1 12.5h-11z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  music:'<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  sound:'<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  people:'<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5M15.5 5.5a3 3 0 0 1 0 5.6M17.5 14c1.6.6 2.7 2.2 3 5"/>',
};
const ico=(n,s=22)=>`<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]||ICON_PATHS[n]||IC.sign}</svg>`;
extendIcons(IC);
const ICON_CHOICES=['body','mind','ritual','intention','sign','note','photo','dream','state','study','heart','sun','eye','leaf','plane','money','oracle','home','candle','flower','key','wave','people','threads'];

/* ================= constants ================= */
const PALETTE=['#c98d7c','#d6b46a','#a9bfa0','#8fa7c4','#b49ccc','#d39aa8','#7f8fb8','#c7a36a','#9fb7a8','#d4875f','#b59a7a','#e0cfa6'];
/* The person's own colour language. Names are labels only; the app never reads meaning into them. */
const DEFAULT_PALETTE=[['Rose','#e0a3ad'],['Moss','#8fa883'],['Lavender','#b4a7dc'],['Amber','#e0ad5f'],['Blue','#7fa3d1'],['Cream','#e9dfc8']];
const ACCENTS=[{n:'Default',c:'#f2f2f3'},{n:'Bone',c:'#e6dccb'},{n:'Rose',c:'#d9a5a5'},{n:'Ember',c:'#d4875f'},{n:'Sage',c:'#a9bfa0'},{n:'Lilac',c:'#b9aed6'},{n:'Gold',c:'#d6b46a'}];
const CAT_DEF={Body:['#c98d7c','body'],Mind:['#9b97c2','mind'],Ritual:['#c7a36a','ritual'],Beauty:['#d39aa8','flower'],Manifestation:['#d8c08f','intention'],Dreams:['#7f8fb8','dream'],Study:['#8fae9b','study'],Relationships:['#c47f8a','heart'],Home:['#b59a7a','home'],Money:['#a8b07a','money'],Travel:['#7fa7b5','plane'],Creativity:['#d1a05f','sign'],Spirituality:['#b49ccc','oracle'],Social:['#d08f6c','people'],Work:['#8d9aa6','note'],Intention:['#e0cfa6','intention'],Night:['#6f7aa6','intention']};
const SUGGESTED_CATS=['Body','Mind','Ritual','Beauty','Manifestation','Dreams','Study','Relationships','Home','Money','Travel','Creativity','Spirituality','Social','Work'];
const KINDS={
  note:{label:'Note',icon:'note',prompt:"What's happening?",color:'#b9b0a4'},
  mind:{label:'Mind',icon:'mind',prompt:"What's on your mind?",color:'#9b97c2'},
  photo:{label:'Photo or video',icon:'photo',prompt:'What is this moment?',color:'#b9b0a4'},
  body:{label:'Body',icon:'body',color:'#c98d7c'},
  ritual:{label:'Ritual',icon:'ritual',prompt:'How did it feel?',color:'#c7a36a'},
  intention:{label:'Intention',icon:'intention',color:'#e0cfa6'},
  sign:{label:'Sign',icon:'sign',prompt:'What did you notice?',color:'#d6b46a'},
  dream:{label:'Dream',icon:'dream',prompt:'What did you dream?',color:'#7f8fb8'},
  state:{label:'State',icon:'state',color:'#a39a8f'},
};
const RADIAL_TYPES=[
  {action:'newRitual',label:'Ritual',icon:'ritual'},{action:'newPrayer',label:'Prayer',icon:'prayer'},
  {action:'body',label:'Body',icon:'body'},{action:'entry:mind',label:'Mind',icon:'mind'},{action:'ritual',label:'Ritual done',icon:'check'},
  {action:'sign',label:'Sign',icon:'sign'},{action:'intention',label:'Intention',icon:'intention'},{action:'entry:photo',label:'Photo',icon:'photo'},
  {action:'entry:note',label:'Note',icon:'note'},{action:'entry:dream',label:'Dream',icon:'dream'},{action:'state',label:'State',icon:'state'},
  {action:'sigil',label:'Sigil',icon:'pen'},
];
const MODS={}; // filled below

/* ================= storage ================= */
/* Storage lives in Christina's shared database; see store.js. */
const DB=BODB;
const S={items:new Map(),settings:null};
const get=id=>id?S.items.get(id):undefined;
const all=type=>[...S.items.values()].filter(x=>x.type===type);
const ordered=type=>all(type).sort((a,b)=>(a.order??1e9)-(b.order??1e9)||(a.createdAt||0)-(b.createdAt||0));
const entries=()=>all('entry').sort((a,b)=>b.date-a.date);
async function save(x){x.updatedAt=Date.now();if(!x.createdAt)x.createdAt=x.updatedAt;S.items.set(x.id,x);try{await DB.put(x);}catch(e){toast('Could not save. Storage may be full.');}}
async function removeItem(id){S.items.delete(id);try{await DB.del(id);}catch(e){}}
async function saveSettings(){try{await DB.put(S.settings);}catch(e){}}
let ssTimer;function saveSettingsSoon(){clearTimeout(ssTimer);ssTimer=setTimeout(saveSettings,400);}

/* ================= images ================= */
const IMG=new Map();
/* A video is stored as two blobs: its poster frame under the media id (so every image surface shows it) and the video under id~v. */
const VID=new Map();
function cacheBlob(k,b){k=String(k);if(k.endsWith('~o'))return;const isV=k.endsWith('~v');const m=isV?VID:IMG;const key=isV?k.slice(0,-2):k;const old=m.get(key);if(old)URL.revokeObjectURL(old);m.set(key,URL.createObjectURL(b));}
async function loadImages(){try{for(const [k,b] of await DB.allBlobs())if(b)cacheBlob(k,b);}catch(e){}}
async function putBlob(k,b){await DB.putBlob(k,b);cacheBlob(k,b);}
function dropImage(id){if(!id)return;for(const m of[IMG,VID]){const u=m.get(id);if(u)URL.revokeObjectURL(u);m.delete(id);}for(const k of[id,id+'~o',id+'~v'])DB.delBlob(k).catch(()=>{});}
async function copyImage(id){const nid=uid();const b=await DB.getBlob(id);if(!b)return null;for(const x of['~o','~v']){const o=await DB.getBlob(id+x);if(o)await putBlob(nid+x,o);}await putBlob(nid,b);return nid;}
const isVid=id=>!!id&&VID.has(id);
const vbadge=()=>'';
/* a video takes the same place and crop as a picture: muted, looping its first seconds while on screen */
const sneak=id=>`<video class="sneak" src="${VID.get(id)}" poster="${IMG.get(id)||''}" muted playsinline loop preload="metadata" disablepictureinpicture aria-hidden="true"></video>`;
function pic(id){if(!id||!IMG.get(id))return'';return isVid(id)?sneak(id):`<img src="${IMG.get(id)}" alt="" loading="lazy">`;}
const SNEAK_SECS=4;
const sneakIO='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(en=>{const v=en.target;if(en.isIntersecting&&!matchMedia('(prefers-reduced-motion:reduce)').matches){v.muted=true;v.play().catch(()=>{});}else v.pause();}),{threshold:.35}):null;
function watchSneaks(){if(!sneakIO)return;sneakIO.disconnect();$$('video.sneak').forEach(v=>sneakIO.observe(v));}
/* where a person would watch it: a real player; elsewhere the poster with a play badge */
const media=(id,cls='')=>isVid(id)?`<button class="vframe ${cls}" data-a="playVid" data-id="${id}" aria-label="Watch with sound">${sneak(id)}<i class="vsound">${ico('sound',14)}</i></button>`:imgTag(id);
const MAX_VIDEO=250*1024*1024;
function videoPoster(file){return new Promise(res=>{const url=URL.createObjectURL(file);const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';let done=false;
  const finish=b=>{if(done)return;done=true;URL.revokeObjectURL(url);res(b);};
  const fallback=()=>{const c=document.createElement('canvas');c.width=960;c.height=720;const g=c.getContext('2d');g.fillStyle='#1f1f22';g.fillRect(0,0,960,720);g.fillStyle='rgba(255,255,255,.6)';g.beginPath();g.moveTo(440,300);g.lineTo(440,420);g.lineTo(540,360);g.closePath();g.fill();c.toBlob(b=>finish(b),'image/jpeg',.85);};
  const t=setTimeout(fallback,8000);
  v.onloadeddata=()=>{try{v.currentTime=Math.min(1,(v.duration||2)/3);}catch(e){clearTimeout(t);fallback();}};
  v.onseeked=()=>{clearTimeout(t);try{const max=1400,sc=Math.min(1,max/Math.max(v.videoWidth,v.videoHeight));const c=document.createElement('canvas');c.width=Math.round(v.videoWidth*sc)||960;c.height=Math.round(v.videoHeight*sc)||720;c.getContext('2d').drawImage(v,0,0,c.width,c.height);c.toBlob(b=>b?finish(b):fallback(),'image/jpeg',.85);}catch(e){fallback();}};
  v.onerror=()=>{clearTimeout(t);fallback();};v.src=url;});}
function playVideo(id){const m=$('#bo-modal');if(!isVid(id))return;m.hidden=false;m.innerHTML=`<div class="vplay"><button class="ibtn vclose" data-c="x" aria-label="Close video">${ico('close',22)}</button><video src="${VID.get(id)}" poster="${IMG.get(id)||''}" controls autoplay playsinline></video></div>`;
  m.onclick=e=>{if(e.target.closest('[data-c="x"]')){m.hidden=true;m.innerHTML='';m.onclick=null;}};}
const imgTag=id=>pic(id);
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
async function toOrig(file){const url=URL.createObjectURL(file);try{const img=await loadImg(url);const max=2000;const s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return await new Promise((r,j)=>c.toBlob(b=>b?r(b):j(new Error('encode')),'image/jpeg',.88));}finally{URL.revokeObjectURL(url);}}

let fileIn,pickCb=null;
function pickImage(ratio,cb){pickCb={ratio,cb};fileIn.value='';fileIn.click();}
async function onFile(){const f=fileIn.files&&fileIn.files[0];if(!f||!pickCb)return;const {ratio,cb}=pickCb;pickCb=null;
  if((f.type||'').startsWith('video/')||/\.(mov|mp4|m4v|webm|3gp)$/i.test(f.name||'')){
    if(f.size>MAX_VIDEO){toast('That video is over 250 MB. Try a shorter clip.');return;}
    toast('Adding video…');try{const poster=await videoPoster(f);const id=uid();await putBlob(id+'~v',f);await putBlob(id,poster);await cb(id);}catch(e){toast('This video could not be saved. Storage may be full.');}return;}
  try{const orig=await toOrig(f);openCropper(orig,ratio,async crop=>{const id=uid();await putBlob(id+'~o',orig);await putBlob(id,crop);await cb(id);});}
  catch(e){toast('This image could not be opened. Try a JPEG or PNG.');}}
async function recrop(id,ratio){const b=(await DB.getBlob(id+'~o'))||(await DB.getBlob(id));if(!b)return;openCropper(b,ratio,async crop=>{await putBlob(id,crop);render();});}

function openCropper(blob,ratioStr,done){
  const [rw,rh]=ratioStr.split('/').map(Number);const ratio=rw/rh;const url=URL.createObjectURL(blob);const m=$('#bo-modal');m.hidden=false;
  m.innerHTML=`<div class="crop"><div class="crop-hd"><button class="tbtn" data-c="cancel">Cancel</button><span>Crop</span><button class="tbtn strong" data-c="done">Done</button></div><div class="crop-stage"><div class="crop-frame" style="aspect-ratio:${rw}/${rh}"><img alt="" draggable="false"></div></div><label class="crop-zoom"><span>Zoom</span><input type="range" min="1" max="4" step="0.01" value="1" id="crop-z"></label></div>`;
  const frame=$('.crop-frame',m),img=$('img',m),z=$('#crop-z',m);let iw,ih,fw,fh,base,scale,tx=0,ty=0,ready=false;
  const stage=$('.crop-stage',m);
  img.onload=()=>{iw=img.naturalWidth;ih=img.naturalHeight;const sr=stage.getBoundingClientRect();let w=sr.width,h=w/ratio;if(h>sr.height){h=sr.height;w=h*ratio;}frame.style.width=w+'px';frame.style.height=h+'px';fw=w;fh=h;base=Math.max(fw/iw,fh/ih);scale=base;tx=(fw-iw*scale)/2;ty=(fh-ih*scale)/2;ready=true;apply();};
  img.src=url;
  const clamp=()=>{tx=Math.min(0,Math.max(fw-iw*scale,tx));ty=Math.min(0,Math.max(fh-ih*scale,ty));};
  const apply=()=>{clamp();img.style.width=iw*scale+'px';img.style.height=ih*scale+'px';img.style.transform=`translate(${tx}px,${ty}px)`;};
  const zoomTo=(ns,cx=fw/2,cy=fh/2)=>{ns=Math.max(base,Math.min(base*4,ns));tx=cx-(cx-tx)*ns/scale;ty=cy-(cy-ty)*ns/scale;scale=ns;z.value=scale/base;apply();};
  z.oninput=()=>ready&&zoomTo(base*z.value);
  const pts=new Map();let lastDist=null;
  frame.onpointerdown=e=>{frame.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});};
  frame.onpointermove=e=>{if(!ready||!pts.has(e.pointerId))return;const prev=pts.get(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size===1){tx+=e.clientX-prev.x;ty+=e.clientY-prev.y;apply();}
    else if(pts.size===2){const [a,b]=[...pts.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(lastDist){const r=frame.getBoundingClientRect();zoomTo(scale*d/lastDist,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);}lastDist=d;}};
  const up=e=>{pts.delete(e.pointerId);if(pts.size<2)lastDist=null;};frame.onpointerup=up;frame.onpointercancel=up;
  frame.onwheel=e=>{e.preventDefault();if(ready)zoomTo(scale*(e.deltaY<0?1.08:1/1.08));};
  const close=()=>{m.hidden=true;m.innerHTML='';m.onclick=null;URL.revokeObjectURL(url);};
  m.onclick=async e=>{const b=e.target.closest('[data-c]');if(!b)return;if(b.dataset.c==='cancel'){close();return;}if(!ready)return;
    const sw=fw/scale,sh=fh/scale;const W=Math.round(Math.min(1400,sw));const c=document.createElement('canvas');c.width=W;c.height=Math.round(W/ratio);
    c.getContext('2d').drawImage(img,-tx/scale,-ty/scale,sw,sh,0,0,c.width,c.height);
    const out=await new Promise(r=>c.toBlob(r,'image/jpeg',.86));close();if(out)await done(out);};
}

/* image slot: any image container in the app */
function slot(id,ref,ratio='1/1',cls=''){const u=id&&IMG.get(id);return `<button type="button" class="slot ${u?'has':''} ${cls}" style="aspect-ratio:${ratio}" data-a="slot" data-ref="${ref}" data-ratio="${ratio}" aria-label="${u?(isVid(id)?'Change video':'Change image'):'Add image or video'}">${u?`${pic(id)}`:`<span class="slot-plus"><i>${ico('plus',20)}</i></span>`}</button>`;}
const getPath=(o,p)=>p.split('.').reduce((t,k)=>t==null?t:t[k],o);
function parseRef(s){
  const p=s.split(':');let target,persist,isDraft=false,rest;
  if(p[0]==='dpath'){const d=cur().params.draft,path=p[1];return{get:()=>getPath(d,path),set:async nid=>{setPath(d,path,nid||null);if(nid)(d._new=d._new||[]).push(nid);render();},drop:id=>{(d._drop=d._drop||[]).push(id);},coverable:false};}
  if(p[0]==='draft'){target=cur().params.draft;isDraft=true;persist=async()=>render();rest=p.slice(1);}
  else if(p[0]==='settings'){target=S.settings;persist=async()=>{await saveSettings();render();};rest=p.slice(1);}
  else if(p[0]==='smap'){target=S.settings[p[1]]=S.settings[p[1]]||{};persist=async()=>{await saveSettings();render();};rest=p.slice(2);}
  else{target=get(p[1]);persist=async()=>{await save(target);render();};rest=p.slice(2);}
  const [field,idx]=rest;
  return{
    get:()=>idx===undefined?target[field]:(idx==='new'?null:(target[field]||[])[+idx]),
    set:async nid=>{if(idx===undefined)target[field]=nid;else{const arr=target[field]=target[field]||[];if(idx==='new'){if(nid)arr.push(nid);}else if(nid)arr[+idx]=nid;else arr.splice(+idx,1);}
      if(isDraft&&nid)(target._new=target._new||[]).push(nid);await persist();},
    drop:id=>{if(isDraft)(target._drop=target._drop||[]).push(id);else dropImage(id);},
    coverable:idx!==undefined&&idx!=='new'&&+idx>0,
    makeCover:async()=>{const arr=target[field];const [x]=arr.splice(+idx,1);arr.unshift(x);await persist();},
  };
}
function finalizeDraft(d){(d._drop||[]).forEach(dropImage);delete d._new;delete d._drop;delete d._more;delete d._anim;delete d._sitAll;delete d._rituals;return d;}

/* ================= router ================= */
const R={tab:'home',stack:[]};
const cur=()=>R.stack[R.stack.length-1]||{name:R.tab,params:{}};
function go(name,params={}){R.stack.push({name,params});render();}
function back(){R.stack.pop();render();}
function tab(t){let st=[];if(t==='map'){AS.view=MS.mode;t='archive';}else if(t==='threads'){t='archive';st=[{name:'threads',params:{}}];}else if(t==='settings'){t='home';st=[{name:'settings',params:{}}];}
  stopTimer();R.tab=t;R.stack=st;render();}
const V={};
/* Christina draws the page; Body Oracle's screen is one section of it (see boRoot below). */
function render(){christinaRender();}

/* ================= UI bits ================= */
const head=(title,{back:b=false,right=''}={})=>`<header class="hd">${b?`<button class="ibtn" data-a="back" aria-label="Back">${ico('back')}</button>`:''}<h1 class="t-title">${title}</h1><div class="hd-r">${right}</div></header>`;
const edHead=(title,act,label='Save')=>`<header class="ed-hd"><button class="tbtn" data-a="cancelDraft">Cancel</button><span class="ed-t">${esc(title)}</span><button class="tbtn strong" data-a="${act}">${label}</button></header>`;
const rowBtn=(icon,label,val,act,extra='')=>`<button class="row" data-a="${act}" ${extra}><span class="row-i">${ico(icon,18)}</span><span class="row-m">${label}</span><span class="row-v">${esc(val)}</span>${ico('chev',16)}</button>`;
const stChip=s=>`<span class="chip"><i class="dot" style="--c:${s.color}"></i>${esc(s.name)}</span>`;
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2000);}
function closeSheet(){const m=$('#bo-sheet');m.hidden=true;m.innerHTML='';m.onclick=null;}
function sheet(opts,title){const m=$('#bo-sheet');m.hidden=false;m.innerHTML=`<div class="sheet-bg" data-s="x"></div><div class="sheet" role="dialog">${title?`<p class="sheet-t">${esc(title)}</p>`:''}${opts.map((o,i)=>`<button class="sheet-b ${o.danger?'danger':''}" data-s="${i}">${esc(o.label)}</button>`).join('')}<button class="sheet-b cancel" data-s="x">Cancel</button></div>`;
  m.onclick=e=>{const b=e.target.closest('[data-s]');if(!b)return;closeSheet();if(b.dataset.s!=='x')opts[+b.dataset.s].fn();};}
const confirmSheet=(title,label,fn)=>sheet([{label,danger:true,fn}],title);
function pickSheet(title,items,sel,multi,done,extra){const set=new Set((sel||[]).filter(Boolean));const m=$('#bo-sheet');
  const draw=()=>{m.innerHTML=`<div class="sheet-bg" data-s="x"></div><div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sheet-hd"><p class="sheet-t">${esc(title)}</p>${multi?`<button class="tbtn strong" data-s="done">Done</button>`:''}</div><div class="sheet-list">${items.length?items.map(it=>`<button class="pick" data-s="i" data-id="${it.id}">${it.color?`<i class="dot" style="--c:${it.color}"></i>`:''}<span>${esc(it.label)}</span>${set.has(it.id)?ico('check',18):''}</button>`).join(''):`<p class="empty" style="padding:10px 4px">Nothing here yet.</p>`}${extra?`<button class="pick add" data-s="extra">${ico('plus',16)}<span>${esc(extra.label)}</span></button>`:''}${!multi&&set.size?`<button class="pick muted" data-s="none"><span>Remove link</span></button>`:''}</div></div>`;};
  draw();m.hidden=false;
  m.onclick=e=>{const b=e.target.closest('[data-s]');if(!b)return;const s=b.dataset.s;
    if(s==='x'){closeSheet();if(multi)done([...set]);return;}
    if(s==='done'){closeSheet();done([...set]);return;}
    if(s==='none'){closeSheet();done([]);return;}
    if(s==='extra'){closeSheet();extra.fn();return;}
    const id=b.dataset.id;if(multi){set.has(id)?set.delete(id):set.add(id);draw();}else{closeSheet();done([id]);}};}
function inputSheet(title,val,done,{ph='',btn='Save',multiline=false}={}){const m=$('#bo-sheet');m.hidden=false;
  m.innerHTML=`<div class="sheet-bg" data-s="x"></div><form class="sheet" id="in-form"><p class="sheet-t">${esc(title)}</p>${multiline?`<textarea class="field area" id="in-v" placeholder="${esc(ph)}">${esc(val||'')}</textarea>`:`<input class="field" id="in-v" value="${esc(val||'')}" placeholder="${esc(ph)}" autocomplete="off" enterkeyhint="done">`}<button class="btn" type="submit">${esc(btn)}</button><button class="sheet-b cancel" type="button" data-s="x">Cancel</button></form>`;
  const inp=$('#in-v');try{inp.focus();}catch(e){}
  m.onclick=e=>{if(e.target.closest('[data-s="x"]'))closeSheet();};
  $('#in-form').onsubmit=e=>{e.preventDefault();const v=$('#in-v').value.trim();closeSheet();if(v||multiline)done(v);};}

/* name + colour sheet, used for palette colours */
function colorSheet(title,{name,color},done,{onDelete}={}){const m=$('#bo-sheet');m.hidden=false;
  m.innerHTML=`<div class="sheet-bg" data-s="x"></div><form class="sheet" id="cs-form"><p class="sheet-t">${esc(title)}</p><div class="cs-row"><label class="cs-sw" style="--c:${esc(color)}"><input type="color" id="cs-c" value="${esc(color)}" aria-label="Colour"></label><input class="field" id="cs-n" value="${esc(name||'')}" placeholder="Name it, or leave it" autocomplete="off" enterkeyhint="done"></div><button class="btn" type="submit">Save</button>${onDelete?`<button class="sheet-b danger" type="button" data-s="del">Delete colour</button>`:''}<button class="sheet-b cancel" type="button" data-s="x">Cancel</button></form>`;
  const c=$('#cs-c');c.oninput=()=>c.parentNode.style.setProperty('--c',c.value);
  m.onclick=e=>{const b=e.target.closest('[data-s]');if(!b)return;if(b.dataset.s==='x')closeSheet();else if(b.dataset.s==='del'){closeSheet();onDelete();}};
  $('#cs-form').onsubmit=e=>{e.preventDefault();const v={name:$('#cs-n').value.trim(),color:c.value};closeSheet();done(v);};}

/* moon */
function moonPhase(d=new Date()){const syn=29.530588853;const ref=Date.UTC(2000,0,6,18,14);return((((d-ref)/DAY)%syn)+syn)%syn/syn;}
function moonName(){const p=moonPhase();return['New moon','Waxing crescent','First quarter','Waxing gibbous','Full moon','Waning gibbous','Last quarter','Waning crescent'][Math.floor(p*8+.5)%8];}
function moonSVG(){const p=moonPhase(),r=7,cx=8,cy=8,k=Math.cos(p*2*Math.PI),wax=p<.5,rx=(Math.abs(k)*r).toFixed(2);
  const outer=`M${cx} ${cy-r} A${r} ${r} 0 0 ${wax?1:0} ${cx} ${cy+r}`;const inner=wax?(k>0?0:1):(k>0?1:0);
  return `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width=".8" opacity=".5"/><path d="${outer} A${rx} ${r} 0 0 ${inner} ${cx} ${cy-r}Z" fill="currentColor"/></svg>`;}

/* ================= entry helpers ================= */
const ONE={Arms:'arm',Hands:'hand',Legs:'leg',Feet:'foot',Shoulders:'shoulder'};
/* Christina's rule: records lock once their month has passed. */
const isLocked=d=>dkey(d).slice(0,7)<dkey(Date.now()).slice(0,7);
const placeName=b=>!b||!b.region?'':b.side&&ONE[b.region]?`${b.side} ${ONE[b.region]}`:b.region.toLowerCase();
function entryLabel(e){
  if(e.kind==='ritual'&&get(e.ritualId))return get(e.ritualId).name;
  if(e.kind==='body'){const b=e.body||{};const pl=placeName(b);return b.sensation?`${b.sensation}${pl?` (${pl})`:''}`:(pl?pl[0].toUpperCase()+pl.slice(1):'Body observation');}
  const t=(e.text||'').trim();if(t)return t.split('\n')[0].slice(0,140);
  if(e.kind==='ritual'&&get(e.ritualId))return get(e.ritualId).name;
  if(e.kind==='state')return(e.stateIds||[]).map(get).filter(Boolean).map(s=>s.name).join(', ')||'State';
  if(e.kind==='sign'&&get(e.intentionId))return'A sign for '+get(e.intentionId).title;
  const c=(e.categoryIds||[]).map(get).filter(Boolean)[0];if(c)return c.name;
  return(KINDS[e.kind]||KINDS.note).label;}
function entryColor(e){if(e.color)return e.color;const s=(e.stateIds||[]).map(get).find(Boolean);if(s)return s.color;const c=(e.categoryIds||[]).map(get).find(Boolean);if(c)return c.color;return(KINDS[e.kind]||KINDS.note).color;}
const kindTag=e=>e.kind==='note'||e.kind==='photo'?'':(KINDS[e.kind]||{}).label||'';
/* entry colour appears only as a small accent: a dot on images, a faint tint behind text */
const tdot=c=>`<i class="tdot" style="--c:${c}"></i>`;
function tile(e,cap){const pid=(e.photoIds||[]).find(id=>IMG.get(id));const ph=pid&&IMG.get(pid);const k=KINDS[e.kind]||KINDS.note;const c=entryColor(e);
  return `<div class="tw"><button class="tile ${ph?'':'txt'}" style="--c:${c}" data-a="go" data-to="entry" data-p="${jp({id:e.id})}">${ph?`${pic(pid)}${tdot(c)}`:`<span class="tile-t">${esc(entryLabel(e))}</span><span class="tile-k">${ico(k.icon,14)}</span>`}</button>${cap?`<p class="cap">${cap}</p>`:''}</div>`;}
const lineRow=(e,showDate)=>`<button class="line" data-a="go" data-to="entry" data-p="${jp({id:e.id})}"><i class="dot" style="--c:${entryColor(e)}"></i><span class="line-t">${esc(entryLabel(e))}</span><span class="line-k">${esc(kindTag(e))}</span><time>${showDate?fmt.short(e.date)+' · ':''}${fmt.time(e.date)}</time></button>`;
const threadCount=id=>all('entry').filter(e=>(e.threadIds||[]).includes(id)).length;
function threadsByRelevance(){const last=new Map();all('entry').forEach(e=>(e.threadIds||[]).forEach(t=>{if((last.get(t)||0)<e.date)last.set(t,e.date);}));return all('thread').sort((a,b)=>(last.get(b.id)||b.createdAt||0)-(last.get(a.id)||a.createdAt||0));}
const threadRow=t=>{const n=threadCount(t.id);return `<button class="row" data-a="go" data-to="thread" data-p="${jp({id:t.id})}"><span class="thumb">${imgTag(t.coverId)||`<i style="--c:${t.color}">${ico(t.icon||'threads',20)}</i>`}</span><span class="row-m"><span class="row-t">${esc(t.name)}</span>${t.description?`<span class="row-s">${esc(t.description)}</span>`:''}<span class="row-s">${plural(n,'entry','entries')}</span></span>${ico('chev',18)}</button>`;};
function todayStates(){const k=dkey(Date.now());const set=new Set();all('entry').forEach(e=>{if(e.kind==='state'&&dkey(e.date)===k)(e.stateIds||[]).forEach(s=>set.add(s));});return set;}
function newEntryDraft(kind,extra={}){return Object.assign({id:uid(),type:'entry',kind,text:'',color:null,colorId:null,date:Date.now(),photoIds:[],categoryIds:[],stateIds:[],threadIds:[],tags:'',location:'',ritualId:null,intentionId:null},extra);}
function radialIcon(r){if(r.action.startsWith('cat:')){const c=get(r.action.slice(4));return c?c.icon:'sign';}return(RADIAL_TYPES.find(t=>t.action===r.action)||{}).icon||'sign';}

/* ================= HOME ================= */
/* Progressive discovery: some modules stay out of sight until the person has recorded a few things. */
const recorded=()=>all('entry').filter(e=>e.kind!=='state').length;
const UNLOCK={oracle:5,intention:8};
const activeThread=()=>threadsByRelevance().find(t=>threadCount(t.id)>0);
function tonightItem(){const t=S.settings.tonight;const x=t&&get(t.id);if(x)return x;const h=new Date().getHours();if(h<17&&h>=5)return null;
  return[...all('ritual'),...all('prayer')].sort(byUse).find(y=>(y.situations||[]).some(s=>/sleep|night|tonight|evening|bed/i.test(s)))||null;}
Object.assign(MODS,{
  need:{label:'What do you need?',html(){return `<section><div class="sec-h"><h2 class="sec-t">What do you need?</h2></div><div class="need-btns">
    <button class="need-b" data-a="go" data-to="need" data-p="${jp({kind:'ritual'})}"><span class="need-i">${ico('ritual',22)}</span><span><b>Rituals</b><small>Something to do</small></span>${ico('chev',16)}</button>
    <button class="need-b" data-a="go" data-to="need" data-p="${jp({kind:'prayer'})}"><span class="need-i">${ico('prayer',22)}</span><span><b>Prayers</b><small>Words to return to</small></span>${ico('chev',16)}</button>
    <button class="need-b" data-a="recordSheet"><span class="need-i">${ico('note',22)}</span><span><b>Record something</b><small>What happened</small></span>${ico('chev',16)}</button></div></section>`;}},
  tonight:{label:'For tonight',ready:()=>!!tonightItem(),hint:'Appears when you keep a ritual or prayer for tonight',html(){const x=tonightItem();if(!x)return'';const isR=x.type==='ritual';
    return `<section><div class="sec-h"><h2 class="sec-t">For tonight</h2></div><button class="tonight card" data-a="go" data-to="${isR?'ritual':'prayer'}" data-p="${jp({id:x.id})}"><span class="tn-img" ${x.color?`style="--c:${x.color}"`:''}>${imgTag(x.imageId)||ico(isR?'candle':'prayer',26)}</span><span class="tn-m"><span class="eyebrow">${isR?'Ritual':'Prayer'}</span><span class="tn-t">${esc(x.name)}</span>${(x.situations||[])[0]?`<span class="row-s">${esc(x.situations[0])}</span>`:''}</span>${ico('chev',16)}</button></section>`;}},
  yourRituals:{label:'Your rituals',html(){const rs=all('ritual').sort(byUse).slice(0,6);return `<section><div class="sec-h"><h2 class="sec-t">Your rituals</h2>${rs.length?`<button class="lnk" data-a="tab" data-t="rituals">Library</button>`:''}</div>${rs.length?`<div class="hscroll">${rs.map(r=>`<div class="rcard-h">${ritCard(r)}</div>`).join('')}</div>`:`<button class="empty-cta" data-a="new" data-t="ritual">Prepare a ritual for a moment you know will come again.</button>`}</section>`;}},
  states:{label:'How are you?',html(){const st=ordered('state'),t=todayStates();if(!st.length)return'';return `<section><div class="sec-h"><h2 class="sec-t">How are you?</h2></div><div class="chips scroll flush">${st.map(x=>`<button class="chip ${t.has(x.id)?'on':''}" data-a="logState" data-id="${x.id}" aria-pressed="${t.has(x.id)}"><i class="dot" style="--c:${x.color}"></i>${esc(x.name)}</button>`).join('')}</div></section>`;}},
  add:{label:'Add something',html(){return `<button class="add-big" data-a="radial">${ico('plus',20)}<span>Add something</span></button>`;}},
  recent:{label:'Recent',html(){const es=entries().filter(e=>e.kind!=='state').slice(0,6);return `<section><div class="sec-h"><h2 class="sec-t">Recent</h2>${es.length?`<button class="lnk" data-a="tab" data-t="map">See all</button>`:''}</div>${es.length?`<div class="grid3">${es.map(e=>tile(e)).join('')}</div>`:`<p class="empty">What you add appears here.</p>`}</section>`;}},
  thread:{label:'Active thread',ready:()=>!!activeThread(),hint:'Appears once a thread holds something',html(){const t=activeThread();if(!t)return'';return `<section><div class="sec-h"><h2 class="sec-t">Active thread</h2><button class="lnk" data-a="tab" data-t="threads">All threads</button></div><div class="list card">${threadRow(t)}</div></section>`;}},
  intention:{label:'Current intention',ready:()=>{const it=get(S.settings.currentIntentionId);return !!it&&(!it.sample||recorded()>=UNLOCK.intention);},hint:'Appears after a few entries',html(){const it=get(S.settings.currentIntentionId);if(!it)return'';
    return `<section class="card mod-int"><button class="mi-t" data-a="go" data-to="intention" data-p="${jp({id:it.id})}"><p class="eyebrow">Current intention</p><p class="mi-name">${esc(it.title)}</p></button><div class="mi-img">${slot(it.imageId,`item:${it.id}:imageId`,'1/1')}</div></section>`;}},
  oracle:{label:'Oracle',ready:()=>recorded()>=UNLOCK.oracle,hint:'Appears after a few entries',html(){const o=oracleReading();return `<section class="card mod-int"><button class="mi-t" data-a="go" data-to="oracle"><p class="eyebrow">${S.settings.oracleArchetypes?'Oracle · a reflection':'Oracle · patterns'}</p><p class="mi-name">${esc(o.noticing?`You’ve been noticing ${o.noticing.toLowerCase()}`:S.settings.oracleArchetypes?'Something to reflect on':'Patterns in what you record')}</p></button><span class="row-i">${ico('oracle',22)}</span></section>`;}},
  hero:{label:'Image & words',html(){const s=S.settings,has=s.heroImageId&&IMG.get(s.heroImageId);return `<section class="hero">${slot(s.heroImageId,'settings:heroImageId','4/3')}<button class="hero-q ${has?'on-img':''} ${s.heroText?'':'ph'}" data-a="editHero">${esc(s.heroText||'Write something for today')}</button></section>`;}},
  world:{label:'Your world',html(){const cs=ordered('category');if(!cs.length)return'';return `<section><div class="sec-h"><h2 class="sec-t">Your world</h2></div><div class="hscroll">${cs.map(c=>`<button class="wtile" data-a="mapFilter" data-f="cat:${c.id}"><span class="wimg" style="--c:${c.color}">${imgTag(c.imageId)||ico(c.icon,26)}</span><span class="wname">${esc(c.name)}</span></button>`).join('')}</div></section>`;}},
  threads:{label:'Threads',html(){const th=threadsByRelevance().slice(0,4);return `<section><div class="sec-h"><h2 class="sec-t">Threads</h2><button class="lnk" data-a="tab" data-t="threads">See all</button></div>${th.length?`<div class="list card">${th.map(threadRow).join('')}</div>`:`<p class="empty">No threads yet.</p>`}</section>`;}},
  body:{label:'Body',html(){const es=entries().filter(e=>e.kind==='body').slice(0,3);return `<section><div class="sec-h"><h2 class="sec-t">Body</h2><button class="lnk" data-a="new" data-t="body">Open body</button></div>${es.length?`<div class="lines">${es.map(e=>lineRow(e,true)).join('')}</div>`:`<p class="empty">No observations yet.</p>`}</section>`;}},
});
const HOME_DEFAULT=['need','tonight','yourRituals','states','recent','thread','intention','oracle','add','hero','world','threads','body'];
const HOME_ON=new Set(['need','tonight','yourRituals']);
const modVisible=m=>m.on&&MODS[m.type]&&(!MODS[m.type].ready||MODS[m.type].ready());
V.home={html(){const s=S.settings;const mods=s.home.filter(modVisible).map(m=>MODS[m.type].html()).filter(Boolean).join('');
  return `<header class="hd home-hd"><div class="hd-main"><h1 class="brand">${esc(s.name||'Body Oracle')}</h1><p class="sub">${fmt.dayLong(Date.now())} <span class="moon" title="${moonName()}" aria-label="${moonName()}">${moonSVG()}</span></p></div><button class="ibtn" data-a="go" data-to="settings" aria-label="Settings">${ico('settings',22)}</button></header>
  <div class="stack">${mods||`<button class="add-big" data-a="radial">${ico('plus',20)}<span>Add something</span></button>`}</div>`;}};

/* ================= MAP ================= */
const MS={mode:'timeline',filter:'all',ym:null,sel:null};
function filterList(){const f=[{k:'all',l:'All'},{k:'photos',l:'Photos'},{k:'states',l:'States'},{k:'kind:body',l:'Body'},{k:'kind:mind',l:'Mind'},{k:'kind:ritual',l:'Ritual'},{k:'intentions',l:'Intentions'},{k:'kind:sign',l:'Signs'},{k:'kind:dream',l:'Dreams'},{k:'kind:note',l:'Notes'}];
  ordered('category').forEach(c=>f.push({k:'cat:'+c.id,l:c.name,c:c.color}));threadsByRelevance().forEach(t=>f.push({k:'th:'+t.id,l:t.name,c:t.color}));
  const es=entries();return f.filter(x=>x.k==='all'||x.k===MS.filter||es.some(e=>match(e,x.k)));}
function match(e,f){if(f==='all')return true;if(f==='photos')return(e.photoIds||[]).some(id=>IMG.get(id));if(f==='states')return(e.stateIds||[]).length>0;if(f==='intentions')return e.kind==='intention'||e.kind==='sign'||!!e.intentionId;
  const [t,v]=f.split(':');if(t==='kind')return e.kind===v;if(t==='cat')return(e.categoryIds||[]).includes(v);if(t==='th')return(e.threadIds||[]).includes(v);return true;}
V.map={html(){return head('Map',{back:true})+mapBody();}};
function mapBody(){
  const fl=filterList();if(!fl.some(x=>x.k===MS.filter))MS.filter='all';
  const es=entries().filter(e=>match(e,MS.filter));
  const chips=`<div class="chips scroll">${fl.map(x=>`<button class="chip ${MS.filter===x.k?'on':''}" data-a="mapFilter" data-f="${x.k}">${x.c?`<i class="dot" style="--c:${x.c}"></i>`:''}${esc(x.l)}</button>`).join('')}</div>`;
  return chips+(MS.mode==='calendar'?calendarHTML(es):timelineHTML(es));}
function timelineHTML(es){
  if(!es.length)return MS.filter==='all'?`<button class="empty-cta" data-a="radial">Your map is empty. Each entry you add appears here under its date. Tap + to add the first one.</button>`:`<p class="empty">Nothing here yet for this filter.</p>`;
  const groups=new Map();es.forEach(e=>{const k=dkey(e.date);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(e);});
  let h='',lastM='';
  for(const [,g] of groups){const m=fmt.month(g[0].date);if(m!==lastM){h+=`<h2 class="mon">${m}</h2>`;lastM=m;}
    const photos=g.flatMap(e=>(e.photoIds||[]).filter(id=>IMG.get(id)).map(id=>({e,id})));
    const states=[...new Set(g.flatMap(e=>e.stateIds||[]))].map(get).filter(Boolean);
    const lines=g.filter(e=>!(e.kind==='state'&&!(e.text||'').trim()&&!(e.photoIds||[]).length));
    h+=`<section class="day"><h3 class="day-t">${fmt.day(g[0].date)}</h3>${states.length?`<div class="chips sm">${states.map(stChip).join('')}</div>`:''}${photos.length?`<div class="grid3">${photos.map(p=>`<button class="tile" data-a="go" data-to="entry" data-p="${jp({id:p.e.id})}">${pic(p.id)}${tdot(entryColor(p.e))}</button>`).join('')}</div>`:''}${lines.length?`<div class="lines">${lines.map(e=>lineRow(e)).join('')}</div>`:''}</section>`;}
  return h;}
function calendarHTML(es){
  const now=new Date();const base=MS.ym?new Date(MS.ym+'-01T12:00:00'):now;const y=base.getFullYear(),m=base.getMonth();
  const first=new Date(y,m,1),off=(first.getDay()+6)%7,dim=new Date(y,m+1,0).getDate(),cells=Math.ceil((off+dim)/7)*7;
  const by=new Map();es.forEach(e=>{const k=dkey(e.date);if(!by.has(k))by.set(k,[]);by.get(k).push(e);});
  const sel=MS.sel||dkey(now);const tk=dkey(now);
  let g=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<span class="wd">${d}</span>`).join('');
  for(let i=0;i<cells;i++){const d=new Date(y,m,1-off+i);const k=dkey(d);const de=by.get(k)||[];
    const cols=[...new Set(de.map(entryColor))];
    g+=`<button class="cd ${d.getMonth()!==m?'out':''} ${k===tk?'today':''} ${k===sel?'sel':''}" data-a="calDay" data-k="${k}" aria-label="${fmt.dayLong(d)}${de.length?', '+plural(de.length,'entry','entries'):''}"><span class="n">${d.getDate()}</span><span class="dots">${cols.slice(0,4).map(c=>`<i style="--c:${c}"></i>`).join('')}</span></button>`;}
  const day=(by.get(sel)||[]).slice().sort((a,b)=>b.date-a.date);const sd=new Date(sel+'T12:00:00');
  return `<div class="cal-h"><button class="ibtn" data-a="calMonth" data-d="-1" aria-label="Previous month">${ico('back',20)}</button><h2>${fmt.month(first)}</h2><button class="ibtn" data-a="calMonth" data-d="1" aria-label="Next month">${ico('chev',20)}</button></div>
  <div class="cal">${g}</div>
  <div class="cal-day"><div class="sec-h"><h2 class="sec-t">${fmt.day(sd)}</h2><button class="ibtn ring sm" data-a="newOnDay" data-k="${sel}" aria-label="Add an entry on this day">${ico('plus',16)}</button></div>${day.length?`<div class="lines">${day.map(e=>lineRow(e)).join('')}</div>`:`<p class="empty">Nothing recorded on this day.</p>`}</div>`;}

/* ================= ENTRY ================= */
V.entry={html({id}){const e=get(id);if(!e)return head('Not found',{back:true});const locked=isLocked(e.date);const ec=entryColor(e);const k=KINDS[e.kind]||KINDS.note;const ph=e.photoIds||[];
  const cats=(e.categoryIds||[]).map(get).filter(Boolean),sts=(e.stateIds||[]).map(get).filter(Boolean),ths=(e.threadIds||[]).map(get).filter(Boolean);
  const b=e.body;const rit=get(e.ritualId),it=get(e.intentionId);
  return `${head('',{back:true,right:locked?`<span class="muted" style="font-size:13px">Archived</span>`:`<button class="ibtn" data-a="editEntry" data-id="${e.id}" aria-label="Edit">${ico('edit',20)}</button>`})}
  ${ph.length?`<div class="carousel">${ph.map((pid,i)=>`<div class="car-i ${ph.length===1?'solo':''}">${isVid(pid)?media(pid,'r45'):locked?`<div class="slot has" style="aspect-ratio:4/5">${pic(pid)}</div>`:slot(pid,`item:${e.id}:photoIds:${i}`,'4/5')}</div>`).join('')}</div>`:''}
  <p class="eyebrow e-eb" style="--c:${entryColor(e)}"><i class="dot"></i>${esc(k.label)} · ${fmt.dayLong(e.date)} · ${fmt.time(e.date)}</p>
  ${b?`<p class="entry-text">${esc(b.sensation||'Observation')}${b.region?` · ${esc(placeName(b))}`:''}</p><p class="muted" style="margin-top:-8px">Intensity ${b.intensity||'–'} of 5${b.view==='back'?' · back':''}</p>`:''}
  ${rit?`<button class="row card" data-a="go" data-to="ritual" data-p="${jp({id:rit.id})}" style="margin:10px 0"><span class="row-i">${ico('ritual',18)}</span><span class="row-m"><span class="row-t">${esc(rit.name)}</span><span class="row-s">${esc(rit.purpose||'')}</span></span>${ico('chev',16)}</button>`:''}
  ${(e.text||'').trim()?`<p class="entry-text accent" style="--c:${ec}">${esc(e.text)}</p>`:(!b&&!rit?`<p class="entry-text">${esc(entryLabel(e))}</p>`:'')}
  <div class="meta">
   ${sts.length?`<div class="chips sm">${sts.map(stChip).join('')}</div>`:''}
   ${cats.length?`<div class="chips sm">${cats.map(c=>`<button class="chip" data-a="mapFilter" data-f="cat:${c.id}"><i class="dot" style="--c:${c.color}"></i>${esc(c.name)}</button>`).join('')}</div>`:''}
   ${ths.length?`<div class="chips sm">${ths.map(t=>`<button class="chip" data-a="go" data-to="thread" data-p="${jp({id:t.id})}">${ico('threads',14)}${esc(t.name)}</button>`).join('')}</div>`:''}
  </div>
  ${journalLinksHTML(e.id)}
  ${it?`<button class="row card" data-a="go" data-to="intention" data-p="${jp({id:it.id})}"><span class="row-i">${ico('intention',18)}</span><span class="row-m"><span class="row-s">Intention</span><span class="row-t">${esc(it.title)}</span></span>${ico('chev',16)}</button>`:''}
  ${e.location||e.tags?`<div class="list card mt">${e.location?`<div class="row"><span class="row-i">${ico('location',18)}</span><span class="row-m">${esc(e.location)}</span></div>`:''}${e.tags?`<div class="row"><span class="row-i">${ico('tag',18)}</span><span class="row-m">${esc(e.tags)}</span></div>`:''}</div>`:''}
  ${locked?'':`<button class="danger-link" data-a="delEntry" data-id="${e.id}">Delete entry</button>`}`;}};

/* colour row used by every entry editor: the person's palette, tap again to clear */
function entryColorPicker(d){const pal=S.settings.palette||[];const inPal=pal.some(p=>p.id===d.colorId||(!d.colorId&&p.color===d.color));
  return `<div class="swatches" role="radiogroup" aria-label="Colour">${pal.map(p=>{const on=d.colorId?d.colorId===p.id:d.color===p.color;return `<button class="sw ${on?'on':''}" style="--c:${p.color}" data-a="pickColor" data-id="${p.id}" role="radio" aria-checked="${on}" aria-label="${esc(p.name)}" title="${esc(p.name)}"></button>`;}).join('')}${d.color&&!inPal?`<button class="sw on" style="--c:${d.color}" data-a="clearColor" aria-label="Current colour, tap to clear"></button>`:''}<button class="sw add" data-a="addPaletteColor" aria-label="Add a colour to your palette">${ico('plus',16)}</button></div>${d.color?`<p class="sw-name">${esc((pal.find(p=>p.id===d.colorId)||{}).name||'')}</p>`:''}`;}
V.edit={nav:false,html({draft:d}){const k=KINDS[d.kind]||KINDS.note;const ph=d.photoIds||[];const isNew=!S.items.has(d.id);
  const cats=ordered('category'),sts=ordered('state');const thNames=(d.threadIds||[]).map(get).filter(Boolean).map(t=>t.name).join(', ');
  const kname=d.kind==='note'&&(d.categoryIds||[]).length===1&&get(d.categoryIds[0])?get(d.categoryIds[0]).name:k.label;
  return `${edHead(isNew?'New entry':'Edit entry','saveEntry')}
  <div class="ed-photo">${slot(ph[0],ph.length?'draft:photoIds:0':'draft:photoIds:new','4/3',ph.length?'':'compact')}</div>
  ${ph.length?`<div class="thumbs">${ph.slice(1).map((id,i)=>`<div>${slot(id,`draft:photoIds:${i+1}`,'1/1')}</div>`).join('')}${ph.length<10?`<div>${slot(null,'draft:photoIds:new','1/1')}</div>`:''}</div>`:''}
  ${d.kind==='ritual'?`<div class="list card" style="margin-top:12px">${rowBtn('ritual','Ritual',get(d.ritualId)?.name||'Choose','pickOne','data-f="ritualId" data-type="ritual" data-title="Which ritual?"')}</div>`:''}
  <textarea class="field area bare" id="ed-text" data-bo="text" placeholder="${esc(k.prompt||"What's happening?")}">${esc(d.text||'')}</textarea>
  <span class="lbl">Colour</span>${entryColorPicker(d)}
  ${sts.length?`<span class="lbl">State</span><div class="chips">${sts.map(s=>`<button class="chip ${(d.stateIds||[]).includes(s.id)?'on':''}" data-a="tog" data-f="stateIds" data-v="${s.id}"><i class="dot" style="--c:${s.color}"></i>${esc(s.name)}</button>`).join('')}<button class="chip dashed" data-a="newStateInline" aria-label="New state">+</button></div>`:''}
  <span class="lbl">Category</span><div class="chips">${cats.map(c=>`<button class="chip ${(d.categoryIds||[]).includes(c.id)?'on':''}" data-a="tog" data-f="categoryIds" data-v="${c.id}">${esc(c.name)}</button>`).join('')}<button class="chip dashed" data-a="newCatInline">${cats.length?'+':'+ Add a category'}</button></div>
  <button class="more-t" data-a="togMore" aria-expanded="${!!d._more}">More ${ico(d._more?'up':'down',14)}</button>
  ${d._more?`<div class="more-b"><button class="kind-pill" data-a="pickKind">${ico(k.icon,16)} ${esc(kname)} ${ico('chev',14)}</button>
  <div class="list card">
   <label class="row"><span class="row-i">${ico('clock',18)}</span><span class="row-m">Date</span><input type="datetime-local" class="dt" id="ed-date" data-bo="date" value="${toLocalInput(d.date)}"></label>
   ${rowBtn('threads','Thread',thNames||'None','pickThreads')}
   ${rowBtn('intention','Intention',get(d.intentionId)?.title||'None','pickOne','data-f="intentionId" data-type="intention" data-title="Link to an intention"')}
   <label class="row"><span class="row-i">${ico('location',18)}</span><span class="row-m">Location</span><input class="inl" id="ed-loc" data-bo="location" value="${esc(d.location||'')}" placeholder="None"></label>
   <label class="row"><span class="row-i">${ico('tag',18)}</span><span class="row-m">Tags</span><input class="inl" id="ed-tags" data-bo="tags" value="${esc(d.tags||'')}" placeholder="Add tags"></label>
  </div></div>`:''}
  <button class="btn mt" data-a="saveEntry">Save</button>`;}};

/* ================= BODY MAP ================= */
/* One half of a standing figure (x>100), head to crotch; mirrored and smoothed into a single outline. */
const FIG_HALF=[[100,10],[108.5,11],[114.5,15],[118,22],[119.2,31],[118.8,40],[117.2,48],[114.5,55],[110.8,60.5],[108.2,64.5],[108,70],
  [111,77],[120,81.5],[130,84.5],[139,88],[145,94],[148,103],[149.5,116],[150.5,131],[152,147],[154,162],
  [157,178],[160,195],[162,210],[163,222],[166,231],[168,244],[167,255],[164,263.5],[159,267.5],[155,264.5],[153,254],[152,240],
  [151.5,226],[149,206],[145,186],[142,168],[139,150],[136.5,133],[134.5,119],[131.5,109.5],
  [129.5,117],[128,129],[126,143],[123,157],[122,166],[123,177],[127,190],[131,203],[133,215],[133.5,227],
  [133,240],[131.5,256],[129.5,273],[127,291],[124.5,307],[123.5,318],[124.5,331],[126,345],[125,361],[122.5,378],[119.5,395],[117.5,407],
  [119,415.5],[122,423],[123,429.5],[119.5,433],[110.5,433.5],[106,431],[105.5,424],[106,412],[106.5,398],
  [106,380],[105.5,362],[106,346],[105.5,332],[104.5,320],[104.5,307],[103.5,290],[102.5,268],[101.5,250],[101,239],[100,235]];
function smoothPath(pts){let d=`M${pts[0][0]} ${pts[0][1]}`;const n=pts.length;
  for(let i=0;i<n;i++){const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],p3=pts[(i+2)%n];
    const c1=[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6],c2=[p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6];
    d+=`C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;}
  return d+'Z';}
const FIG_PATH=smoothPath([...FIG_HALF,...FIG_HALF.slice(1,-1).reverse().map(([x,y])=>[200-x,y])]);
const mir=d=>d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g,(m,x,y)=>`${(200-x).toFixed(1).replace(/\.0$/,'')} ${y}`);
const both=d=>d+mir(d);
/* faint anatomical cues so the shape reads as a body, not a mannequin */
const FIG_LINES={
  front:both('M104 79Q115 80.5 127 84.5')+both('M105.5 127Q114 133 124.5 127')+'M100 140V158'+both('M112.5 201Q108 211 104 218')+both('M110.5 312Q114.5 316 119 312')+both('M146.5 160Q149 163 152 161'),
  back:'M100 76V206'+both('M107 97Q120 96 124 108Q121 121 110 121')+both('M104 186Q107 189 110 186')+'M100 212V232'+both('M102 236Q115 241 129 233')+both('M110 322Q114.5 319 119 322'),
};
/* Tap areas: [name, side, cx, cy, rx, ry, rotation]. side is the body's own side, so it flips between views. */
const BODY_AREAS={
  front:[['Head',null,100,37,21,28,0],['Neck',null,100,73,11,8,0],['Shoulders','left',136,91,12,9,20],['Shoulders','right',64,91,12,9,-20],['Chest',null,100,117,25,16,0],['Stomach',null,100,157,22,19,0],['Pelvis',null,100,206,30,18,0],
    ['Arms','left',151,160,11,62,-7.5],['Arms','right',49,160,11,62,7.5],['Hands','left',160,248,10,19,-6],['Hands','right',40,248,10,19,6],['Legs','left',116,318,15,90,0],['Legs','right',84,318,15,90,0],['Feet','left',114,423,11,11,0],['Feet','right',86,423,11,11,0]],
  back:[['Head',null,100,37,21,28,0],['Neck',null,100,73,11,8,0],['Shoulders','right',136,91,12,9,20],['Shoulders','left',64,91,12,9,-20],['Upper back',null,100,118,25,20,0],['Lower back',null,100,170,22,16,0],['Hips',null,100,212,32,18,0],
    ['Arms','right',151,160,11,62,-7.5],['Arms','left',49,160,11,62,7.5],['Hands','right',160,248,10,19,-6],['Hands','left',40,248,10,19,6],['Legs','right',116,318,15,90,0],['Legs','left',84,318,15,90,0],['Feet','right',114,423,11,11,0],['Feet','left',86,423,11,11,0]],
};
const ell=(a,cls,extra='')=>`<ellipse class="${cls}" cx="${a[2]}" cy="${a[3]}" rx="${a[4]}" ry="${a[5]}"${a[6]?` transform="rotate(${a[6]} ${a[2]} ${a[3]})"`:''}${extra}/>`;
/* sel: {region, side}; marks: Map "Region|side" -> colour of the latest observation there */
function figureSVG(view,sel,marks,selColor){
  const areas=BODY_AREAS[view];const isSel=a=>sel&&sel.region===a[0]&&(!a[1]||!sel.side||sel.side===a[1]);
  const glow=areas.filter(isSel).map(a=>ell(a,'glow',` style="fill:${selColor||'var(--accent)'}"`)).join('');
  const dots=areas.map(a=>{const c=marks.get(a[0]+'|'+(a[1]||''));return c?`<circle class="mk-g" cx="${a[2]}" cy="${a[3]}" r="9" style="fill:${c}"/><circle class="mk" cx="${a[2]}" cy="${a[3]}" r="3" style="fill:${c}"/>`:'';}).join('');
  const hits=areas.slice().reverse().map(a=>`<g class="hs" data-a="bodyRegion" data-r="${a[0]}" data-side="${a[1]||''}" role="button" tabindex="0" aria-label="${a[1]?a[1]+' ':''}${a[0]}">${ell(a,'hit')}</g>`).join('');
  return `<svg class="fig" viewBox="0 0 200 444" role="img" aria-label="Body, ${view}"><defs><linearGradient id="figg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--fig-a)"/><stop offset="1" style="stop-color:var(--fig-b)"/></linearGradient><clipPath id="figc"><path d="${FIG_PATH}"/></clipPath><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs>
  <path class="shape" d="${FIG_PATH}"/><g clip-path="url(#figc)"><g filter="url(#soft)">${glow}</g><path class="anat" d="${FIG_LINES[view]}"/></g>${dots}${hits}</svg>`;}
/* where something was noticed recently: one mark per place, in the colour of the latest observation */
function bodyMarks(view,skipId){const m=new Map();const areas=BODY_AREAS[view]||[];
  entries().filter(e=>e.kind==='body'&&e.body&&e.id!==skipId&&(e.body.view||'front')===view&&Date.now()-e.date<30*DAY).forEach(e=>{
    const pair=areas.filter(a=>a[0]===e.body.region);if(!pair.length)return;const a=pair.find(x=>x[1]===e.body.side)||pair[0];
    const k=a[0]+'|'+(a[1]||'');if(!m.has(k))m.set(k,entryColor(e));});
  return m;}
let BODY_SCROLL=0;
V.body={nav:false,html({draft:d}){const b=d.body;const isNew=!S.items.has(d.id);const sens=S.settings.sensations;const sts=ordered('state');
  const marks=bodyMarks(b.view,d.id);const place=placeName(b);
  const main=b.view==='systems'?`<div class="sys-wrap"><p class="hint">Things you notice that don’t belong to one place.</p><div class="chips">${S.settings.systems.map(x=>`<button class="chip ${b.region===x?'on':''}" data-a="bodyRegion" data-r="${esc(x)}">${esc(x)}</button>`).join('')}<button class="chip dashed" data-a="addSystem">+ Add</button></div></div>`:figureSVG(b.view,b.region?{region:b.region,side:b.side}:null,marks,d.color);
  const recent=entries().filter(e=>e.kind==='body'&&e.id!==d.id).slice(0,3);
  const sheetHTML=b.region?`<div class="bsheet-bg" aria-hidden="true"></div>
  <section class="bsheet ${d._anim?'anim':''}" role="dialog" aria-label="${esc(place)}">
   <div class="bs-hd"><h2 class="bs-t" style="--c:${d.color||'transparent'}">${esc(place)}</h2><button class="ibtn sm" data-a="bodyRegion" data-r="" aria-label="Close">${ico('close',16)}</button></div>
   <span class="lbl bs-l">How does it feel?</span><div class="chips">${sens.map(x=>`<button class="chip ${b.sensation===x?'on':''}" data-a="bodySens" data-v="${esc(x)}" aria-pressed="${b.sensation===x}">${esc(x)}</button>`).join('')}<button class="chip dashed" data-a="addSens">+ Something else</button></div>
   <span class="lbl">Intensity</span><div class="intens" role="radiogroup" aria-label="Intensity">${[1,2,3,4,5].map(n=>`<button class="${b.intensity===n?'on':''}" data-a="dset" data-f="body.intensity" data-v="${n}" data-num="1" role="radio" aria-checked="${b.intensity===n}">${n}</button>`).join('')}</div>
   <span class="lbl">What do you notice?</span><textarea class="field area sm" id="body-note" data-bo="text" placeholder="In your own words">${esc(d.text||'')}</textarea>
   ${sts.length?`<span class="lbl">State</span><div class="chips">${sts.map(x=>`<button class="chip ${(d.stateIds||[]).includes(x.id)?'on':''}" data-a="tog" data-f="stateIds" data-v="${x.id}"><i class="dot" style="--c:${x.color}"></i>${esc(x.name)}</button>`).join('')}</div>`:''}
   <span class="lbl">Colour</span>${entryColorPicker(d)}
   <button class="more-t" data-a="togMore" aria-expanded="${!!d._more}">More ${ico(d._more?'up':'down',14)}</button>
   ${d._more?`<div class="more-b"><div class="list card">
    <label class="row"><span class="row-i">${ico('clock',18)}</span><span class="row-m">Date</span><input type="datetime-local" class="dt" id="body-date" data-bo="date" value="${toLocalInput(d.date)}"></label>
    ${rowBtn('threads','Thread',(d.threadIds||[]).map(get).filter(Boolean).map(t=>t.name).join(', ')||'None','pickThreads')}
   </div><span class="lbl">Image</span><div style="max-width:140px">${slot((d.photoIds||[])[0],(d.photoIds||[]).length?'draft:photoIds:0':'draft:photoIds:new','1/1')}</div></div>`:''}
   <button class="btn mt" data-a="saveBody">Save observation</button>
  </section>`:'';
  return `<header class="ed-hd"><button class="tbtn" data-a="cancelDraft">${isNew?'Cancel':'Back'}</button><span class="ed-t">${isNew?'Body':'Edit observation'}</span><span style="width:60px"></span></header>
  <div class="seg"><button class="${b.view==='front'?'on':''}" data-a="bodyView" data-v="front">Front</button><button class="${b.view==='back'?'on':''}" data-a="bodyView" data-v="back">Back</button><button class="${b.view==='systems'?'on':''}" data-a="bodyView" data-v="systems">Systems</button></div>
  <div class="bwrap">${main}</div>
  <p class="hint b-hint">${b.view==='systems'?'':'Tap where you notice something.'}</p>${b.region?'<div class="bs-space"></div>':''}
  ${recent.length?`<div class="sec-h mt"><h2 class="sec-t">Recently noticed</h2></div><div class="lines">${recent.map(e=>lineRow(e,true)).join('')}</div>`:''}
  ${sheetHTML}`;},
  after({draft:d}){const sh=$('.bsheet');const fresh=d._anim;delete d._anim;if(!sh)return;sh.scrollTop=BODY_SCROLL;sh.onscroll=()=>{BODY_SCROLL=sh.scrollTop;};
    /* keep the chosen place in view above the sheet */
    const g=$('.fig .glow');if(fresh&&g){const main=$('#main');const r=g.getBoundingClientRect(),top=sh.getBoundingClientRect().top;const want=top/2+20;const dy=(r.top+r.height/2)-want;if(Math.abs(dy)>20)main.scrollBy({top:dy,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});}}};

/* ================= THREADS ================= */
const TS={sort:'rel'};
V.threads={html(){const th=TS.sort==='az'?all('thread').sort((a,b)=>a.name.localeCompare(b.name)):threadsByRelevance();
  return `${head('Threads',{back:true,right:`<button class="ibtn" data-a="new" data-t="thread" aria-label="New thread">${ico('plus')}</button>`})}
  <div class="seg"><button class="${TS.sort==='rel'?'on':''}" data-a="threadSort" data-v="rel">Relevance</button><button class="${TS.sort==='az'?'on':''}" data-a="threadSort" data-v="az">A–Z</button></div>
  ${th.length?`<div class="list card">${th.map(threadRow).join('')}</div>`:`<button class="empty-cta" data-a="new" data-t="thread">No threads yet. A thread is a long-running part of your life: My Body, Germany, Becoming Her. Tap to create one.</button>`}`;}};
V.thread={html({id}){const t=get(id);if(!t)return head('Not found',{back:true});
  const es=entries().filter(e=>(e.threadIds||[]).includes(id));const sts=new Set(es.flatMap(e=>e.stateIds||[]).filter(get));
  const rits=all('ritual').filter(r=>r.threadId===id),ints=all('intention').filter(i=>i.threadId===id);const ritEntries=es.filter(e=>e.kind==='ritual').length;
  const photos=es.flatMap(e=>(e.photoIds||[]).filter(p=>IMG.get(p)).map(p=>({e,p})));
  return `${head('',{back:true,right:`<button class="ibtn" data-a="editThread" data-id="${id}" aria-label="Edit thread">${ico('edit',20)}</button>`})}
  <div class="t-cover">${slot(t.coverId,`item:${id}:coverId`,'16/10')}</div>
  <h1 class="t-name">${esc(t.name)}</h1>${t.description?`<p class="muted" style="margin:0">${esc(t.description)}</p>`:''}
  <p class="stats">${[[es.length,'entry','entries'],[sts.size,'state','states'],[ritEntries+rits.length,'ritual','rituals'],[ints.length,'intention','intentions']].filter(([n],i)=>i===0||n).map(([n,a,b])=>plural(n,a,b)).join(' · ')}</p>
  <button class="btn ghost" data-a="newInThread" data-id="${id}">${ico('plus',18)} Add to this thread</button>
  ${photos.length?`<div class="sec-h mt"><h2 class="sec-t">Images</h2></div><div class="grid3">${photos.map(x=>`<button class="tile" data-a="threadPhoto" data-t="${id}" data-e="${x.e.id}" data-p="${x.p}">${pic(x.p)}${tdot(entryColor(x.e))}</button>`).join('')}</div>`:''}
  ${ints.length?`<div class="sec-h mt"><h2 class="sec-t">Intentions</h2></div><div class="list card">${ints.map(i=>`<button class="row" data-a="go" data-to="intention" data-p="${jp({id:i.id})}"><span class="row-i">${ico('intention',18)}</span><span class="row-m">${esc(i.title)}</span>${ico('chev',16)}</button>`).join('')}</div>`:''}
  ${rits.length?`<div class="sec-h mt"><h2 class="sec-t">Rituals</h2></div><div class="list card">${rits.map(r=>`<button class="row" data-a="go" data-to="ritual" data-p="${jp({id:r.id})}"><span class="row-i">${ico('ritual',18)}</span><span class="row-m">${esc(r.name)}</span>${ico('chev',16)}</button>`).join('')}</div>`:''}
  <div class="sec-h mt"><h2 class="sec-t">Entries</h2></div>${es.length?`<div class="lines">${es.map(e=>lineRow(e,true)).join('')}</div>`:`<p class="empty">Nothing in this thread yet.</p>`}`;}};
V.threadEdit={nav:false,html({draft:d}){const isNew=!S.items.has(d.id);return `${edHead(isNew?'New thread':'Edit thread','saveThread')}
  <div class="t-cover">${slot(d.coverId,'draft:coverId','16/10')}</div>
  <span class="lbl">Title</span><input class="field" id="th-name" data-bo="name" value="${esc(d.name||'')}" placeholder="e.g. Becoming Her">
  <span class="lbl">What it holds</span><input class="field" id="th-desc" data-bo="description" value="${esc(d.description||'')}" placeholder="e.g. Intentions · Actions · Identity">
  <span class="lbl">Color</span>${colorPicker(d.color)}
  <span class="lbl">Icon</span>${iconPicker(d.icon)}
  ${isNew?'':`<button class="danger-link" data-a="delThread" data-id="${d.id}">Delete thread</button>`}`;}};

/* ================= ARCHIVE ================= */
const AS={filter:'all',q:'',view:'grid'};
const ARCH_F=[['all','All'],['photos','Photos'],['notes','Notes'],['rituals','Rituals'],['signs','Signs'],['intentions','Intentions'],['body','Body'],['dreams','Dreams'],['states','States'],['sigils','Sigils'],['oracle','Oracle'],['threads','Threads']];
function archItems(){const out=[];
  entries().forEach(e=>{const cats=(e.categoryIds||[]).map(get).filter(Boolean);out.push({g:{note:'notes',mind:'notes',photo:'notes',ritual:'rituals',sign:'signs',intention:'intentions',body:'body',dream:'dreams',state:'states'}[e.kind]||'notes',e,cats:e.categoryIds||[],date:e.date,img:(e.photoIds||[]).find(id=>IMG.get(id)),title:entryLabel(e),text:[e.text,entryLabel(e),e.tags,e.location,...cats.map(c=>c.name),...(e.stateIds||[]).map(get).filter(Boolean).map(s=>s.name)].join(' '),to:'entry',id:e.id,icon:(KINDS[e.kind]||KINDS.note).icon,color:entryColor(e)});});
  all('sigil').forEach(s=>out.push({g:'sigils',date:s.createdAt,img:s.imageId,title:s.name||'Sigil',text:s.name,to:'sigil',id:s.id,sig:true}));
  all('oracle').forEach(o=>out.push({g:'oracle',date:o.date,title:o.noticing||(S.settings.oracleArchetypes?o.name:'Patterns'),sub:'Oracle',text:o.name+' '+o.kw+' '+o.text,to:'reading',id:o.id,icon:'oracle'}));
  all('intention').filter(i=>!i.sample).forEach(i=>out.push({g:'intentions',date:i.createdAt,img:i.imageId,title:i.title,sub:'Intention',text:[i.title,i.desire,i.statement,i.reflection].join(' '),to:'intention',id:i.id,icon:'intention'}));
  all('thread').filter(t=>t.coverId||threadCount(t.id)).forEach(t=>out.push({g:'threads',date:t.createdAt,img:t.coverId,title:t.name,sub:'Thread',text:t.name+' '+(t.description||''),to:'thread',id:t.id,icon:'threads'}));
  return out.sort((a,b)=>(b.date||0)-(a.date||0));}
function archResults(){let it=archItems();const f=AS.filter;
  if(f==='photos')it=it.filter(x=>x.e&&x.img);else if(f.startsWith('cat:'))it=it.filter(x=>(x.cats||[]).includes(f.slice(4)));else if(f!=='all')it=it.filter(x=>x.g===f);
  const q=AS.q.trim().toLowerCase();if(q)it=it.filter(x=>(x.text||'').toLowerCase().includes(q));
  const tiles=it.map(x=>{const u=x.img&&IMG.get(x.img);const c=x.e?x.color:'';return `<button class="tile ${x.sig?'sig':''} ${c&&!u?'txt':''}" ${c?`style="--c:${c}"`:''} data-a="go" data-to="${x.to}" data-p="${jp({id:x.id})}" aria-label="${esc(x.title)}">${u?`${pic(x.img)}${c?tdot(c):''}`:`<span class="tile-t">${esc(x.title)}</span>${x.sub?`<span class="tile-s">${esc(x.sub)}</span>`:`<span class="tile-k">${ico(x.icon||'note',14)}</span>`}`}</button>`;});
  if(!q&&f==='all')tiles.unshift(`<button class="tile add" data-a="radial" aria-label="Add">${ico('plus',22)}</button>`);
  return tiles.length?`<div class="grid3">${tiles.join('')}</div>`:`<p class="empty">${q?'Nothing matches that search.':'Nothing here yet.'}</p>`;}
V.archive={html(){const top=`${head('Archive',{right:`<button class="ibtn" data-a="go" data-to="threads" aria-label="Threads">${ico('threads')}</button>`})}<p class="hint">What actually happened.</p>
  <div class="seg" role="tablist">${[['grid','Grid'],['timeline','Timeline'],['calendar','Calendar']].map(([k,l])=>`<button class="${AS.view===k?'on':''}" data-a="archView" data-v="${k}">${l}</button>`).join('')}</div>`;
  if(AS.view!=='grid'){MS.mode=AS.view;return top+mapBody();}
  const items=archItems();const has=new Set(items.map(x=>x.g));if(items.some(x=>x.e&&x.img))has.add('photos');const cats=ordered('category').filter(c=>items.some(x=>(x.cats||[]).includes(c.id)));return `${top}
  <div class="search">${ico('search',18)}<input id="arch-q" class="search-in" type="search" placeholder="Search your archive" value="${esc(AS.q)}" autocomplete="off"></div>
  <div class="chips scroll">${ARCH_F.filter(([k])=>k==='all'||k===AS.filter||has.has(k)).map(([k,l])=>`<button class="chip ${AS.filter===k?'on':''}" data-a="archFilter" data-f="${k}">${l}</button>`).join('')}${cats.map(c=>`<button class="chip ${AS.filter==='cat:'+c.id?'on':''}" data-a="archFilter" data-f="cat:${c.id}"><i class="dot" style="--c:${c.color}"></i>${esc(c.name)}</button>`).join('')}</div>
  <div id="arch-res">${archResults()}</div>`;}};

/* ================= RITUALS ================= */
/* A ritual is prepared now and performed later: when it is for, what it is for, what to have ready, and the sequence itself.
   Entries record the times it actually happened. */
const SITUATIONS=['After a difficult day','Before sleep','When I feel disconnected','When I need confidence','When I want to begin again','When I am overwhelmed','When I cannot sleep','Before going out','Before seeing someone','When I want to mark an ending','When I feel rejected','When I need courage'];
const MOMENTS=['Anxious','Sad','Angry','Lonely','Powerless','Disconnected','Ashamed','Overwhelmed'];
const newStep=(text='')=>({id:uid(),text,note:'',imageId:null,productId:null,prayerId:null,sound:'',duration:'',check:false});
const newProduct=()=>({id:uid(),name:'',imageId:null,url:'',price:'',notes:'',have:false});
function normRitual(r){let ch=false;const fix=(k,v)=>{if(r[k]===undefined){r[k]=v;ch=true;}};
  if((r.steps||[]).some(s=>typeof s==='string')){r.steps=r.steps.filter(s=>typeof s!=='string'||s.trim()).map(s=>typeof s==='string'?newStep(s):s);ch=true;}
  fix('steps',[]);fix('situations',[]);fix('intention',r.purpose||'');fix('description','');fix('objects',[]);fix('products',[]);fix('prayerIds',[]);fix('visualIds',[]);
  fix('tags','');fix('color',null);fix('colorId',null);fix('favourite',false);fix('lastPerformedAt',null);
  if(r.threadIds===undefined){r.threadIds=r.threadId?[r.threadId]:[];ch=true;}
  return ch;}
function normPrayer(p){let ch=false;const fix=(k,v)=>{if(p[k]===undefined){p[k]=v;ch=true;}};
  fix('situations',[]);fix('text','');fix('imageId',null);fix('tags','');fix('color',null);fix('colorId',null);fix('favourite',false);fix('lastReadAt',null);return ch;}
const usedSituations=()=>[...new Set([...all('ritual'),...all('prayer')].flatMap(x=>x.situations||[]))];
const lc=s=>String(s||'').toLowerCase();
/* a moment matches an item when one of its situations names it, in the person's own wording */
const fitsMoment=(x,m)=>m==='*'||(x.situations||[]).some(s=>lc(s)===lc(m)||lc(s).includes(lc(m)));
const prayersOf=r=>(r.prayerIds||[]).map(get).filter(Boolean);
const ritualsWith=pid=>all('ritual').filter(r=>(r.prayerIds||[]).includes(pid)||(r.steps||[]).some(s=>s.prayerId===pid));
const byUse=(a,b)=>(b.favourite?1:0)-(a.favourite?1:0)||(b.lastPerformedAt||b.lastReadAt||0)-(a.lastPerformedAt||a.lastReadAt||0)||(b.updatedAt||0)-(a.updatedAt||0);
const isTonight=(kind,id)=>S.settings.tonight&&S.settings.tonight.kind===kind&&S.settings.tonight.id===id;
const sitChips=x=>(x.situations||[]).length?`<div class="chips sm">${x.situations.map(s=>`<span class="chip">${esc(s)}</span>`).join('')}</div>`:'';

function situationPicker(d){const sel=d.situations||[];const base=[...(S.settings.situations||SITUATIONS)];
  const pool=[...new Set([...sel,...usedSituations(),...base,...(d.type==='prayer'?MOMENTS.map(m=>`When I feel ${m.toLowerCase()}`):[])])];
  const show=d._sitAll?pool:pool.slice(0,Math.max(sel.length+3,8));
  return `<div class="chips">${show.map(s=>`<button class="chip ${sel.includes(s)?'on':''}" data-a="togSit" data-v="${esc(s)}" aria-pressed="${sel.includes(s)}">${esc(s)}</button>`).join('')}${pool.length>show.length?`<button class="chip dashed" data-a="sitAll">More…</button>`:''}<button class="chip dashed" data-a="newSit">+ Your own situation</button></div>`;}

const ritCard=r=>`<button class="rcard" data-a="go" data-to="ritual" data-p="${jp({id:r.id})}"><span class="rimg ${IMG.get(r.imageId)?'has':''}" ${r.color?`style="--c:${r.color}"`:''}>${imgTag(r.imageId)||ico('candle',26)}${r.color?tdot(r.color):''}</span><span class="rname">${esc(r.name)}</span>${(r.situations||[])[0]?`<span class="rsub">${esc(r.situations[0])}</span>`:r.duration?`<span class="rsub">${esc(r.duration)}</span>`:''}</button>`;
const RS={f:'all',q:''};
V.rituals={html(){const rs=all('ritual').sort(byUse);const themes=[...new Set(rs.map(r=>r.group).filter(Boolean))];const sits=usedSituations();
  if(RS.f!=='all'&&RS.f!=='fav'&&RS.f!=='mine'&&!themes.includes(RS.f)&&!sits.includes(RS.f))RS.f='all';
  let list=rs;if(RS.f==='fav')list=rs.filter(r=>r.favourite);else if(RS.f==='mine')list=rs.filter(r=>!r.sample);else if(themes.includes(RS.f))list=rs.filter(r=>r.group===RS.f);else if(RS.f!=='all')list=rs.filter(r=>(r.situations||[]).includes(RS.f));
  const opts=[['all','All'],...(rs.some(r=>r.favourite)?[['fav','Favourites']]:[]),...(rs.some(r=>r.sample)&&rs.some(r=>!r.sample)?[['mine','Mine']]:[]),...themes.map(g=>[g,g]),...sits.map(s=>[s,s])];
  return `${head('Rituals',{right:`<button class="ibtn" data-a="new" data-t="ritual" aria-label="New ritual">${ico('plus')}</button>`})}
  <p class="hint">Things you do, prepared for the moments that come back.</p>
  ${rs.length?`<div class="chips scroll">${opts.map(([k,l])=>`<button class="chip ${RS.f===k?'on':''}" data-a="ritFilter" data-f="${esc(k)}">${esc(l)}</button>`).join('')}</div>`:''}
  ${list.length?`<div class="grid2">${list.map(ritCard).join('')}</div>`:''}
  <button class="empty-cta mt" data-a="new" data-t="ritual">${ico('plus',16)} Create a ritual for a moment you know will come again</button>`;}};

/* ---- ritual page ---- */
function needList(r,{interactive=true}={}){const objs=r.objects||[],prods=r.products||[];if(!objs.length&&!prods.length)return'';
  const ck=(k,i,on)=>interactive?`<button class="ck ${on?'on':''}" data-a="togHave" data-id="${r.id}" data-k="${k}" data-i="${i}" aria-label="${on?'Ready':'Not ready yet'}">${on?ico('check',14):''}</button>`:'';
  return `<div class="list card need">${objs.map((o,i)=>`<div class="row ${o.have?'have':''}">${ck('objects',i,o.have)}<span class="row-m"><span class="row-t">${esc(o.name)}</span></span></div>`).join('')}
   ${prods.map((p,i)=>`<div class="row ${p.have?'have':''}">${ck('products',i,p.have)}<button class="row-m btn-plain prod-r" data-a="go" data-to="product" data-p="${jp({id:r.id,pid:p.id})}"><span class="pthumb">${imgTag(p.imageId)||ico('bag',18)}</span><span class="row-m"><span class="row-t">${esc(p.name||'Product')}</span>${p.price||p.notes?`<span class="row-s">${esc([p.price,p.notes].filter(Boolean).join(' · '))}</span>`:''}</span></button>${p.url?`<a class="ibtn sm" href="${esc(p.url)}" target="_blank" rel="noopener" aria-label="Open link">${ico('link',16)}</a>`:''}</div>`).join('')}</div>`;}
function stepBadges(s,r){const b=[];if(s.imageId&&IMG.get(s.imageId))b.push(`<span class="bdg img">${imgTag(s.imageId)}</span>`);if(isVid(s.imageId))b.push(`<span class="bdg">${ico('play',12)}Video</span>`);
  if(s.duration)b.push(`<span class="bdg">${ico('clock',12)}${esc(s.duration)}</span>`);
  const pr=(r.products||[]).find(p=>p.id===s.productId);if(pr)b.push(`<span class="bdg">${ico('bag',12)}${esc(pr.name||'Product')}</span>`);
  const py=get(s.prayerId);if(py)b.push(`<span class="bdg">${ico('prayer',12)}${esc(py.name)}</span>`);
  if(s.sound)b.push(`<span class="bdg">${ico('music',12)}${esc(s.sound.length>22?s.sound.slice(0,21)+'…':s.sound)}</span>`);
  if(s.note)b.push(`<span class="bdg">${ico('note',12)}Note</span>`);
  return b.length?`<span class="bdgs">${b.join('')}</span>`:'';}
V.ritual={quiet:true,html({id}){const r=get(id);if(!r)return head('Not found',{back:true});const it=get(r.intentionId),sg=get(r.sigilId);const ths=(r.threadIds||[]).map(get).filter(Boolean);
  const done=all('entry').filter(e=>e.kind==='ritual'&&e.ritualId===id).sort((a,b)=>b.date-a.date);const steps=(r.steps||[]).filter(s=>s.text.trim()||s.imageId);const prs=prayersOf(r);const vis=(r.visualIds||[]).filter(v=>IMG.get(v));
  return `${head('',{back:true,right:`<button class="ibtn ${r.favourite?'fav':''}" data-a="togFav" data-id="${id}" aria-label="${r.favourite?'Remove from favourites':'Add to favourites'}" aria-pressed="${!!r.favourite}">${ico('star',20)}</button><button class="ibtn" data-a="editRitual" data-id="${id}" aria-label="Edit ritual">${ico('edit',20)}</button>`})}
  ${slot(r.imageId,`item:${id}:imageId`,'16/10',r.imageId?'':'compact')}
  <h1 class="obj-name" ${r.color?`style="--c:${r.color}"`:''}>${esc(r.name)}</h1>
  ${(r.situations||[]).length?`<p class="eyebrow">For</p>${sitChips(r)}`:''}
  ${r.intention?`<p class="obj-int">${esc(r.intention)}</p>`:''}
  ${r.sample?`<p class="fine" style="text-align:left;margin:10px 0 0">An example. Edit it freely, or write your own.</p>`:''}
  <div class="obj-act"><button class="btn" data-a="go" data-to="run" data-p="${jp({id,i:-1})}" ${steps.length?'':'disabled'}>${ico('play',16)} Begin ritual</button><button class="btn ghost" data-a="keepTonight" data-kind="ritual" data-id="${id}">${ico('intention',16)} ${isTonight('ritual',id)?'Kept for tonight':'Keep for tonight'}</button></div>
  ${(r.objects||[]).length||(r.products||[]).length?`<div class="sec-h mt"><h2 class="sec-t">Things to prepare</h2></div>${needList(r)}`:''}
  ${vis.length?`<div class="sec-h mt"><h2 class="sec-t">Visual references</h2></div><div class="grid3">${vis.map(v=>isVid(v)?`<button class="tile" data-a="playVid" data-id="${v}" aria-label="Watch with sound">${pic(v)}</button>`:`<div class="tile">${pic(v)}</div>`).join('')}</div>`:''}
  <div class="sec-h mt"><h2 class="sec-t">The ritual</h2>${r.duration?`<span class="muted" style="font-size:13px">${esc(r.duration)}</span>`:''}</div>
  ${steps.length?`<ol class="rit-steps">${steps.map(s=>`<li><span>${esc(s.text)}${stepBadges(s,r)}</span></li>`).join('')}</ol>`:`<button class="empty-cta" data-a="editRitual" data-id="${id}">No steps yet. Tap to write the sequence.</button>`}
  ${prs.length?`<div class="sec-h mt"><h2 class="sec-t">Prayers</h2></div><div class="list card">${prs.map(prayerRow).join('')}</div>`:''}
  ${sg&&IMG.get(sg.imageId)?`<div class="sec-h mt"><h2 class="sec-t">Symbol</h2></div><div class="sigil-sm">${imgTag(sg.imageId)}</div>`:''}
  ${it||ths.length?`<div class="list card mt">${it?`<button class="row" data-a="go" data-to="intention" data-p="${jp({id:it.id})}"><span class="row-i">${ico('intention',18)}</span><span class="row-m"><span class="row-s">Intention</span><span class="row-t">${esc(it.title)}</span></span>${ico('chev',16)}</button>`:''}${ths.map(th=>`<button class="row" data-a="go" data-to="thread" data-p="${jp({id:th.id})}"><span class="row-i">${ico('threads',18)}</span><span class="row-m"><span class="row-s">Thread</span><span class="row-t">${esc(th.name)}</span></span>${ico('chev',16)}</button>`).join('')}</div>`:''}
  <div class="sec-h mt"><h2 class="sec-t">Times you did it</h2><button class="lnk" data-a="ritualDone" data-id="${id}">Record without guiding</button></div>
  ${done.length?`<div class="lines">${done.slice(0,10).map(e=>lineRow(e,true)).join('')}</div>`:`<p class="empty">Not yet.</p>`}`;}};
V.product={html({id,pid}){const r=get(id);const p=r&&(r.products||[]).find(x=>x.id===pid);if(!p)return head('Not found',{back:true});
  return `${head('',{back:true})}${IMG.get(p.imageId)?`<div class="prod-img">${isVid(p.imageId)?media(p.imageId,'r11'):`<div class="tile">${imgTag(p.imageId)}</div>`}</div>`:''}
  <h1 class="obj-name">${esc(p.name||'Product')}</h1>${p.price?`<p class="muted" style="margin:0 0 10px">${esc(p.price)}</p>`:''}
  ${p.notes?`<p class="obj-int">${esc(p.notes)}</p>`:''}
  ${p.url?`<a class="btn ghost mt" href="${esc(p.url)}" target="_blank" rel="noopener">${ico('link',16)} Open link</a>`:''}
  <p class="fine">Part of ${esc(r.name)}. Edit it from the ritual.</p>`;}};

/* ---- ritual builder ---- */
V.ritualEdit={nav:false,html({draft:d}){const isNew=!S.items.has(d.id);const steps=d.steps||[],objs=d.objects||[],prods=d.products||[];const prs=(d.prayerIds||[]).map(get).filter(Boolean);
  return `${edHead(isNew?'New ritual':'Edit ritual','saveRitual')}
  ${slot(d.imageId,'draft:imageId','16/10',d.imageId?'':'compact')}
  <input class="field title-in" id="r-name" data-bo="name" value="${esc(d.name||'')}" placeholder="Name this ritual" autocomplete="off">
  <span class="lbl">When is this for?</span>${situationPicker(d)}
  <span class="lbl">Intention</span><textarea class="field area sm" id="r-int" data-bo="intention" placeholder="What is this ritual for?">${esc(d.intention||'')}</textarea>
  <span class="lbl">What you need</span>
  ${objs.length||prods.length?`<div class="list card">${objs.map((o,i)=>`<div class="row"><span class="row-i">${ico('candle',18)}</span><button class="row-m btn-plain" data-a="editObject" data-i="${i}">${esc(o.name)}</button><button class="ibtn sm" data-a="delListItem" data-f="objects" data-i="${i}" aria-label="Remove ${esc(o.name)}">${ico('close',15)}</button></div>`).join('')}
   ${prods.map((p,i)=>`<button class="row" data-a="editProduct" data-i="${i}"><span class="pthumb">${imgTag(p.imageId)||ico('bag',18)}</span><span class="row-m"><span class="row-t">${esc(p.name||'Untitled product')}</span>${p.price?`<span class="row-s">${esc(p.price)}</span>`:''}</span>${ico('chev',16)}</button>`).join('')}</div>`:`<p class="hint">Objects to gather and things you might buy. When it is time, everything is here.</p>`}
  <div class="pair mt-s"><button class="btn ghost sm" data-a="addObject">${ico('plus',16)} Object</button><button class="btn ghost sm" data-a="addProduct">${ico('plus',16)} Product</button></div>
  <span class="lbl">Visual references</span><div class="grid4">${(d.visualIds||[]).map((v,i)=>`<div>${slot(v,`draft:visualIds:${i}`,'1/1')}</div>`).join('')}<div>${slot(null,'draft:visualIds:new','1/1')}</div></div>
  <span class="lbl">The ritual</span>
  <div class="steps sortable" data-sort="steps">${steps.map((s,i)=>`<div class="srow stp" data-id="${s.id}"><span class="n">${i+1}</span><div class="stp-m"><textarea class="field stp-t" id="st-${s.id}" rows="1" data-bo="steps.${i}.text" placeholder="Step ${i+1}">${esc(s.text)}</textarea>${stepBadges(s,d)}</div><button class="ibtn sm" data-a="editStep" data-i="${i}" aria-label="Add an image, note, product, prayer, sound or duration to step ${i+1}">${ico('more',18)}</button><span class="handle" aria-label="Drag to reorder">${ico('drag',18)}</span></div>`).join('')}</div>
  <button class="addl" data-a="addStep">${ico('plus',16)} Add a step</button>
  <span class="lbl">Prayers</span>${prs.length?`<div class="list card">${prs.map(p=>`<div class="row"><span class="row-i">${ico('prayer',18)}</span><span class="row-m">${esc(p.name)}</span><button class="ibtn sm" data-a="unlinkPrayer" data-id="${p.id}" aria-label="Detach ${esc(p.name)}">${ico('close',15)}</button></div>`).join('')}</div>`:''}
  <button class="addl" data-a="attachPrayer">${ico('plus',16)} Attach a prayer</button>
  <button class="more-t" data-a="togMore" aria-expanded="${!!d._more}">More ${ico(d._more?'up':'down',14)}</button>
  ${d._more?`<div class="more-b">
   <div class="pair"><div><span class="lbl" style="margin-top:4px">Theme</span><input class="field" id="r-group" data-bo="group" value="${esc(d.group||'')}" placeholder="e.g. Confidence" list="r-groups"><datalist id="r-groups">${[...new Set(all('ritual').map(r=>r.group).filter(Boolean))].map(g=>`<option value="${esc(g)}">`).join('')}</datalist></div><div><span class="lbl" style="margin-top:4px">Duration</span><input class="field" id="r-dur" data-bo="duration" value="${esc(d.duration||'')}" placeholder="e.g. 20 min"></div></div>
   <span class="lbl">Colour</span>${entryColorPicker(d)}
   <div class="list card mt">
    ${rowBtn('threads','Threads',(d.threadIds||[]).map(get).filter(Boolean).map(t=>t.name).join(', ')||'None','pickThreads')}
    ${rowBtn('intention','Intention',get(d.intentionId)?.title||'None','pickOne','data-f="intentionId" data-type="intention" data-title="Link to an intention"')}
    ${rowBtn('pen','Symbol',get(d.sigilId)?.name||'None','pickSigil')}
    <label class="row"><span class="row-i">${ico('tag',18)}</span><span class="row-m">Tags</span><input class="inl" id="r-tags" data-bo="tags" value="${esc(d.tags||'')}" placeholder="Add tags"></label>
   </div></div>`:''}
  ${isNew?'':`<button class="danger-link" data-a="delRitual" data-id="${d.id}">Delete ritual</button>`}`;},
  after(){bindSortables();$$('.stp-t').forEach(autoGrow);}};
function autoGrow(t){const f=()=>{t.style.height='auto';t.style.height=t.scrollHeight+'px';};f();t.addEventListener('input',f);}
V.stepEdit={nav:false,html({draft:d,i}){const s=(d.steps||[])[i];if(!s)return head('',{back:true});const pr=(d.products||[]).find(p=>p.id===s.productId),py=get(s.prayerId);
  return `<header class="ed-hd"><span style="width:60px"></span><span class="ed-t">Step ${i+1}</span><button class="tbtn strong" data-a="back">Done</button></header>
  <textarea class="field area sm" id="se-text" data-bo="steps.${i}.text" placeholder="What happens in this step?">${esc(s.text)}</textarea>
  <span class="lbl">Image or video</span>${slot(s.imageId,`dpath:steps.${i}.imageId`,'4/3',s.imageId?'':'compact')}
  <span class="lbl">Note</span><textarea class="field area sm" id="se-note" data-bo="steps.${i}.note" placeholder="Anything to remember while doing it">${esc(s.note||'')}</textarea>
  <div class="pair"><div><span class="lbl">Duration</span><input class="field" id="se-dur" data-bo="steps.${i}.duration" value="${esc(s.duration||'')}" placeholder="e.g. 5 min"></div><div><span class="lbl">Sound or music</span><input class="field" id="se-snd" data-bo="steps.${i}.sound" value="${esc(s.sound||'')}" placeholder="Song or link"></div></div>
  <div class="list card mt">
   ${rowBtn('bag','Product',pr?(pr.name||'Product'):'None','pickStepProduct',`data-i="${i}"`)}
   ${rowBtn('prayer','Prayer',py?py.name:'None','pickStepPrayer',`data-i="${i}"`)}
   <div class="row"><span class="row-i">${ico('check',18)}</span><span class="row-m">Check it off when done</span><button class="tog ${s.check?'on':''}" data-a="togStepCheck" data-i="${i}" role="switch" aria-checked="${!!s.check}" aria-label="Check it off when done"><i></i></button></div>
  </div>
  <button class="danger-link" data-a="delStep" data-i="${i}">Remove step</button>`;}};
V.productEdit={nav:false,html({draft:d,i}){const p=(d.products||[])[i];if(!p)return head('',{back:true});
  return `<header class="ed-hd"><span style="width:60px"></span><span class="ed-t">Product</span><button class="tbtn strong" data-a="doneProduct" data-i="${i}">Done</button></header>
  <div class="prod-img">${slot(p.imageId,`dpath:products.${i}.imageId`,'1/1')}</div>
  <span class="lbl">Name</span><input class="field" id="pe-name" data-bo="products.${i}.name" value="${esc(p.name||'')}" placeholder="e.g. Lavender candle" autocomplete="off">
  <span class="lbl">Link</span><input class="field" id="pe-url" type="url" inputmode="url" data-bo="products.${i}.url" value="${esc(p.url||'')}" placeholder="https://">
  <span class="lbl">Price</span><input class="field" id="pe-price" data-bo="products.${i}.price" value="${esc(p.price||'')}" placeholder="e.g. €24">
  <span class="lbl">Why I want it</span><textarea class="field area sm" id="pe-notes" data-bo="products.${i}.notes" placeholder="e.g. Wear this during the ritual because I associate it with becoming softer.">${esc(p.notes||'')}</textarea>
  <button class="danger-link" data-a="delProduct" data-i="${i}">Remove product</button>`;}};

/* ---- ritual mode: one step at a time, nothing else on screen ---- */
const RUN={timer:null,end:0};
function stopTimer(){clearInterval(RUN.timer);RUN.timer=null;RUN.end=0;}
function parseMinutes(s){const m=/(\d+(?:[.,]\d+)?)\s*(s|sec|m|min|h|hr)?/i.exec(s||'');if(!m)return 0;const n=parseFloat(m[1].replace(',','.'));const u=lc(m[2]||'min');return u.startsWith('s')?n/60:u.startsWith('h')?n*60:n;}
V.run={nav:false,html(p){const r=get(p.id);if(!r)return head('Not found',{back:true});const steps=(r.steps||[]).filter(s=>s.text.trim()||s.imageId);const n=steps.length;const i=p.i;
  const top=`<header class="run-hd"><button class="ibtn" data-a="runExit" aria-label="Leave ritual">${ico('close',20)}</button><span class="run-p">${i<0?'':i>=n?'Complete':`${i+1} of ${n}`}</span><span style="width:40px"></span></header><div class="run-bar"><i style="width:${Math.max(0,Math.min(1,(i+1)/n))*100}%"></i></div>`;
  if(i<0)return `<div class="run">${top}<div class="run-body"><p class="eyebrow">Ritual</p><h1 class="run-t">${esc(r.name)}</h1>${r.intention?`<p class="obj-int">${esc(r.intention)}</p>`:''}
    ${(r.objects||[]).length||(r.products||[]).length?`<p class="eyebrow mt">Have everything?</p>${needList(r)}`:''}</div><div class="run-foot"><button class="btn" data-a="runGo" data-d="1">Begin</button></div></div>`;
  if(i>=n)return `<div class="run">${top}<div class="run-body"><p class="eyebrow">${esc(r.name)}</p><h1 class="run-t">Complete.</h1>
    <span class="lbl">Anything you want to remember?</span><textarea class="field area sm" id="run-note" placeholder="How it felt, what you left behind">${esc(p.note||'')}</textarea></div>
    <div class="run-foot"><button class="btn" data-a="runSave">Save to archive</button><button class="tbtn" data-a="runClose">Close without saving</button></div></div>`;
  const s=steps[i];const pr=(r.products||[]).find(x=>x.id===s.productId),py=get(s.prayerId);const mins=parseMinutes(s.duration);const url=/^https?:\/\//i.test(s.sound||'');
  return `<div class="run">${top}<div class="run-body">
   ${s.imageId&&IMG.get(s.imageId)?`<div class="run-img">${media(s.imageId)}</div>`:''}
   <h1 class="run-step">${esc(s.text)}</h1>
   ${s.note?`<p class="obj-int">${esc(s.note)}</p>`:''}
   ${pr?`<div class="list card mt"><div class="row"><span class="pthumb">${imgTag(pr.imageId)||ico('bag',18)}</span><span class="row-m"><span class="row-t">${esc(pr.name||'Product')}</span>${pr.notes?`<span class="row-s">${esc(pr.notes)}</span>`:''}</span></div></div>`:''}
   ${s.sound?`<p class="run-meta">${ico('music',16)} ${url?`<a href="${esc(s.sound)}" target="_blank" rel="noopener">${esc(s.sound)}</a>`:esc(s.sound)}</p>`:''}
   ${s.duration?`<p class="run-meta">${ico('clock',16)} ${esc(s.duration)} ${mins>0?`<button class="tbtn" data-a="runTimer" data-m="${mins}"><span id="run-tmr">${RUN.end?'':'Start timer'}</span></button>`:''}</p>`:''}
   ${py?`<button class="btn ghost mt" data-a="go" data-to="prayer" data-p="${jp({id:py.id})}">${ico('prayer',16)} Read prayer</button>`:''}
  </div><div class="run-foot"><button class="btn" data-a="runGo" data-d="1">${s.check?`${ico('check',16)} Done`:i===n-1?'Finish':'Next'}</button>${i>0?`<button class="tbtn" data-a="runGo" data-d="-1">Previous step</button>`:''}</div></div>`;},
  after(){if(RUN.end)tick();}};
function tick(){const el=$('#run-tmr');if(!el){stopTimer();return;}const left=Math.max(0,RUN.end-Date.now());const m=Math.floor(left/6e4),sec=Math.floor(left%6e4/1e3);el.textContent=left?`${m}:${pad(sec)}`:'Time';if(!left){stopTimer();if(navigator.vibrate)try{navigator.vibrate([60,40,60]);}catch(e){}}}

/* ================= PRAYERS ================= */
/* Words written ahead of time for a state you know you will be in again. Never generated, always the person's own. */
const prayerRow=p=>`<button class="row" data-a="go" data-to="prayer" data-p="${jp({id:p.id})}"><span class="pthumb" ${p.color?`style="--c:${p.color}"`:''}>${imgTag(p.imageId)||`<i class="dot" style="--c:${p.color||'var(--muted)'}"></i>`}</span><span class="row-m"><span class="row-t">${esc(p.name)}</span><span class="row-s">${esc((p.situations||[])[0]||(p.text||'').split('\n')[0])}</span></span>${ico('chev',16)}</button>`;
const PS={f:'all'};
V.prayers={html(){const ps=all('prayer').sort(byUse);const sits=[...new Set(ps.flatMap(p=>p.situations||[]))];if(PS.f!=='all'&&PS.f!=='fav'&&!sits.includes(PS.f))PS.f='all';
  const list=PS.f==='all'?ps:PS.f==='fav'?ps.filter(p=>p.favourite):ps.filter(p=>(p.situations||[]).includes(PS.f));
  return `${head('Prayers',{right:`<button class="ibtn" data-a="new" data-t="prayer" aria-label="New prayer">${ico('plus')}</button>`})}
  <p class="hint">Words you return to when you are in a particular state.</p>
  ${ps.length?`<div class="chips scroll">${[['all','All'],...(ps.some(p=>p.favourite)?[['fav','Favourites']]:[]),...sits.map(s=>[s,s])].map(([k,l])=>`<button class="chip ${PS.f===k?'on':''}" data-a="prayFilter" data-f="${esc(k)}">${esc(l)}</button>`).join('')}</div>`:''}
  ${list.length?`<div class="list card">${list.map(prayerRow).join('')}</div>`:''}
  <button class="empty-cta mt" data-a="new" data-t="prayer">${ico('plus',16)} Write words for a moment you know will come again</button>`;}};
V.prayer={quiet:true,html({id}){const p=get(id);if(!p)return head('Not found',{back:true});const rs=ritualsWith(id);
  return `${head('',{back:true,right:`<button class="ibtn ${p.favourite?'fav':''}" data-a="togFav" data-id="${id}" aria-label="${p.favourite?'Remove from favourites':'Add to favourites'}" aria-pressed="${!!p.favourite}">${ico('star',20)}</button><button class="ibtn" data-a="editPrayer" data-id="${id}" aria-label="Edit prayer">${ico('edit',20)}</button>`})}
  ${IMG.get(p.imageId)?`<div class="pray-img">${isVid(p.imageId)?media(p.imageId,'r43'):slot(p.imageId,`item:${id}:imageId`,'4/3')}</div>`:''}
  <h1 class="obj-name" ${p.color?`style="--c:${p.color}"`:''}>${esc(p.name)}</h1>
  ${(p.situations||[]).length?`<p class="eyebrow">When</p>${sitChips(p)}`:''}
  <div class="pray-text">${esc(p.text||'')}</div>
  ${p.sample?`<p class="fine" style="text-align:left">An example. Replace it with your own words.</p>`:''}
  <button class="btn ghost mt" data-a="keepTonight" data-kind="prayer" data-id="${id}">${ico('intention',16)} ${isTonight('prayer',id)?'Kept for tonight':'Keep for tonight'}</button>
  ${rs.length?`<div class="sec-h mt"><h2 class="sec-t">Part of</h2></div><div class="list card">${rs.map(r=>`<button class="row" data-a="go" data-to="ritual" data-p="${jp({id:r.id})}"><span class="row-i">${ico('ritual',18)}</span><span class="row-m">${esc(r.name)}</span>${ico('chev',16)}</button>`).join('')}</div>`:''}`;},
  after(p){if(p._read)return;p._read=true;const x=get(p.id);if(x){x.lastReadAt=Date.now();save(x);}}};
V.prayerEdit={nav:false,html({draft:d}){const isNew=!S.items.has(d.id);const rs=(d._rituals||[]).map(get).filter(Boolean);
  return `${edHead(isNew?'New prayer':'Edit prayer','savePrayer')}
  <input class="field title-in" id="p-name" data-bo="name" value="${esc(d.name||'')}" placeholder="Name it, e.g. Read this when I feel unwanted" autocomplete="off">
  <span class="lbl">When</span>${situationPicker(d)}
  <span class="lbl">Prayer</span><textarea class="field area pray-in" id="p-text" data-bo="text" placeholder="Your own words">${esc(d.text||'')}</textarea>
  <span class="lbl">Image or video</span>${slot(d.imageId,'draft:imageId','4/3',d.imageId?'':'compact')}
  <span class="lbl">Colour</span>${entryColorPicker(d)}
  <span class="lbl">Part of rituals</span>${rs.length?`<div class="list card">${rs.map(r=>`<div class="row"><span class="row-i">${ico('ritual',18)}</span><span class="row-m">${esc(r.name)}</span></div>`).join('')}</div>`:''}
  <button class="addl" data-a="prayerRituals">${ico('plus',16)} ${rs.length?'Change rituals':'Attach to a ritual'}</button>
  <div class="list card mt"><label class="row"><span class="row-i">${ico('tag',18)}</span><span class="row-m">Tags</span><input class="inl" id="p-tags" data-bo="tags" value="${esc(d.tags||'')}" placeholder="Add tags"></label></div>
  ${isNew?'':`<button class="danger-link" data-a="delPrayer" data-id="${d.id}">Delete prayer</button>`}`;}};

/* ================= I NEED SOMETHING ================= */
/* Built for 2 AM: two taps from Home to the words or ritual you prepared for exactly this. */
function needMoments(kind){const pool=kind==='prayer'?all('prayer'):kind==='ritual'?all('ritual'):[...all('ritual'),...all('prayer')];
  const own=[...new Set(pool.flatMap(x=>x.situations||[]))].filter(s=>!MOMENTS.some(m=>lc(s).includes(lc(m))));
  return{pool,list:[...(S.settings.moments||MOMENTS),...own]};}
V.need={html(p){const kind=p.kind||'prayer';const {pool,list}=needMoments(kind);const m=p.m||null;
  const res=m?pool.filter(x=>fitsMoment(x,m)).sort(byUse):[];
  const card=x=>x.type==='prayer'?prayerRow(x):`<button class="row" data-a="go" data-to="ritual" data-p="${jp({id:x.id})}"><span class="pthumb">${imgTag(x.imageId)||ico('candle',18)}</span><span class="row-m"><span class="row-t">${esc(x.name)}</span><span class="row-s">${esc((x.situations||[]).join(' · ')||x.intention||'')}</span></span>${ico('chev',16)}</button>`;
  const sitFor=m&&m!=='*'?(MOMENTS.some(x=>lc(x)===lc(m))?`When I feel ${lc(m)}`:m):'';
  return `${head('I need something',{back:true})}
  <div class="seg"><button class="${kind==='ritual'?'on':''}" data-a="needKind" data-v="ritual">A ritual</button><button class="${kind==='prayer'?'on':''}" data-a="needKind" data-v="prayer">A prayer</button></div>
  <p class="need-q">What kind of moment is this?</p><p class="eyebrow">I feel</p>
  <div class="chips">${list.map(x=>{const n=pool.filter(y=>fitsMoment(y,x)).length;return `<button class="chip ${m===x?'on':''} ${n?'':'faint'}" data-a="needMoment" data-v="${esc(x)}" aria-pressed="${m===x}">${esc(x)}${n?`<span class="cnt">${n}</span>`:''}</button>`;}).join('')}<button class="chip dashed ${m==='*'?'on':''}" data-a="needMoment" data-v="*">Other</button></div>
  ${m?`<div class="mt">${res.length?`<div class="list card">${res.map(card).join('')}</div>`:`<div class="empty-need"><p class="empty">Nothing prepared for this moment yet.</p><p class="hint">You can write it now for the next time.</p>
    <button class="btn ghost" data-a="prepareFor" data-kind="${kind}" data-v="${esc(sitFor)}">${ico('plus',16)} ${kind==='prayer'?'Write a prayer for this':'Create a ritual for this'}</button></div>`}</div>`:''}`;}};

/* ================= INTENTIONS ================= */
V.intentions={html(){const its=all('intention').sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));return `${head('Intentions',{back:true,right:`<button class="ibtn" data-a="new" data-t="intention" aria-label="New intention">${ico('plus')}</button>`})}
  ${its.length?`<div class="list card">${its.map(i=>`<button class="row" data-a="go" data-to="intention" data-p="${jp({id:i.id})}"><span class="thumb">${imgTag(i.imageId)||`<i style="--c:var(--accent)">${ico('intention',20)}</i>`}</span><span class="row-m"><span class="row-t">${esc(i.title)}</span><span class="row-s">${esc(i.statement||i.desire||'')}</span>${S.settings.currentIntentionId===i.id?'<span class="row-s">Current</span>':''}</span>${ico('chev',16)}</button>`).join('')}</div>`:`<button class="empty-cta" data-a="new" data-t="intention">No intentions yet. Tap to turn a desire into a practice.</button>`}`;}};
V.intention={quiet:true,html({id}){const i=get(id);if(!i)return head('Not found',{back:true});const sg=get(i.sigilId),r=get(i.ritualId),th=get(i.threadId);
  const signs=entries().filter(e=>e.intentionId===id);const isCur=S.settings.currentIntentionId===id;
  return `${head('',{back:true,right:`<button class="ibtn" data-a="editIntention" data-id="${id}" aria-label="Edit intention">${ico('edit',20)}</button>`})}
  ${slot(i.imageId,`item:${id}:imageId`,'16/10')}
  <p class="eyebrow mt">Intention${isCur?' · current':''}</p><h1 class="t-name" style="margin-top:6px">${esc(i.title)}</h1>
  ${i.desire?`<span class="lbl">Desire</span><p class="quote">“${esc(i.desire)}”</p>`:''}
  ${i.statement?`<span class="lbl">Intention</span><p class="quote">${esc(i.statement)}</p>`:''}
  ${sg||r?`<div class="pair mt">${sg?`<button class="boxbtn" data-a="go" data-to="sigil" data-p="${jp({id:sg.id})}"><span class="box">${imgTag(sg.imageId)||ico('pen',22)}</span><span class="rsub">Sigil · ${esc(sg.name||'')}</span></button>`:'<span></span>'}${r?`<button class="boxbtn" data-a="go" data-to="ritual" data-p="${jp({id:r.id})}"><span class="box photo">${imgTag(r.imageId)||ico('candle',22)}</span><span class="rsub">Ritual · ${esc(r.name)}</span></button>`:''}</div>`:''}
  ${(i.actions||[]).length?`<span class="lbl">Actions</span><div class="stepper">${i.actions.map((a,n)=>`<div class="step ${a.done?'done':''}"><button class="ck ${a.done?'on':''}" data-a="togAction" data-id="${id}" data-i="${n}" aria-label="${a.done?'Mark not done':'Mark done'}">${a.done?ico('check',14):''}</button><span style="flex:1">${esc(a.text)}</span></div>`).join('')}</div>`:''}
  ${(i.signsToNotice||[]).filter(Boolean).length?`<span class="lbl">Signs that matter to you</span><div class="chips sm">${i.signsToNotice.filter(Boolean).map(s=>`<span class="chip">${esc(s)}</span>`).join('')}</div>`:''}
  <div class="pair mt"><button class="btn ghost" data-a="logSign" data-id="${id}">${ico('sign',16)} Log a sign</button><button class="btn ghost" data-a="setCurrent" data-id="${id}" ${isCur?'disabled':''}>${isCur?'Current':'Set as current'}</button></div>
  ${i.reflection?`<span class="lbl">Reflection</span><p class="quote" style="font-style:normal">${esc(i.reflection)}</p>`:''}
  ${th?`<div class="list card mt"><button class="row" data-a="go" data-to="thread" data-p="${jp({id:th.id})}"><span class="row-i">${ico('threads',18)}</span><span class="row-m"><span class="row-s">Thread</span><span class="row-t">${esc(th.name)}</span></span>${ico('chev',16)}</button></div>`:''}
  ${signs.length?`<div class="sec-h mt"><h2 class="sec-t">Signs & entries</h2></div><div class="lines">${signs.map(e=>lineRow(e,true)).join('')}</div>`:''}
  <p class="fine">A symbolic practice. It holds your intention; it doesn't promise outcomes.</p>`;}};
V.intentionEdit={nav:false,html({draft:d}){const isNew=!S.items.has(d.id);const sg=get(d.sigilId),r=get(d.ritualId);
  return `${edHead(isNew?'New intention':'Edit intention','saveIntention')}
  ${slot(d.imageId,'draft:imageId','16/9')}
  <span class="lbl">Title</span><input class="field" id="i-title" data-bo="title" value="${esc(d.title||'')}" placeholder="e.g. More freedom">
  <span class="lbl">Desire</span><input class="field" id="i-desire" data-bo="desire" value="${esc(d.desire||'')}" placeholder="I want…">
  <span class="lbl">Intention</span><textarea class="field area sm" id="i-statement" data-bo="statement" placeholder="I am building a life where…">${esc(d.statement||'')}</textarea>
  <div class="pair"><div><span class="lbl">Sigil</span><button class="boxbtn" data-a="pickSigil" style="width:100%"><span class="box">${sg?imgTag(sg.imageId)||ico('pen',22):ico('plus',22)}</span></button></div><div><span class="lbl">Ritual</span><button class="boxbtn" data-a="pickOne" data-f="ritualId" data-type="ritual" data-title="Pair with a ritual" style="width:100%"><span class="box photo">${r?imgTag(r.imageId)||`<span class="rsub" style="padding:8px;text-align:center">${esc(r.name)}</span>`:ico('plus',22)}</span></button></div></div>
  <span class="lbl">Actions</span><div class="stepper">${(d.actions||[]).map((a,n)=>`<div class="step"><span class="n">${n+1}</span><input class="field" id="i-act-${n}" data-bo="actions.${n}.text" value="${esc(a.text)}" placeholder="A real-world step"><button class="ibtn sm" data-a="delListItem" data-f="actions" data-i="${n}" aria-label="Remove action">${ico('close',15)}</button></div>`).join('')}</div>
  <button class="addl" data-a="addListItem" data-f="actions" data-obj="1">${ico('plus',16)} Add steps…</button>
  <span class="lbl">Signs that matter to you</span><div class="stepper">${(d.signsToNotice||[]).map((s,n)=>`<div class="step"><input class="field" id="i-sign-${n}" data-bo="signsToNotice.${n}" value="${esc(s)}" placeholder="e.g. a white feather, the number 7"><button class="ibtn sm" data-a="delListItem" data-f="signsToNotice" data-i="${n}" aria-label="Remove">${ico('close',15)}</button></div>`).join('')}</div>
  <button class="addl" data-a="addListItem" data-f="signsToNotice">${ico('plus',16)} Add a sign</button>
  <span class="lbl">Reflection</span><textarea class="field area sm" id="i-refl" data-bo="reflection" placeholder="What changed?">${esc(d.reflection||'')}</textarea>
  <div class="list card mt">${rowBtn('threads','Thread',get(d.threadId)?.name||'None','pickOne','data-f="threadId" data-type="thread" data-title="Link to a thread"')}</div>
  ${isNew?'':`<button class="danger-link" data-a="delIntention" data-id="${d.id}">Delete intention</button>`}`;}};

/* ================= SIGILS ================= */
const SG={tool:'pen',size:6,buf:null,hist:[]};
V.sigils={html(){const sg=all('sigil').sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));return `${head('Sigils',{back:true,right:`<button class="ibtn" data-a="new" data-t="sigil" aria-label="New sigil">${ico('plus')}</button>`})}
  <p class="hint">Personal symbols you draw yourself. Attach them to intentions, rituals or threads.</p>
  ${sg.length?`<div class="grid3">${sg.map(s=>`<div class="tw"><button class="tile sig" data-a="go" data-to="sigil" data-p="${jp({id:s.id})}">${imgTag(s.imageId)}</button><p class="cap">${esc(s.name||'Untitled')}</p></div>`).join('')}</div>`:`<button class="empty-cta" data-a="new" data-t="sigil">No sigils yet. Tap to draw your first symbol.</button>`}`;}};
V.sigil={nav:false,html(p){
  if(p.id&&!p.draft){const s=get(p.id);if(!s)return head('Not found',{back:true});p.draft=clone(s);}
  const d=p.draft;const isNew=!S.items.has(d.id);
  return `${edHead(isNew?'New sigil':'Sigil','saveSigil')}
  <input class="field" id="sg-name" data-bo="name" value="${esc(d.name||'')}" placeholder="Name your sigil" style="margin-bottom:12px">
  <canvas id="sig-cv" class="sig-cv" aria-label="Drawing canvas"></canvas>
  <div class="tools"><button class="ibtn ${SG.tool==='pen'?'ring':''}" data-a="sigTool" data-v="pen" aria-label="Draw">${ico('pen',20)}</button><button class="ibtn ${SG.tool==='eraser'?'ring':''}" data-a="sigTool" data-v="eraser" aria-label="Erase">${ico('eraser',20)}</button><input type="range" id="sg-size" min="2" max="24" value="${SG.size}" aria-label="Line width"><button class="ibtn" data-a="sigUndo" aria-label="Undo">${ico('undo',20)}</button><button class="tbtn" data-a="sigClear">Clear</button></div>
  <div class="list card">
   ${rowBtn('intention','Intention',get(d.intentionId)?.title||'None','pickOne','data-f="intentionId" data-type="intention" data-title="Attach to an intention"')}
   ${rowBtn('ritual','Ritual',get(d.ritualId)?.name||'None','pickOne','data-f="ritualId" data-type="ritual" data-title="Attach to a ritual"')}
   ${rowBtn('threads','Thread',get(d.threadId)?.name||'None','pickOne','data-f="threadId" data-type="thread" data-title="Attach to a thread"')}
  </div>
  ${isNew?'':`<button class="danger-link" data-a="delSigil" data-id="${d.id}">Delete sigil</button>`}`;},
  after(p){const cv=$('#sig-cv');const d=p.draft;const dpr=Math.min(2,window.devicePixelRatio||1);const size=Math.max(200,Math.round(cv.getBoundingClientRect().width));
    cv.width=size*dpr;cv.height=size*dpr;const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.lineCap='round';ctx.lineJoin='round';
    const restore=src=>{ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(src,0,0,cv.width,cv.height);ctx.restore();};
    if(SG.buf&&SG.buf._for===d.id)restore(SG.buf);else{SG.hist=[];SG.buf=null;if(d.imageId&&IMG.get(d.imageId))loadImg(IMG.get(d.imageId)).then(i=>{restore(i);snap();});}
    function snap(){const b=document.createElement('canvas');b.width=cv.width;b.height=cv.height;b.getContext('2d').drawImage(cv,0,0);b._for=d.id;SG.buf=b;}
    SG.cv=cv;SG.restore=restore;SG.snap=snap;
    let drawing=false,last=null;const pt=e=>{const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*size/r.width,y:(e.clientY-r.top)*size/r.height};};
    cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);if(SG.buf){SG.hist.push(SG.buf);if(SG.hist.length>25)SG.hist.shift();}else SG.hist.push(null);drawing=true;last=pt(e);stroke(last,last);};
    cv.onpointermove=e=>{if(!drawing)return;const p2=pt(e);stroke(last,p2);last=p2;};
    const end=()=>{if(!drawing)return;drawing=false;snap();d._dirty=true;};cv.onpointerup=end;cv.onpointercancel=end;
    function stroke(a,b){ctx.globalCompositeOperation=SG.tool==='eraser'?'destination-out':'source-over';ctx.strokeStyle='#f2f2f3';ctx.lineWidth=SG.tool==='eraser'?SG.size*2.5:SG.size;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x+.01,b.y);ctx.stroke();}
    $('#sg-size').oninput=e=>{SG.size=+e.target.value;};
  }};

/* ================= ORACLE ================= */
const ARCH={
  fool:{name:'Beginnings',kw:'Beginnings · Openness · First steps',text:'There is no pattern yet, only a blank page and the freedom to decide what deserves a place on it.',q:'What would you like to start noticing?',rit:['ground','night']},
  hermit:{name:'Rest',kw:'Rest · Withdrawal · Inner work',text:'Perhaps today asks for less input rather than more effort. A quieter evening can be a way of listening.',q:'What could you let go of tonight?',rit:['night','cleans','rest']},
  moon:{name:'Uncertainty',kw:'Uncertainty · Intuition · Night',text:'Not everything needs to be clear yet. Some things are understood slowly, the way eyes adjust to the dark.',q:'What are you sensing that you have not named?',rit:['night','ground']},
  empress:{name:'Care',kw:'Sensuality · Care · Abundance',text:'Your recent entries lean toward pleasure and presence in the body. Care can be its own practice.',q:'What would feel generous toward yourself today?',rit:['beauty','self']},
  magician:{name:'Making',kw:'Making · Will · Resources',text:'You have been creating. The tools are already on the table; the question is where to point them.',q:'What is one thing you could make real this week?',rit:['focus','ground']},
  temperance:{name:'Balance',kw:'Balance · Patience · Flow',text:'Steadiness has been appearing in your days. It is less a stillness than a rhythm you can return to.',q:'What keeps you in this rhythm?',rit:['ground','beauty']},
  chariot:{name:'Direction',kw:'Direction · Focus · Momentum',text:'Your entries show focus and movement. Direction matters more than speed.',q:'Where are you actually heading?',rit:['focus','protect']},
  star:{name:'Hope',kw:'Hope · Renewal · Openness',text:'There is lightness in what you have recorded. Let it be enough without needing a reason.',q:'What are you hoping for, quietly?',rit:['cleans','beauty']},
  strength:{name:'Boundaries',kw:'Boundaries · Gentleness · Courage',text:'Protection is showing up as a theme. Strength can be soft and still hold its ground.',q:'Where do you need a clearer boundary?',rit:['protect','ground']},
  sun:{name:'Warmth',kw:'Warmth · Connection · Joy',text:'You have been around people and warmth. Notice what this gives you, and what it costs.',q:'Who made you feel most like yourself lately?',rit:['beauty','ground']},
  tower:{name:'Release',kw:'Release · Pressure · Change',text:'Your body has recorded a lot of tension lately. Something may want to be put down rather than carried further.',q:'What would loosen if you stopped holding it?',rit:['cleans','release','night']},
  wheel:{name:'Cycles',kw:'Cycles · Change · Return',text:'Your states have been shifting. Change is a pattern too, and it tends to come back around.',q:'What returns, whatever you do?',rit:['ground','night']},
};
const STATE_ARCH={restless:'hermit',withdrawn:'hermit',heavy:'hermit',tired:'hermit',drained:'hermit',uncertain:'moon',anxious:'moon',dreamy:'moon',magnetic:'empress',sensual:'empress',creative:'magician',calm:'temperance',grounded:'temperance',focused:'chariot',expansive:'star',light:'star',hopeful:'star',protected:'strength',social:'sun',joyful:'sun'};
function oracleReading(){
  const now=Date.now();const es=entries().filter(e=>e.date>=now-14*DAY);const pattern=[];let key;
  const stc=new Map();es.forEach(e=>(e.stateIds||[]).forEach(id=>{if(get(id))stc.set(id,(stc.get(id)||0)+1);}));const top=[...stc].sort((a,b)=>b[1]-a[1]);const totalSt=[...stc.values()].reduce((a,b)=>a+b,0);
  const body=es.filter(e=>e.kind==='body'&&e.body);const sens=new Map();body.forEach(e=>{const k=`${e.body.sensation||'A sensation'}|${e.body.region||''}`;sens.set(k,(sens.get(k)||0)+1);});const topSens=[...sens].sort((a,b)=>b[1]-a[1])[0];
  const tension=body.filter(e=>/tension|tense|pain|tight|pressure|ache/i.test(e.body.sensation||'')).length;
  if(es.length<3)key='fool';
  else if(tension>=3&&tension>=(top[0]?.[1]||0))key='tower';
  else if(top.length>=4&&top[0][1]/totalSt<.35)key='wheel';
  else if(top.length)key=STATE_ARCH[get(top[0][0]).name.trim().toLowerCase()]||'wheel';
  else if(es.some(e=>e.kind==='sign'||e.intentionId))key='star';
  else key='temperance';
  /* what has been noticed most: a state or a sensation, counted this week, or over two weeks if the week is thin */
  const count=(fn,since)=>es.filter(e=>e.date>=since&&fn(e)).length;let noticing=null,n=0,when='';
  const cands=[...top.slice(0,3).map(([id])=>({w:get(id).name,fn:e=>(e.stateIds||[]).includes(id)})),...[...new Set(body.map(e=>e.body.sensation).filter(Boolean))].map(w=>({w,fn:e=>e.kind==='body'&&e.body&&e.body.sensation===w}))];
  for(const [since,label] of [[now-7*DAY,'this week'],[now-14*DAY,'in the last two weeks']]){const best=cands.map(c=>({c,k:count(c.fn,since)})).sort((a,b)=>b.k-a.k)[0];if(best&&best.k>=2){noticing=best.c.w;n=best.k;when=label;break;}}
  let reflection='';
  if(top.length){const [id]=top[0];const s=get(id);
    const days=new Set(es.filter(e=>(e.stateIds||[]).includes(id)).map(e=>dkey(e.date)));
    if(days.size>=2){const cc=new Map();es.forEach(e=>(e.categoryIds||[]).forEach(c=>{if(!get(c))return;const k=dkey(e.date);if(days.has(k)){if(!cc.has(c))cc.set(c,new Set());cc.get(c).add(k);}}));
      const best=[...cc].sort((a,b)=>b[1].size-a[1].size)[0];if(best&&best[1].size>=2){reflection=`You seem to notice ${s.name.toLowerCase()} most often on days you also record ${get(best[0]).name.toLowerCase()}.`;pattern.push(`On ${best[1].size} of the ${days.size} days you felt ${s.name.toLowerCase()}, you also recorded ${get(best[0]).name}.`);}}}
  if(topSens&&topSens[1]>=2){const [sn,rg]=topSens[0].split('|');pattern.push(`${sn}${rg?` in your ${rg.toLowerCase()}`:''} appeared ${times(topSens[1])}.`);if(!reflection&&rg)reflection=`${sn} keeps returning to your ${rg.toLowerCase()}. It may be worth noticing what comes just before it.`;}
  if(!pattern.length)pattern.push(es.length?`You have made ${plural(es.length,'entry','entries')} in the last 14 days.`:'Nothing has been recorded in the last 14 days.');
  const a=ARCH[key];const rs=ordered('ritual');const rit=rs.find(r=>a.rit.some(k=>`${r.name} ${r.purpose||''} ${r.group||''}`.toLowerCase().includes(k)))||rs[0]||null;
  return{key,name:a.name,kw:a.kw,text:reflection||a.text,q:a.q,pattern,noticing,n,when,ritualId:rit?rit.id:null};}
function countsHTML(o,{saved}){return `
  <p class="eyebrow mt">${o.noticing?'You’ve been noticing':'Nothing has come back yet'}</p>
  <h2 class="or-name">${esc(o.noticing||'No repeated pattern')}</h2><p class="or-kw">${o.noticing?`${esc(times(o.n))} ${esc(o.when)}`:'A state or sensation shows here once you record it at least twice within two weeks.'}</p>
  ${o.pattern&&o.pattern.length?`<div class="card or-pat">${o.pattern.map(p=>`<p>${esc(p)}</p>`).join('')}</div>`:''}
  ${saved}<p class="fine">Counted only from what you recorded on this device. Archetype readings are off; turn them on in Settings → Oracle readings.</p>`;}
function readingHTML(o,{saved}){if(!S.settings.oracleArchetypes)return countsHTML(o,{saved});const r=get(o.ritualId);return `
  <div class="or-img">${slot((S.settings.oracleImages||{})[o.key],`smap:oracleImages:${o.key}`,'3/2')}</div>
  <p class="eyebrow mt">${o.noticing?'You’ve been noticing':'A theme'}</p>
  <h2 class="or-name">${esc(o.noticing||o.name)}</h2><p class="or-kw">${o.noticing?`${esc(times(o.n))} ${esc(o.when)}`:esc(o.kw)}</p>
  <p class="eyebrow">Reflection</p><p class="or-text">${esc(o.text)}</p>
  <p class="eyebrow">Question</p><p class="or-q">${esc(o.q)}</p>
  ${o.pattern&&o.pattern.length?`<div class="card or-pat">${o.pattern.map(p=>`<p>${esc(p)}</p>`).join('')}</div>`:''}
  ${r?`<p class="eyebrow">If you want a ritual</p><div class="list card" style="margin:8px 0 18px"><button class="row" data-a="go" data-to="ritual" data-p="${jp({id:r.id})}"><span class="thumb" style="width:48px;height:48px">${imgTag(r.imageId)||`<i style="--c:var(--muted)">${ico('candle',20)}</i>`}</span><span class="row-m"><span class="row-t">${esc(r.name)}</span><span class="row-s">${esc([r.duration,r.purpose].filter(Boolean).join(' · '))}</span></span>${ico('chev',16)}</button></div>`:''}
  ${saved}<p class="fine">Drawn only from what you recorded on this device. A reflection, not a prediction or a diagnosis.</p>`;}
V.oracle={nav:false,quiet:true,html(){const o=oracleReading();const done=all('oracle').find(x=>dkey(x.date)===dkey(Date.now())&&x.key===o.key&&x.noticing===o.noticing);
  return `${head('Oracle',{back:true})}${readingHTML(o,{saved:`<button class="btn" data-a="oracleSave" ${done?'disabled':''}>${done?'Saved to today':'Save to today'}</button>`})}`;}};
V.reading={quiet:true,html({id}){const o=get(id);if(!o)return head('Not found',{back:true});return `${head(fmt.day(o.date),{back:true})}${readingHTML(o,{saved:''})}<button class="danger-link" data-a="delReading" data-id="${id}">Delete reading</button>`;}};

/* ================= SETTINGS ================= */
function colorPicker(c){const pal=(S.settings.palette||[]).map(p=>p.color);const list=pal.length?pal:PALETTE;return `<div class="swatches">${list.map(p=>`<button class="sw ${c===p?'on':''}" style="--c:${p}" data-a="dset" data-f="color" data-v="${p}" aria-label="Colour ${p}"></button>`).join('')}<label class="sw custom ${list.includes(c)?'':'on'}"><input type="color" id="cp" data-bo="color" value="${esc(c||'#c98d7c')}" aria-label="Custom colour"></label></div>`;}
function iconPicker(c){return `<div class="icons">${ICON_CHOICES.map(i=>`<button class="icb ${c===i?'on':''}" data-a="dset" data-f="icon" data-v="${i}" aria-label="${i}">${ico(i,20)}</button>`).join('')}</div>`;}
const seg=(k,opts)=>`<div class="seg">${opts.map(([v,l])=>`<button class="${S.settings[k]===v?'on':''}" data-a="setS" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
const sortRow=(type,x,extra='')=>`<div class="row srow" data-id="${x.id}"><i class="dot lg" style="--c:${x.color}"></i><button class="row-m btn-plain" data-a="editMeta" data-id="${x.id}">${esc(x.name)}</button>${extra}<div class="sthumb">${slot(x.imageId,`item:${x.id}:imageId`,'1/1')}</div><span class="handle" aria-label="Drag to reorder">${ico('drag',18)}</span></div>`;
const SET={
  oracleSet(){const on=!!S.settings.oracleArchetypes;return `<p class="hint">The Oracle always shows plain counts from your own entries: what came back, how often, and what you recorded on the same days. Archetype readings add a themed reflection and a question on top, chosen from a fixed set of twelve. They are a prompt to think with, not a statement about you.</p><div class="list card"><div class="row"><span class="row-m"><span class="row-t">Archetype readings</span><span class="row-s">${on?'On':'Off'}</span></span><button class="tog ${on?'on':''}" data-a="togArchetypes" role="switch" aria-checked="${on}" aria-label="Archetype readings"><i></i></button></div></div>`;},
  categories(){return `<p class="hint">Your own words for the parts of your life. Drag to reorder.</p><div class="list card sortable" data-sort="category">${ordered('category').map(c=>sortRow('category',c)).join('')}<button class="row add" data-a="new" data-t="category">${ico('plus',18)} Add a category</button></div>`;},
  states(){return `<p class="hint">States you can attach to any day or entry. Make them yours.</p><div class="list card sortable" data-sort="state">${ordered('state').map(s=>sortRow('state',s)).join('')}<button class="row add" data-a="new" data-t="state">${ico('plus',18)} Add a state</button></div>`;},
  palette(){const pal=S.settings.palette||[];return `<p class="hint">Your own colour language. Give each colour any name you like; it means what you decide. Drag to reorder.</p><div class="list card sortable" data-sort="palette">${pal.map(p=>`<div class="row srow" data-id="${p.id}"><i class="dot lg" style="--c:${p.color}"></i><button class="row-m btn-plain" data-a="editSwatch" data-id="${p.id}">${esc(p.name||'Untitled')}</button><span class="row-v">${plural(all('entry').filter(e=>e.colorId===p.id).length,'entry','entries')}</span><span class="handle" aria-label="Drag to reorder">${ico('drag',18)}</span></div>`).join('')}<button class="row add" data-a="addPaletteColor">${ico('plus',18)} Add a colour</button></div>`;},
  theme(){const s=S.settings;return `<span class="lbl" style="margin-top:4px">Name of your space</span><input class="field" id="s-name" data-sbind="name" value="${esc(s.name)}" placeholder="Body Oracle">
   <span class="lbl">Accent</span><div class="swatches">${ACCENTS.map(a=>`<button class="sw ${s.accent===a.c?'on':''}" style="--c:${a.c==='#f2f2f3'?'var(--text)':a.c}" data-a="setS" data-k="accent" data-v="${a.c}" aria-label="${a.n}"></button>`).join('')}<label class="sw custom ${ACCENTS.some(a=>a.c===s.accent)?'':'on'}"><input type="color" id="s-acc" data-scolor="accent" value="${esc(s.accent)}" aria-label="Custom accent"></label></div>
   <span class="lbl">Cards</span>${seg('cards',[['filled','Filled'],['outline','Outline']])}`;},
  corners(){return `<p class="hint">How rounded images and cards are.</p>${seg('corners',[['soft','Soft'],['round','Round'],['square','Square']])}`;},
  home(){const s=S.settings;return `<p class="hint">Drag to reorder. Switch a section off to hide it.</p>
   <div class="list card sortable" data-sort="home">${s.home.filter(m=>MODS[m.type]).map(m=>`<div class="row srow" data-id="${m.type}"><span class="row-m"><span class="row-t">${MODS[m.type].label}</span>${MODS[m.type].ready&&!MODS[m.type].ready()?`<span class="row-s">${MODS[m.type].hint}</span>`:''}</span><button class="tog ${m.on?'on':''}" data-a="togMod" data-id="${m.type}" role="switch" aria-checked="${m.on}" aria-label="Show ${MODS[m.type].label}"><i></i></button><span class="handle" aria-label="Drag to reorder">${ico('drag',18)}</span></div>`).join('')}</div>
   ${s.home.find(m=>m.type==='hero'&&m.on)?`<span class="lbl">Home image & words</span><div style="max-width:220px">${slot(s.heroImageId,'settings:heroImageId','4/3')}</div><input class="field mt" id="s-hero" data-sbind="heroText" value="${esc(s.heroText||'')}" placeholder="A line for your Home">`:''}`;},
  radial(){const s=S.settings;return `<p class="hint">What appears when you tap +. Up to 8 at once. Tap a name to rename or remove it.</p>
   <div class="list card sortable" data-sort="radial">${s.radial.map(r=>`<div class="row srow" data-id="${r.id}"><span class="row-i">${ico(radialIcon(r),18)}</span><button class="row-m btn-plain" data-a="radialItem" data-id="${r.id}">${esc(r.label)}</button><button class="tog ${r.on?'on':''}" data-a="togRadial" data-id="${r.id}" role="switch" aria-checked="${r.on}" aria-label="Show ${esc(r.label)}"><i></i></button><span class="handle" aria-label="Drag to reorder">${ico('drag',18)}</span></div>`).join('')}<button class="row add" data-a="addRadial">${ico('plus',18)} Add to + menu</button></div>`;},
  moments(){const s=S.settings;const chipsFor=k=>`<div class="chips">${s[k].map((x,i)=>`<button class="chip" data-a="delListS" data-k="${k}" data-i="${i}">${esc(x)}</button>`).join('')}<button class="chip dashed" data-a="addListS" data-k="${k}">+ Add</button></div>`;
   return `<span class="lbl" style="margin-top:4px">Moments</span><p class="hint">Offered when you open “I need something”. Your own situations are added automatically. Tap one to remove it.</p>${chipsFor('moments')}
   <span class="lbl">Situation suggestions</span><p class="hint">Offered when you write a ritual or prayer.</p>${chipsFor('situations')}`;},
  body(){const s=S.settings;return `<span class="lbl" style="margin-top:4px">Sensations</span><p class="hint">Words offered when you tap the body. Tap one to remove it.</p><div class="chips">${s.sensations.map((x,i)=>`<button class="chip" data-a="delListS" data-k="sensations" data-i="${i}">${esc(x)}</button>`).join('')}<button class="chip dashed" data-a="addListS" data-k="sensations">+ Add</button></div>
   <span class="lbl">Systems</span><p class="hint">Things that don’t belong to one place.</p><div class="chips">${s.systems.map((x,i)=>`<button class="chip" data-a="delListS" data-k="systems" data-i="${i}">${esc(x)}</button>`).join('')}<button class="chip dashed" data-a="addListS" data-k="systems">+ Add</button></div>`;},
  data(){const n=all('entry').length;return `<p class="hint">Everything you add stays in this browser on this device. Nothing is sent anywhere.</p>
   <div class="list card">${[['Entries',n],['Images',IMG.size],['Threads',all('thread').length],['Rituals',all('ritual').length],['Intentions',all('intention').length],['Sigils',all('sigil').length],['Oracle readings',all('oracle').length]].map(([l,v])=>`<div class="row"><span class="row-m">${l}</span><span class="row-v">${v}</span></div>`).join('')}</div>
   <p class="hint mt">Removing the app from your Home Screen deletes its data. Export a backup now and then.</p>`;},
  backup(){const n=all('entry').length;return `<div class="list card"><button class="row" data-a="exportData"><span class="row-i">${ico('archive',18)}</span><span class="row-m"><span class="row-t">Export a backup</span><span class="row-s">${plural(n,'entry','entries')} and ${plural(IMG.size,'image','images')}</span></span></button>
   <label class="row" for="import-file"><span class="row-i">${ico('undo',18)}</span><span class="row-m"><span class="row-t">Restore from a backup</span><span class="row-s">Replaces what is here now</span></span><input type="file" id="import-file" accept="application/json,.json" hidden></label></div>`;},
  reset(){return `<p class="hint">Erase every Body Oracle entry, image, state, ritual, prayer, intention, sigil and setting on this device and start Body Oracle again from the beginning. Christina’s events, journal, threads and categories are kept. This cannot be undone.</p><button class="btn ghost" data-a="eraseAll" style="color:var(--danger)">Erase Body Oracle data</button>`;},
};
const SET_TITLES={oracleSet:'Oracle readings',moments:'Moments & situations',categories:'Categories',states:'States',palette:'My palette',theme:'Theme',corners:'Corners',home:'Home layout',radial:'+ menu',body:'Body',data:'Data',backup:'Backup',reset:'Reset'};
const setRow=(icon,label,act,val='',extra='')=>`<button class="row" data-a="${act}" ${extra}><span class="row-i">${icon}</span><span class="row-m">${label}</span><span class="row-v">${esc(val)}</span>${ico('chev',16)}</button>`;
const setGo=(k,icon,val='')=>setRow(icon,SET_TITLES[k],'go',val,`data-to="set" data-p="${esc(JSON.stringify({k}))}"`);
const goRow=(to,icon,label,val='')=>setRow(icon,label,'go',val,`data-to="${to}"`);
V.settings={html(){const pal=S.settings.palette||[];return `${head('Settings',{back:true})}
  <h2 class="sec-t set-g">My world</h2><div class="list card">
   ${setGo('categories',ico('tag',18),ordered('category').length)}
   ${setGo('states',ico('state',18),ordered('state').length)}
   ${setGo('palette',`<span class="pal-mini">${pal.slice(0,4).map(p=>`<i style="--c:${p.color}"></i>`).join('')}</span>`,pal.length)}
   ${setRow(ico('threads',18),'Threads','tab',all('thread').length,'data-t="threads"')}
   ${setRow(ico('ritual',18),'Rituals','tab',all('ritual').length,'data-t="rituals"')}
   ${setRow(ico('prayer',18),'Prayers','tab',all('prayer').length,'data-t="prayers"')}
   ${setGo('moments',ico('state',18))}
   ${goRow('intentions',ico('intention',18),'Intentions',all('intention').length)}
   ${goRow('sigils',ico('pen',18),'Sigils',all('sigil').length)}
   ${setRow(ico('oracle',18),'Oracle','go','', 'data-to="oracle"')}
   ${setGo('oracleSet',ico('oracle',18),S.settings.oracleArchetypes?'Archetypes on':'Counts only')}
   ${setGo('body',ico('body',18))}
  </div>
  <h2 class="sec-t set-g">Appearance</h2><div class="list card">
   ${setGo('theme',ico('sun',18))}${setGo('corners',ico('photo',18),{soft:'Soft',round:'Round',square:'Square'}[S.settings.corners]||'')}${setGo('home',ico('home',18))}${setGo('radial',ico('plus',18))}
  </div>
  <h2 class="sec-t set-g">Advanced</h2><div class="list card">
   ${setGo('data',ico('archive',18))}${setGo('backup',ico('undo',18))}${setGo('reset',ico('trash',18))}
  </div>`;}};
V.set={html({k}){return head(SET_TITLES[k]||'Settings',{back:true})+(SET[k]?SET[k]():'');},after:bindSortables};
V.metaEdit={nav:false,html({draft:d}){const isState=d.type==='state';const isNew=!S.items.has(d.id);const noun=isState?'state':'category';
  return `${edHead(isNew?`New ${noun}`:`Edit ${noun}`,'saveMeta')}
  <div class="ce-top"><div>${slot(d.imageId,'draft:imageId','1/1')}</div><div><span class="lbl">Name</span><input class="field" id="m-name" data-bo="name" value="${esc(d.name||'')}" placeholder="${isState?'e.g. Magnetic':'e.g. Germany'}"></div></div>
  ${isState?`<span class="lbl">Description</span><textarea class="field area sm" id="m-desc" data-bo="description" placeholder="What this state feels like to you">${esc(d.description||'')}</textarea>`:''}
  <span class="lbl">Color</span>${colorPicker(d.color)}
  <span class="lbl">Icon</span>${iconPicker(d.icon)}
  ${isNew||d.id===OTHER_CATEGORY_ID?'':`<button class="danger-link" data-a="delMeta" data-id="${d.id}">Delete ${noun}</button>`}`;}};

/* sortable lists */
function bindSortables(){$$('.sortable').forEach(list=>{if(list._s)return;list._s=1;
  list.addEventListener('pointerdown',e=>{const h=e.target.closest('.handle');if(!h)return;const row=h.closest('.srow');e.preventDefault();row.classList.add('dragging');
    const move=ev=>{ev.preventDefault();const y=ev.clientY;for(const r of $$('.srow',list)){if(r===row)continue;const b=r.getBoundingClientRect();if(y>b.top&&y<b.bottom){if(y<b.top+b.height/2)list.insertBefore(row,r);else list.insertBefore(row,r.nextSibling);break;}}};
    const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);row.classList.remove('dragging');reorder(list.dataset.sort,$$('.srow',list).map(r=>r.dataset.id));};
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);});});}
async function reorder(kind,ids){
  if(kind==='steps'){const d=draft();d.steps.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));render();return;}
  if(kind==='home'||kind==='radial'||kind==='palette'){const key=kind==='home'?'type':'id';const arr=S.settings[kind];arr.sort((a,b)=>ids.indexOf(a[key])-ids.indexOf(b[key]));await saveSettings();return;}
  for(let i=0;i<ids.length;i++){const x=get(ids[i]);if(x&&x.order!==i){x.order=i;await save(x);}}}

/* ================= ONBOARDING ================= */
const OB_CATS=['Body','Mind','Ritual','Dreams','Beauty','Relationships'];
V.onboard={nav:false,html(p){
  if(p.step===2){const extra=p.cats.filter(c=>!OB_CATS.includes(c));return `<div class="ob"><h1>Body Oracle</h1><h2>What would you like to notice?</h2><p class="hint">Choose any, or none.</p>
    <div class="chips" style="margin-top:10px">${[...OB_CATS,...extra].map(c=>`<button class="chip ${p.cats.includes(c)?'on':''}" data-a="obCat" data-v="${esc(c)}" aria-pressed="${p.cats.includes(c)}">${esc(c)}</button>`).join('')}<button class="chip dashed" data-a="obCustom">+ Something else</button></div>
    <div class="grow"></div><div class="foot"><button class="btn" data-a="obStep" data-v="3">Continue</button></div></div>`;}
  if(p.step===3)return `<div class="ob"><h1>Body Oracle</h1><div class="grow"></div><h2>You’re ready.</h2><p class="ob-p">You can change everything later.</p><div class="grow"></div><div class="foot"><button class="btn" data-a="obEnter">Enter Body Oracle</button></div></div>`;
  return `<div class="ob"><div class="grow"></div><h1 class="ob-brand">Body Oracle</h1><p class="ob-p">Prepare something now for a version of yourself who will need it later.</p><p class="ob-p ob-s">Rituals for the moments that come back. Words for the states you know. A record of what happened.</p><div class="grow"></div><div class="foot"><button class="btn" data-a="obStep" data-v="2">Continue</button></div></div>`;}};
function defaultSettings(){return{id:'settings',type:'settings',name:'Body Oracle',accent:'#f2f2f3',cards:'filled',corners:'soft',heroImageId:null,heroText:'A quieter day is still a productive day.',currentIntentionId:null,oracleImages:{},oracleArchetypes:false,
  palette:DEFAULT_PALETTE.map(([name,color])=>({id:uid(),name,color})),
  moments:MOMENTS.slice(),situations:SITUATIONS.slice(),tonight:null,
  v:3,home:HOME_DEFAULT.map(t=>({type:t,on:HOME_ON.has(t)})),
  radial:['newRitual','newPrayer','entry:note','entry:photo','body','state'].map(a=>{const t=RADIAL_TYPES.find(x=>x.action===a);return{id:uid(),action:a,label:t.label,on:true};}),
  sensations:['Light','Heavy','Tense','Warm','Numb','Restless'],
  systems:['Breath','Digestion','Skin','Sleep','Energy','Nervous system','Appetite']};}
async function seed(catNames){const now=Date.now();const items=[];let o=0;const mk=(type,x)=>{const it=Object.assign({id:uid(),type,createdAt:now+(o++),imageId:null},x);items.push(it);return it;};
  const known=new Set(ordered('category').map(c=>lc(c.name)));const base=ordered('category').length;
  catNames.filter(n=>!known.has(lc(n))).forEach((n,i)=>{const d=CAT_DEF[n];mk('category',{name:n,color:d?d[0]:PALETTE[i%PALETTE.length],icon:d?d[1]:'sign',order:base+i});});
  [['Calm','#9fb7a8','Settled, unhurried.'],['Restless','#d9826b','Can’t quite land anywhere.'],['Heavy','#8a8fb0','Slow, weighted.'],['Creative','#d8b56a','Ideas want out.'],['Magnetic','#c46b8f','Drawing things toward me.'],['Grounded','#a68a6d','Feet on the floor.']].forEach(([n,c,ds],i)=>mk('state',{name:n,color:c,icon:'state',description:ds,order:i}));
  [['My Body','Observations · Patterns · Care','#c98d7c','body'],['Becoming Her','Intentions · Actions · Identity','#d6b46a','sign'],['Manifestation','Desires · Rituals · Signs','#b49ccc','intention'],['Beauty','Self-care · Aesthetics · Style','#d39aa8','flower'],['My Home','Space · Comfort · Environment','#b59a7a','home']].forEach(([n,ds,c,ic])=>mk('thread',{name:n,description:ds,color:c,icon:ic,coverId:null}));
  const st=a=>a.map(x=>typeof x==='string'?newStep(x):Object.assign(newStep(x[0]),x[1]));
  const unwanted=mk('prayer',{sample:true,name:'Read this when I feel unwanted',situations:['When I feel rejected','When I feel lonely'],text:'I am still here.\n\nWhat leaves me does not determine my value.\n\nI do not need to chase what has already withdrawn.\n\nLet me return to myself.',tags:'',color:null,colorId:null,favourite:false,lastReadAt:null});
  const prod=(name,notes,price='')=>Object.assign(newProduct(),{name,notes,price});
  const reset={name:'Reset After a Difficult Day',group:'Returning',duration:'40 min',situations:['After a difficult day','When I feel disconnected'],intention:'I want to return to myself after spending too much energy on other people.',
    objects:[{id:uid(),name:'Journal',have:false},{id:uid(),name:'Black dress',have:false},{id:uid(),name:'Playlist',have:false}],products:[prod('Lavender candle','The smell that tells me the day is over.'),prod('Rose perfume','Wear this during the ritual because I associate it with becoming softer.')],prayerIds:[unwanted.id]};
  reset.steps=st([['Take a shower.',{duration:'10 min',note:'Let the day go with the water.'}],['Put on the perfume.',{productId:reset.products[1].id}],['Light the candle.',{productId:reset.products[0].id,check:true}],['Put your phone away.',{check:true}],['Sit somewhere quiet.',{duration:'3 min'}],['Read the prayer.',{prayerId:unwanted.id}],['Write what you are leaving behind.',{note:'One page. You do not need to reread it.'}]]);
  const R=[[reset.name,reset],
    ['Grounding',{group:'Grounding',duration:'5 min',situations:['When I feel disconnected','When I am overwhelmed'],intention:'Come back into the body and the room.',steps:st(['Stand or sit with both feet on the floor.','Name five things you can see.',['Breathe out for longer than you breathe in, ten times.',{duration:'2 min'}],'Press your palms together and notice the warmth.'])}],
    ['Protection',{group:'Protection',duration:'5 min',situations:['Before seeing someone','When I move into a new place'],intention:'Mark what I will and will not carry into this space.',objects:[{id:uid(),name:'Candle',have:false}],steps:st(['Stand by your door or your bed.','Say out loud what you will not carry into this space.','Draw a line in the air with your hand, or close the door slowly.','Light a candle if you like, and let it mark the boundary.'])}],
    ['Night Reset',{group:'Sleep',duration:'15 min',situations:['Before sleep','When I cannot sleep'],intention:'Let the day be finished.',steps:st([['Dim the lights and put your phone face down.',{check:true}],'Clear one surface in the room.','Write three lines about today.','Drink a glass of water.','Lie down and let the day be finished.'])}],
    ['Beauty Ritual',{group:'Beauty',duration:'10 min',situations:['Before going out','When I feel ugly'],intention:'Look at myself without correcting anything.',steps:st(['Wash your face with warm water.','Apply your skincare slowly, with your hands.','Look at yourself without correcting anything.','Choose one thing you like and say it.'])}]];
  R.forEach(([n,x],i)=>{const r=mk('ritual',Object.assign({name:n,sample:true,order:i,threadId:null,intentionId:null,sigilId:null},x));normRitual(r);r.purpose=r.intention;});
  const I=[['More freedom','I want more freedom.','I am building a life where I can move freely.'],['More presence','I want to be here, not somewhere in my head.','I return to my body and to the room I am in.'],['More confidence','I want to trust myself more.','I act before I feel completely ready.']];
  const ints=I.map(([t,de,st])=>mk('intention',{sample:true,title:t,desire:de,statement:st,actions:[],signsToNotice:[],reflection:'',threadId:null,ritualId:null,sigilId:null}));
  S.settings.currentIntentionId=ints[0].id;
  for(const it of items){S.items.set(it.id,it);}await Promise.all(items.map(it=>DB.put(it).catch(()=>{})));await saveSettings();}

/* ================= RADIAL ================= */
function openRadial(){const items=S.settings.radial.filter(r=>r.on).slice(0,8);
  sheet(items.map(r=>({label:r.label,fn:()=>A.radialPick({dataset:{id:r.id}})})),'Add to Body Oracle');}
function closeRadial(){}
/* ================= actions ================= */
const draft=()=>cur().params.draft;
function openEntry(kind,extra,pick){const d=newEntryDraft(kind,extra);go('edit',{draft:d});if(pick){const ref=parseRef('draft:photoIds:new');pickImage('4/3',id=>ref.set(id));}}
function newBody(extra={}){const bc=ordered('category').find(c=>c.name.toLowerCase()==='body');go('body',{draft:newEntryDraft('body',Object.assign({body:{view:'front',region:null,side:null,sensation:null,intensity:3},categoryIds:bc?[bc.id]:[]},extra))});}
const NEW={
  entry:()=>openEntry('note'),body:()=>newBody(),
  thread:()=>go('threadEdit',{draft:{id:uid(),type:'thread',name:'',description:'',color:PALETTE[all('thread').length%PALETTE.length],icon:'threads',coverId:null}}),
  category:()=>go('metaEdit',{draft:{id:uid(),type:'category',name:'',color:PALETTE[all('category').length%PALETTE.length],icon:'sign',imageId:null,order:all('category').length}}),
  state:()=>go('metaEdit',{draft:{id:uid(),type:'state',name:'',description:'',color:PALETTE[(all('state').length+3)%PALETTE.length],icon:'state',imageId:null,order:all('state').length}}),
  ritual:(extra={})=>{const d=Object.assign({id:uid(),type:'ritual',name:'',purpose:'',duration:'',group:'',steps:[newStep(),newStep(),newStep()],imageId:null,threadId:null,intentionId:null,sigilId:null,sample:false},extra);normRitual(d);go('ritualEdit',{draft:d});},
  prayer:(extra={},returnTo)=>{const d=Object.assign({id:uid(),type:'prayer',name:'',text:'',imageId:null,_rituals:[]},extra);normPrayer(d);go('prayerEdit',{draft:d,returnTo});},
  intention:()=>go('intentionEdit',{draft:{id:uid(),type:'intention',title:'',desire:'',statement:'',actions:[],signsToNotice:[],reflection:'',imageId:null,sigilId:null,ritualId:null,threadId:null}}),
  sigil:(extra={})=>{SG.buf=null;SG.hist=[];go('sigil',{draft:Object.assign({id:uid(),type:'sigil',name:'',imageId:null,intentionId:null,ritualId:null,threadId:null},extra)});},
};
async function quickCreate(type,name){const d=CAT_DEF[name];const x={id:uid(),type,name,color:d?d[0]:PALETTE[all(type).length%PALETTE.length],icon:d?d[1]:(type==='state'?'state':type==='thread'?'threads':'sign'),imageId:null,order:all(type).length};if(type==='thread')x.description='';await save(x);return x;}
function stateLogSheet(){pickSheet('How are you?',ordered('state').map(s=>({id:s.id,label:s.name,color:s.color})),[],true,async ids=>{if(!ids.length)return;await save(newEntryDraft('state',{stateIds:ids}));render();toast('Added to today');},{label:'New state',fn:()=>NEW.state()});}
const A={
  openJournal:t=>{const r=CData.records.find(x=>x.id===t.dataset.id);const k=registry.kinds.journal;if(r&&k)k.open(r);},
  togArchetypes:async()=>{S.settings.oracleArchetypes=!S.settings.oracleArchetypes;await saveSettings();render();},
  go:t=>go(t.dataset.to,t.dataset.p?JSON.parse(t.dataset.p):{}),
  back:()=>back(),
  tab:t=>tab(t.dataset.t),
  radial:()=>openRadial(),
  closeRadial:()=>closeRadial(),
  radialPick:t=>{const r=S.settings.radial.find(x=>x.id===t.dataset.id);closeRadial();if(!r)return;const a=r.action;
    if(a==='newRitual')NEW.ritual();else if(a==='newPrayer')NEW.prayer();
    else if(a==='body')newBody();else if(a==='intention')NEW.intention();else if(a==='state')stateLogSheet();else if(a==='sigil')NEW.sigil();
    else if(a==='ritual')openEntry('ritual');else if(a==='sign')openEntry('sign',{intentionId:S.settings.currentIntentionId||null});
    else if(a==='entry:photo')openEntry('photo',{},true);else if(a.startsWith('entry:'))openEntry(a.slice(6));
    else if(a.startsWith('cat:'))openEntry('note',{categoryIds:[a.slice(4)]});},
  playVid:t=>playVideo(t.dataset.id),
  slot:t=>{const ref=parseRef(t.dataset.ref),id=ref.get(),ratio=t.dataset.ratio||'1/1';
    if(!id||!IMG.get(id))return pickImage(ratio,nid=>ref.set(nid));
    const v=isVid(id);sheet([...(v?[{label:'Play video',fn:()=>playVideo(id)}]:[]),{label:v?'Replace video':'Replace image',fn:()=>pickImage(ratio,async nid=>{const old=ref.get();await ref.set(nid);ref.drop(old);})},...(v?[]:[{label:'Crop',fn:()=>recrop(id,ratio)}]),...(ref.coverable?[{label:'Set as cover',fn:()=>ref.makeCover()}]:[]),{label:v?'Remove video':'Remove image',danger:true,fn:async()=>{await ref.set(null);ref.drop(id);}}]);},
  editHero:()=>inputSheet('Words for your Home',S.settings.heroText,async v=>{S.settings.heroText=v;await saveSettings();render();},{ph:'My body is asking for a quieter day.',multiline:true}),
  logState:async t=>{const id=t.dataset.id;const k=dkey(Date.now());const ex=all('entry').find(e=>e.kind==='state'&&dkey(e.date)===k&&(e.stateIds||[]).includes(id)&&!(e.text||'').trim());
    if(ex){if(ex.stateIds.length>1){ex.stateIds=ex.stateIds.filter(s=>s!==id);await save(ex);}else await removeItem(ex.id);}else await save(newEntryDraft('state',{stateIds:[id]}));render();},
  mapFilter:t=>{MS.filter=t.dataset.f;if(MS.mode!=='calendar')MS.mode='timeline';tab('map');},
  archView:t=>{AS.view=t.dataset.v;render();},
  mapMode:t=>{MS.mode=t.dataset.m;render();},
  calMonth:t=>{const b=MS.ym?new Date(MS.ym+'-01T12:00:00'):new Date();b.setDate(1);b.setMonth(b.getMonth()+ +t.dataset.d);MS.ym=`${b.getFullYear()}-${pad(b.getMonth()+1)}`;render();},
  calDay:t=>{MS.sel=t.dataset.k;const d=new Date(t.dataset.k+'T12:00:00');MS.ym=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;render();},
  newOnDay:t=>{const k=t.dataset.k;let d=new Date(k+'T12:00:00');if(k===dkey(Date.now()))d=new Date();openEntry('note',{date:d.getTime()});},
  searchAll:()=>{tab('archive');setTimeout(()=>{const q=$('#arch-q');if(q)q.focus();},30);},
  new:t=>(NEW[t.dataset.t]||NEW.entry)(),
  editEntry:t=>{const e=get(t.dataset.id);if(!e)return;if(isLocked(e.date)){toast('Past months are read-only.');return;}const d=clone(e);if(e.kind==='body')go('body',{draft:d});else go('edit',{draft:d});},
  delEntry:t=>{const e=get(t.dataset.id);if(!e)return;if(isLocked(e.date)){toast('Past months are read-only.');return;}confirmSheet('Delete this entry? Its images are deleted too.','Delete entry',async()=>{(e.photoIds||[]).forEach(dropImage);await removeItem(e.id);back();toast('Deleted');});},
  saveEntry:async()=>{const d=draft();const has=(d.text||'').trim()||(d.photoIds||[]).length||(d.stateIds||[]).length||(d.categoryIds||[]).length||d.ritualId;
    if(!has){toast('Add a few words, an image, a state or a category first.');return;}
    finalizeDraft(d);await save(d);R.stack.pop();render();toast('Saved');},
  saveBody:async()=>{const d=draft();if(!d.body.region){toast('Tap a place on the body first.');return;}finalizeDraft(d);await save(d);R.stack.pop();render();toast('Observation saved');},
  cancelDraft:()=>{const d=draft();if(d)(d._new||[]).forEach(dropImage);if(cur().name==='sigil'){SG.buf=null;SG.hist=[];}back();},
  editSwatch:t=>{const p=S.settings.palette.find(x=>x.id===t.dataset.id);if(!p)return;
    colorSheet('Colour',p,async v=>{const changed=v.color!==p.color;p.name=v.name||p.name;p.color=v.color;await saveSettings();
      if(changed)for(const e of all('entry'))if(e.colorId===p.id){e.color=p.color;await save(e);}render();},
     {onDelete:()=>confirmSheet(`Delete “${p.name}” from your palette? Entries keep their colour.`,'Delete colour',async()=>{S.settings.palette=S.settings.palette.filter(x=>x!==p);await saveSettings();for(const e of all('entry'))if(e.colorId===p.id){e.colorId=null;await save(e);}render();})});},
  togMore:()=>{const d=draft();d._more=!d._more;render();},
  pickColor:t=>{const d=draft();const p=(S.settings.palette||[]).find(x=>x.id===t.dataset.id);if(!p)return;if(d.colorId===p.id||(!d.colorId&&d.color===p.color)){d.color=null;d.colorId=null;}else{d.color=p.color;d.colorId=p.id;}render();},
  clearColor:()=>{const d=draft();d.color=null;d.colorId=null;render();},
  addPaletteColor:()=>colorSheet('New colour',{name:'',color:'#c9a0dc'},async p=>{const x={id:uid(),name:p.name||'Colour',color:p.color};S.settings.palette.push(x);await saveSettings();const d=draft();if(d&&'color' in d){d.color=x.color;d.colorId=x.id;}render();}),
  pickKind:()=>{const ks=['note','mind','sign','dream','ritual','photo'];sheet(ks.map(k=>({label:KINDS[k].label,fn:()=>{draft().kind=k;render();}})),'Kind of entry');},
  tog:t=>{const d=draft(),f=t.dataset.f,v=t.dataset.v;const a=d[f]=d[f]||[];const i=a.indexOf(v);i>=0?a.splice(i,1):a.push(v);render();},
  dset:t=>{const d=draft();let v=t.dataset.v;if(t.dataset.num)v=+v;setPath(d,t.dataset.f,v);render();},
  newCatInline:()=>inputSheet('New category','',async n=>{const c=await quickCreate('category',n);draft().categoryIds.push(c.id);render();},{ph:'e.g. Germany',btn:'Create'}),
  newStateInline:()=>inputSheet('New state','',async n=>{const s=await quickCreate('state',n);draft().stateIds.push(s.id);render();},{ph:'e.g. Magnetic',btn:'Create'}),
  pickThreads:()=>{const d=draft();pickSheet('Add to thread',threadsByRelevance().map(t=>({id:t.id,label:t.name,color:t.color})),d.threadIds,true,ids=>{d.threadIds=ids;render();},{label:'New thread',fn:()=>inputSheet('New thread','',async n=>{const t=await quickCreate('thread',n);d.threadIds.push(t.id);render();},{ph:'e.g. Germany',btn:'Create'})});},
  pickOne:t=>{const d=draft(),f=t.dataset.f,type=t.dataset.type;const items=(type==='thread'?threadsByRelevance():type==='ritual'?ordered('ritual'):all(type)).map(x=>({id:x.id,label:x.name||x.title,color:x.color}));
    pickSheet(t.dataset.title||'Choose',items,[d[f]],false,ids=>{d[f]=ids[0]||null;render();});},
  pickSigil:()=>{const d=draft();const items=all('sigil').map(s=>({id:s.id,label:s.name||'Untitled sigil'}));
    pickSheet('Sigil',items,[d.sigilId],false,ids=>{d.sigilId=ids[0]||null;render();},{label:'Draw a new sigil',fn:()=>{const extra={};if(d.type==='intention')extra.intentionId=S.items.has(d.id)?d.id:null;if(d.type==='ritual')extra.ritualId=S.items.has(d.id)?d.id:null;NEW.sigil(extra);cur().params.returnTo='sigilId';}});},
  bodyView:t=>{const b=draft().body;if(b.view!==t.dataset.v){b.view=t.dataset.v;b.region=null;b.side=null;b.sensation=null;}render();},
  bodyRegion:t=>{const d=draft(),b=d.body;const r=t.dataset.r||null,side=t.dataset.side||null;if(r&&(r!==b.region||side!==b.side)){d._anim=true;BODY_SCROLL=0;if(b.region)b.sensation=null;}b.region=r;b.side=side;if(!r)b.sensation=null;render();},
  bodySens:t=>{const b=draft().body;b.sensation=b.sensation===t.dataset.v?null:t.dataset.v;render();},
  addSens:()=>inputSheet('New sensation','',async v=>{if(!S.settings.sensations.includes(v))S.settings.sensations.push(v);await saveSettings();draft().body.sensation=v;render();},{ph:'e.g. Pulsing',btn:'Add'}),
  addSystem:()=>inputSheet('New system','',async v=>{if(!S.settings.systems.includes(v))S.settings.systems.push(v);await saveSettings();draft().body.region=v;render();},{ph:'e.g. Cycle',btn:'Add'}),
  threadSort:t=>{TS.sort=t.dataset.v;render();},
  editThread:t=>go('threadEdit',{draft:clone(get(t.dataset.id))}),
  saveThread:async()=>{const d=draft();if(!(d.name||'').trim()){toast('Give the thread a title.');return;}d.name=d.name.trim();finalizeDraft(d);await save(d);R.stack.pop();render();toast('Saved');},
  delThread:t=>{const id=t.dataset.id;confirmSheet('Delete this thread? Its entries stay in your archive.','Delete thread',async()=>{const th=get(id);dropImage(th&&th.coverId);for(const e of all('entry'))if((e.threadIds||[]).includes(id)){e.threadIds=e.threadIds.filter(x=>x!==id);await save(e);}for(const x of[...all('ritual'),...all('intention'),...all('sigil')])if(x.threadId===id){x.threadId=null;await save(x);}await removeItem(id);tab('threads');toast('Thread deleted');});},
  newInThread:t=>{const id=t.dataset.id;sheet([{label:'Entry',fn:()=>openEntry('note',{threadIds:[id]})},{label:'Photo',fn:()=>openEntry('photo',{threadIds:[id]},true)},{label:'Body observation',fn:()=>newBody({threadIds:[id]})}],'Add to this thread');},
  threadPhoto:t=>{const {t:tid,e:eid,p}=t.dataset;sheet([{label:'Open entry',fn:()=>go('entry',{id:eid})},{label:'Set as thread cover',fn:async()=>{const th=get(tid);const nid=await copyImage(p);if(!nid)return;const old=th.coverId;th.coverId=nid;await save(th);dropImage(old);render();toast('Cover updated');}}]);},
  archFilter:t=>{AS.filter=t.dataset.f;render();},
  archOracle:()=>{AS.filter='oracle';tab('archive');},
  editMeta:t=>go('metaEdit',{draft:clone(get(t.dataset.id))}),
  saveMeta:async()=>{const d=draft();if(!(d.name||'').trim()){toast('Give it a name.');return;}d.name=d.name.trim();finalizeDraft(d);await save(d);R.stack.pop();render();toast('Saved');},
  delMeta:t=>{const x=get(t.dataset.id);if(!x||x.id===OTHER_CATEGORY_ID)return;const f=x.type==='state'?'stateIds':'categoryIds';confirmSheet(`Delete “${x.name}”? Entries keep everything else.`,'Delete',async()=>{dropImage(x.imageId);for(const e of all('entry'))if((e[f]||[]).includes(x.id)){e[f]=e[f].filter(i=>i!==x.id);await save(e);}S.settings.radial=S.settings.radial.filter(r=>r.action!=='cat:'+x.id);await saveSettings();await removeItem(x.id);back();});},
  setS:async t=>{S.settings[t.dataset.k]=t.dataset.v;applyTheme();await saveSettings();render();},
  togMod:async t=>{const m=S.settings.home.find(x=>x.type===t.dataset.id);m.on=!m.on;await saveSettings();render();},
  togRadial:async t=>{const r=S.settings.radial.find(x=>x.id===t.dataset.id);if(!r.on&&S.settings.radial.filter(x=>x.on).length>=8){toast('The + menu holds up to 8. Switch one off first.');return;}r.on=!r.on;await saveSettings();render();},
  radialItem:t=>{const r=S.settings.radial.find(x=>x.id===t.dataset.id);sheet([{label:'Rename',fn:()=>inputSheet('Rename',r.label,async v=>{r.label=v;await saveSettings();render();})},{label:'Remove from + menu',danger:true,fn:async()=>{S.settings.radial=S.settings.radial.filter(x=>x!==r);await saveSettings();render();}}],r.label);},
  addRadial:()=>{const have=new Set(S.settings.radial.map(r=>r.action));const opts=[...RADIAL_TYPES.map(x=>({id:x.action,label:x.label})),...ordered('category').map(c=>({id:'cat:'+c.id,label:c.name,color:c.color}))].filter(o=>!have.has(o.id));
    pickSheet('Add to + menu',opts,[],false,async ids=>{const o=opts.find(x=>x.id===ids[0]);if(!o)return;const on=S.settings.radial.filter(x=>x.on).length<8;S.settings.radial.push({id:uid(),action:o.id,label:o.label,on});await saveSettings();render();if(!on)toast('Added. Switch another off to show it.');});},
  delListS:t=>{const k=t.dataset.k,i=+t.dataset.i;const v=S.settings[k][i];sheet([{label:`Remove “${v}”`,danger:true,fn:async()=>{S.settings[k].splice(i,1);await saveSettings();render();}}]);},
  addListS:t=>{const k=t.dataset.k;inputSheet({sensations:'New sensation',systems:'New system',moments:'New moment',situations:'New situation'}[k]||'Add','',async v=>{if(!S.settings[k].includes(v))S.settings[k].push(v);await saveSettings();render();},{btn:'Add'});},
  ritFilter:t=>{RS.f=t.dataset.f;render();},
  prayFilter:t=>{PS.f=t.dataset.f;render();},
  ritualDone:async t=>{const r=get(t.dataset.id);const e=newEntryDraft('ritual',{ritualId:r.id,threadIds:r.threadIds||[],intentionId:r.intentionId||null,color:r.color||null,colorId:r.colorId||null});const rc=ordered('category').find(c=>c.name.toLowerCase()==='ritual');if(rc)e.categoryIds=[rc.id];await save(e);r.lastPerformedAt=Date.now();await save(r);render();toast('Added to today');},
  editRitual:t=>{const d=clone(get(t.dataset.id));normRitual(d);go('ritualEdit',{draft:d});},
  saveRitual:async()=>{const d=draft();if(!(d.name||'').trim()){toast('Give the ritual a name.');return;}d.name=d.name.trim();
    d.steps=(d.steps||[]).filter(s=>s.text.trim()||s.imageId||s.note||s.prayerId||s.productId);d.objects=(d.objects||[]).filter(o=>o.name.trim());d.products=(d.products||[]).filter(p=>p.name||p.imageId||p.url);
    const isNew=!S.items.has(d.id);d.purpose=d.intention||d.purpose||'';d.threadId=(d.threadIds||[])[0]||null;delete d.sample;finalizeDraft(d);await save(d);R.stack.pop();
    if(isNew)R.stack.push({name:'ritual',params:{id:d.id}});render();toast('Saved');},
  delRitual:t=>{const id=t.dataset.id;confirmSheet('Delete this ritual? Times you did it stay in your archive.','Delete ritual',async()=>{const r=get(id);dropImage(r.imageId);(r.visualIds||[]).forEach(dropImage);(r.steps||[]).forEach(s=>dropImage(s.imageId));(r.products||[]).forEach(p=>dropImage(p.imageId));
    for(const x of[...all('intention'),...all('sigil')])if(x.ritualId===id){x.ritualId=null;await save(x);}if(isTonight('ritual',id)){S.settings.tonight=null;await saveSettings();}await removeItem(id);R.stack.splice(-2);render();});},
  togSit:t=>{const d=draft(),v=t.dataset.v;const a=d.situations=d.situations||[];const i=a.indexOf(v);i>=0?a.splice(i,1):a.push(v);render();},
  sitAll:()=>{draft()._sitAll=true;render();},
  newSit:()=>inputSheet('When is this for?','',v=>{const d=draft();(d.situations=d.situations||[]).includes(v)||d.situations.push(v);render();},{ph:'e.g. When I feel ugly',btn:'Add'}),
  addObject:()=>inputSheet('Something to have ready','',v=>{draft().objects.push({id:uid(),name:v,have:false});render();},{ph:'e.g. Candle, journal, a black dress',btn:'Add'}),
  editObject:t=>{const d=draft(),i=+t.dataset.i,o=d.objects[i];sheet([{label:'Rename',fn:()=>inputSheet('Rename',o.name,v=>{o.name=v;render();})},{label:'Remove',danger:true,fn:()=>{d.objects.splice(i,1);render();}}],o.name);},
  addProduct:()=>{const d=draft();d.products.push(newProduct());go('productEdit',{draft:d,i:d.products.length-1});},
  editProduct:t=>go('productEdit',{draft:draft(),i:+t.dataset.i}),
  doneProduct:t=>{const d=draft(),i=+t.dataset.i,p=d.products[i];if(p&&!p.name&&!p.imageId&&!p.url&&!p.notes)d.products.splice(i,1);back();},
  delProduct:t=>{const d=draft(),i=+t.dataset.i,p=d.products[i];if(p.imageId)(d._drop=d._drop||[]).push(p.imageId);d.steps.forEach(s=>{if(s.productId===p.id)s.productId=null;});d.products.splice(i,1);back();},
  addStep:()=>{const d=draft();d.steps.push(newStep());render();const ins=$$('.stp-t');const last=ins[ins.length-1];if(last)last.focus();},
  editStep:t=>go('stepEdit',{draft:draft(),i:+t.dataset.i}),
  delStep:t=>{const d=draft(),i=+t.dataset.i;const s=d.steps[i];if(s&&s.imageId)(d._drop=d._drop||[]).push(s.imageId);d.steps.splice(i,1);back();},
  togStepCheck:t=>{const s=draft().steps[+t.dataset.i];s.check=!s.check;render();},
  pickStepProduct:t=>{const d=draft(),s=d.steps[+t.dataset.i];pickSheet('Product for this step',d.products.map(p=>({id:p.id,label:p.name||'Untitled product'})),[s.productId],false,ids=>{s.productId=ids[0]||null;render();},{label:'Add a product',fn:()=>{const p=newProduct();d.products.push(p);s.productId=p.id;go('productEdit',{draft:d,i:d.products.length-1});}});},
  pickStepPrayer:t=>{const i=+t.dataset.i,d=draft(),s=d.steps[i];pickSheet('Prayer for this step',all('prayer').sort(byUse).map(p=>({id:p.id,label:p.name,color:p.color})),[s.prayerId],false,ids=>{s.prayerId=ids[0]||null;render();},{label:'Write a new prayer',fn:()=>NEW.prayer({},`steps.${i}.prayerId`)});},
  attachPrayer:()=>{const d=draft();pickSheet('Attach prayers',all('prayer').sort(byUse).map(p=>({id:p.id,label:p.name,color:p.color})),d.prayerIds,true,ids=>{d.prayerIds=ids;render();},{label:'Write a new prayer',fn:()=>NEW.prayer({},'prayerIds')});},
  unlinkPrayer:t=>{const d=draft();d.prayerIds=d.prayerIds.filter(x=>x!==t.dataset.id);render();},
  togFav:async t=>{const x=get(t.dataset.id);x.favourite=!x.favourite;await save(x);render();},
  keepTonight:async t=>{const {kind,id}=t.dataset;S.settings.tonight=isTonight(kind,id)?null:{kind,id};await saveSettings();render();toast(S.settings.tonight?'Kept for tonight':'Removed from tonight');},
  togHave:async t=>{const r=get(t.dataset.id);const x=r[t.dataset.k][+t.dataset.i];x.have=!x.have;await save(r);render();},
  runGo:async t=>{const p=cur().params;stopTimer();p.i=Math.max(-1,p.i+ +t.dataset.d);const r=get(p.id);const n=(r.steps||[]).filter(s=>s.text.trim()||s.imageId).length;if(p.i>=n){r.lastPerformedAt=Date.now();await save(r);}render();},
  runTimer:t=>{if(RUN.end){stopTimer();render();return;}RUN.end=Date.now()+ +t.dataset.m*6e4;RUN.timer=setInterval(tick,500);tick();},
  runExit:()=>{const p=cur().params;const r=get(p.id);const n=(r.steps||[]).filter(s=>s.text.trim()||s.imageId).length;if(p.i>=0&&p.i<n)confirmSheet('Leave this ritual?','Leave',()=>{stopTimer();back();});else{stopTimer();back();}},
  runSave:async()=>{const p=cur().params,r=get(p.id);const note=($('#run-note')||{}).value||'';const e=newEntryDraft('ritual',{ritualId:r.id,text:note.trim(),threadIds:r.threadIds||[],intentionId:r.intentionId||null,color:r.color||null,colorId:r.colorId||null});
    const rc=ordered('category').find(c=>c.name.toLowerCase()==='ritual');if(rc)e.categoryIds=[rc.id];await save(e);back();toast('Saved to your archive');},
  runClose:()=>back(),
  editPrayer:t=>{const d=clone(get(t.dataset.id));normPrayer(d);d._rituals=all('ritual').filter(r=>(r.prayerIds||[]).includes(d.id)).map(r=>r.id);go('prayerEdit',{draft:d});},
  prayerRituals:()=>{const d=draft();pickSheet('Part of rituals',all('ritual').sort(byUse).map(r=>({id:r.id,label:r.name,color:r.color})),d._rituals||[],true,ids=>{d._rituals=ids;render();});},
  savePrayer:async()=>{const p=cur().params,d=p.draft;const text=(d.text||'').trim();if(!(d.name||'').trim()&&!text){toast('Write the prayer first.');return;}
    const isNew=!S.items.has(d.id);d.name=(d.name||'').trim()||text.split('\n')[0].slice(0,60);const want=d._rituals?new Set(d._rituals):null;delete d.sample;finalizeDraft(d);await save(d);
    if(want)for(const r of all('ritual')){const has=(r.prayerIds||[]).includes(d.id);if(has!==want.has(r.id)){r.prayerIds=has?r.prayerIds.filter(x=>x!==d.id):[...(r.prayerIds||[]),d.id];await save(r);}}
    const ret=p.returnTo;R.stack.pop();if(ret){const pd=cur().params.draft;if(pd){if(ret==='prayerIds'){pd.prayerIds=pd.prayerIds||[];pd.prayerIds.includes(d.id)||pd.prayerIds.push(d.id);}else setPath(pd,ret,d.id);}}
    else if(isNew)R.stack.push({name:'prayer',params:{id:d.id}});render();toast('Saved');},
  delPrayer:t=>{const id=t.dataset.id;confirmSheet('Delete this prayer? Rituals keep their other steps.','Delete prayer',async()=>{const x=get(id);dropImage(x.imageId);
    for(const r of all('ritual')){let ch=false;if((r.prayerIds||[]).includes(id)){r.prayerIds=r.prayerIds.filter(y=>y!==id);ch=true;}(r.steps||[]).forEach(s=>{if(s.prayerId===id){s.prayerId=null;ch=true;}});if(ch)await save(r);}
    if(isTonight('prayer',id)){S.settings.tonight=null;await saveSettings();}await removeItem(id);R.stack.splice(-2);render();});},
  needKind:t=>{const p=cur().params;p.kind=t.dataset.v;p.m=null;render();},
  needMoment:t=>{const p=cur().params;p.m=p.m===t.dataset.v?null:t.dataset.v;render();},
  prepareFor:t=>{const v=t.dataset.v;const sit=v?{situations:[v]}:{};t.dataset.kind==='prayer'?NEW.prayer(sit):NEW.ritual(sit);},
  recordSheet:()=>sheet([{label:'A note',fn:()=>openEntry('note')},{label:'A photo or video',fn:()=>openEntry('photo',{},true)},{label:'Something in my body',fn:()=>newBody()},{label:'How I feel',fn:()=>stateLogSheet()}],'Record something'),
  addListItem:t=>{const d=draft(),f=t.dataset.f;d[f]=d[f]||[];d[f].push(t.dataset.obj?{text:'',done:false}:'');render();const ins=$$(`[data-bo^="${f}."]`);const last=ins[ins.length-1];if(last)last.focus();},
  delListItem:t=>{const d=draft();d[t.dataset.f].splice(+t.dataset.i,1);render();},
  editIntention:t=>go('intentionEdit',{draft:clone(get(t.dataset.id))}),
  saveIntention:async()=>{const d=draft();if(!(d.title||'').trim()){toast('Give the intention a title.');return;}d.title=d.title.trim();d.actions=(d.actions||[]).filter(a=>a.text.trim());d.signsToNotice=(d.signsToNotice||[]).filter(s=>s.trim());delete d.sample;finalizeDraft(d);await save(d);if(!S.settings.currentIntentionId){S.settings.currentIntentionId=d.id;await saveSettings();}R.stack.pop();render();toast('Saved');},
  delIntention:t=>{const id=t.dataset.id;confirmSheet('Delete this intention? Linked entries stay in your archive.','Delete intention',async()=>{dropImage(get(id).imageId);if(S.settings.currentIntentionId===id){S.settings.currentIntentionId=null;await saveSettings();}for(const x of[...all('entry'),...all('ritual'),...all('sigil')])if(x.intentionId===id){x.intentionId=null;await save(x);}await removeItem(id);R.stack.splice(-2);render();});},
  togAction:async t=>{const i=get(t.dataset.id);const a=i.actions[+t.dataset.i];a.done=!a.done;await save(i);render();},
  logSign:t=>openEntry('sign',{intentionId:t.dataset.id,threadIds:get(t.dataset.id).threadId?[get(t.dataset.id).threadId]:[]}),
  setCurrent:async t=>{S.settings.currentIntentionId=t.dataset.id;await saveSettings();render();toast('Set as your current intention');},
  sigTool:t=>{SG.tool=t.dataset.v;$$('[data-a="sigTool"]').forEach(b=>b.classList.toggle('ring',b.dataset.v===SG.tool));},
  sigUndo:()=>{if(!SG.hist.length||!SG.cv)return;const prev=SG.hist.pop();const ctx=SG.cv.getContext('2d');if(prev){SG.restore(prev);}else{ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,SG.cv.width,SG.cv.height);ctx.restore();}SG.snap();draft()._dirty=true;},
  sigClear:()=>confirmSheet('Clear the canvas?','Clear',()=>{if(!SG.cv)return;if(SG.buf)SG.hist.push(SG.buf);const ctx=SG.cv.getContext('2d');ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,SG.cv.width,SG.cv.height);ctx.restore();SG.snap();draft()._dirty=true;}),
  saveSigil:async()=>{const p=cur().params,d=p.draft;if(!SG.cv)return;
    if(d._dirty||!d.imageId){const blob=await new Promise(r=>SG.cv.toBlob(r,'image/png'));const nid=uid();await putBlob(nid,blob);if(d.imageId)dropImage(d.imageId);d.imageId=nid;}
    delete d._dirty;if(!(d.name||'').trim())d.name='Sigil '+(all('sigil').length+1);finalizeDraft(d);await save(d);SG.buf=null;SG.hist=[];
    const ret=p.returnTo;R.stack.pop();if(ret){const pd=cur().params.draft;if(pd)pd[ret]=d.id;}render();toast('Sigil saved');},
  delSigil:t=>{const id=t.dataset.id;confirmSheet('Delete this sigil?','Delete sigil',async()=>{dropImage(get(id).imageId);for(const x of[...all('intention'),...all('ritual')])if(x.sigilId===id){x.sigilId=null;await save(x);}await removeItem(id);SG.buf=null;back();});},
  oracleSave:async()=>{const o=oracleReading();await save({id:uid(),type:'oracle',date:Date.now(),...o});render();toast('Saved to today');},
  delReading:t=>confirmSheet('Delete this reading?','Delete',async()=>{await removeItem(t.dataset.id);back();}),
  exportData:()=>exportData(),
  eraseAll:()=>confirmSheet('Erase all Body Oracle data on this device? Christina’s events, journal, threads and categories are kept. This cannot be undone.','Erase Body Oracle data',async()=>{await DB.clear();for(const m of[IMG,VID]){m.forEach(u=>URL.revokeObjectURL(u));m.clear();}await reloadItems();S.settings=defaultSettings();applyTheme();R.tab='home';R.stack=[{name:'onboard',params:{step:1,cats:[]}}];render();}),
  obCat:t=>{const p=cur().params,v=t.dataset.v;const i=p.cats.indexOf(v);i>=0?p.cats.splice(i,1):p.cats.push(v);render();},
  obCustom:()=>inputSheet('Something else','',v=>{const p=cur().params;if(!p.cats.includes(v))p.cats.push(v);render();},{ph:'e.g. Sleep, Home, Germany',btn:'Add'}),
  obStep:t=>{cur().params.step=+t.dataset.v;render();},
  obEnter:async()=>{await seed(cur().params.cats);R.stack=[];R.tab='home';render();},
};

/* ================= backup ================= */
function blobToDataURL(b){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(b);});}
function dataURLToBlob(u){const [h,d]=u.split(',');const mime=(/data:([^;]+)/.exec(h)||[])[1]||'application/octet-stream';const bin=atob(d);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:mime});}
async function exportData(){toast('Preparing backup…');try{const blobs={};for(const [k,b] of await DB.allBlobs())if(b)blobs[k]=await blobToDataURL(b);
  const json=JSON.stringify({app:'body-oracle',version:1,exportedAt:Date.now(),settings:S.settings,items:[...S.items.values()],blobs});
  const name=`body-oracle-backup-${dkey(Date.now())}.json`;const file=new File([json],name,{type:'application/json'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:'Body Oracle backup'});return;}catch(e){if(e&&e.name==='AbortError')return;}}
  const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);}
  catch(e){toast('Export did not work in this window. Open the app from your Home Screen and try again.');}}
async function importData(f){if(!f)return;let backup;try{backup=JSON.parse(await f.text());if(backup.app!=='body-oracle'||!Array.isArray(backup.items))throw 0;}catch(e){toast('That file is not a Body Oracle backup.');return;}
  confirmSheet(`Bring in ${plural(backup.items.filter(x=>x.type==='entry').length,'entry','entries')} from this Body Oracle backup? Body Oracle data here now is replaced. Christina’s events, journal, threads and categories are kept.`,'Restore backup',async()=>{
    toast('Restoring…');
    await DB.clear();for(const m of[IMG,VID]){m.forEach(u=>URL.revokeObjectURL(u));m.clear();}
    /* Categories and threads are shared with Christina: ones with an existing name are merged (store.js). */
    const {items:merged,fixCategory:fix}=mergeShared(backup.items);
    for(const x of merged){if(x.type==='settings')continue;await DB.put(x);}
    S.settings=Object.assign(defaultSettings(),{v:1},backup.settings||{},{id:'settings',type:'settings'});
    (S.settings.radial||[]).forEach(r=>{if(r.action&&r.action.startsWith('cat:'))r.action='cat:'+fix(r.action.slice(4));});
    migrateSettings(S.settings);await saveSettings();
    for(const [k,u] of Object.entries(backup.blobs||{}))await putBlob(k,dataURLToBlob(u));
    await reloadItems();await normalizeItems();applyTheme();R.stack=[];R.tab='home';render();toast('Backup restored');});}

/* ================= theme & boot ================= */
/* v3: Home and + menu move to the ritual-library layout; entries, images and lists are untouched. */
async function normalizeItems(){for(const x of S.items.values()){if((x.type==='ritual'&&normRitual(x))||(x.type==='prayer'&&normPrayer(x)))await save(x);}}
function migrateSettings(s){const d=defaultSettings();const ver=s.v||1;for(const k in d)if(s[k]===undefined)s[k]=d[k];
  if(ver<3){s.home=d.home;s.radial=d.radial;s.v=3;saveSettings();}
  const have=new Set(s.home.map(m=>m.type));HOME_DEFAULT.forEach(t=>{if(!have.has(t))s.home.push({type:t,on:false});});}

/* ================= theme ================= */
/* The default accent follows Christina's text colour; any other choice tints Body Oracle's controls. */
function applyTheme(){const s=S.settings,r=document.documentElement;const def=!s.accent||s.accent.toLowerCase()==='#f2f2f3';
  if(def){r.style.removeProperty('--bo-accent');r.style.removeProperty('--bo-accent-ink');}
  else{r.style.setProperty('--bo-accent',s.accent);r.style.setProperty('--bo-accent-ink',lum(s.accent)>.42?'#0b0b0c':'#fbfbfb');}
  r.dataset.boCards=s.cards;r.dataset.boCorners=s.corners;}

/* ================= inside Christina ================= */
let READY=false,INIT=null,RESYNC=null;
const SUBTABS=[['home','Today'],['rituals','Rituals'],['prayers','Prayers'],['archive','Archive']];
function subnav(){return `<div class="bo-subnav"><div class="segmented" role="tablist" aria-label="Body Oracle">${SUBTABS.map(([t,l])=>`<button class="${R.tab===t?'on':''}" data-a="tab" data-t="${t}" role="tab" aria-selected="${R.tab===t}">${l}</button>`).join('')}</div><button class="bo-plus" data-a="radial" aria-label="Add to Body Oracle">${ico('plus',20)}</button></div>`;}

/** Reloads items from the database, e.g. after Christina changed a shared thread or category. */
async function reloadItems(){const keep=S.settings;S.items.clear();for(const x of await DB.all())S.items.set(x.id,x);const st=S.items.get('settings');S.items.delete('settings');S.settings=st||keep;}
async function resync(){try{await reloadItems();}catch(e){}finally{RESYNC=null;christinaRender();}}

/** Body Oracle's screen as one section of Christina. */
function boRoot(){
  if(!READY){if(!INIT)INIT=boInit().catch(e=>{console.error(e);INIT=null;toast('Body Oracle could not open its data.');});return `<div class="m-bo"><p class="empty">Opening Body Oracle…</p></div>`;}
  if(BODB.synced!==CDB.generation&&!RESYNC)RESYNC=resync();
  const c=cur();const view=V[c.name]||V.home;
  return `<div class="m-bo${view.quiet?' quiet':''}" data-bo-view="${esc(c.name)}">${R.stack.length?'':subnav()}${view.html(c.params||{})}</div>`;}
const boKey=()=>READY?`${R.tab}|${cur().name}|${R.stack.length}`:'loading';
/** Runs after Christina has drawn the page: Body Oracle's per-screen setup (sortable lists, body sheet, video previews). */
function boAfter(){if(!READY||!document.querySelector('#main .m-bo[data-bo-view]'))return;const c=cur();const view=V[c.name]||V.home;view.after&&view.after(c.params||{});watchSneaks();}

/* Journal entries (Christina) that link to this record. */
function journalLinksHTML(id){const js=CData.records.filter(r=>r.kind==='journal'&&(r.linkedRecordIds||[]).includes(id));if(!js.length)return'';
  return `<div class="sec-h mt"><h2 class="sec-t">In your journal</h2></div><div class="list card">${js.map(r=>`<button class="row" data-a="openJournal" data-id="${esc(r.id)}"><span class="row-i">${ico('note',18)}</span><span class="row-m"><span class="row-t">${esc(r.title||(r.text||'').split('\n')[0].slice(0,80)||'Journal entry')}</span><span class="row-s">${fmt.day(r.occurredAt)}</span></span>${ico('chev',16)}</button>`).join('')}</div>`;}

/* Opening a Body Oracle record from elsewhere in Christina (Overview, Calendar, Archive, Journal). */
let PENDING=null;
function openBOEntry(id){if(READY){stopTimer();R.tab='archive';R.stack=[{name:'entry',params:{id}}];}else PENDING=id;openModule('bo');christinaRender();}

/* Each record's list title in Christina, using Body Oracle's own labels (state names, ritual names, places). */
BODB.labelFor=e=>entryLabel(e);
async function refreshTitles(){const changed=[];for(const e of all('entry')){const r=CData.records.find(x=>x.id===e.id);const t=entryLabel(e);if(r&&r.title!==t){r.title=t;changed.push(r);}}
  if(changed.length)await CDB.write(['records'],tx=>changed.forEach(r=>tx.objectStore('records').put(r)));BODB.synced=CDB.generation;}

async function boInit(){
  fileIn=document.createElement('input');fileIn.type='file';fileIn.accept='image/*,video/*';fileIn.hidden=true;fileIn.addEventListener('change',onFile);document.body.append(fileIn);
  for(const x of await DB.all())S.items.set(x.id,x);
  S.settings=S.items.get('settings')||null;S.items.delete('settings');await loadImages();
  if(!S.settings){S.settings=defaultSettings();R.stack=[{name:'onboard',params:{step:1,cats:[]}}];}
  else migrateSettings(S.settings);
  await normalizeItems();applyTheme();await refreshTitles();READY=true;
  if(PENDING){R.tab='archive';R.stack=[{name:'entry',params:{id:PENDING}}];PENDING=null;}
  christinaRender();}

/* Body Oracle's document listeners: its own data-a / data-bo attributes, so they never act on Christina's elements. */
(function bindBO(){
  document.addEventListener('click',e=>{const t=e.target.closest('[data-a]');if(!t)return;const f=A[t.dataset.a];if(f){e.preventDefault();f(t,e);}});
  document.addEventListener('input',e=>{const el=e.target;
    if(el.dataset.bo){const d=draft();if(!d)return;let v=el.value;if(el.type==='datetime-local'){const n=new Date(v).getTime();if(isNaN(n))return;v=n;}setPath(d,el.dataset.bo,v);if(el.dataset.bo==='color')$$('.sw').forEach(s=>s.classList.remove('on'));}
    else if(el.dataset.sbind){S.settings[el.dataset.sbind]=el.value;saveSettingsSoon();}
    else if(el.dataset.scolor){S.settings[el.dataset.scolor]=el.value;applyTheme();saveSettingsSoon();}
    else if(el.id==='arch-q'){AS.q=el.value;$('#arch-res').innerHTML=archResults();watchSneaks();}});
  document.addEventListener('timeupdate',e=>{const v=e.target;if(v.classList&&v.classList.contains('sneak')&&v.currentTime>SNEAK_SECS)v.currentTime=0;},true);
  document.addEventListener('change',e=>{if(e.target.id==='import-file'){importData(e.target.files[0]);e.target.value='';}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#bo-sheet').hidden)closeSheet();else if(!$('#bo-radial').hidden)closeRadial();}});
})();

register({
  nav:{id:'bo',label:'Body Oracle',icon:'body',order:5,
    hideBack:()=>READY&&R.stack.length>0,
    reset:()=>{if(READY&&!(R.stack[0]&&R.stack[0].name==='onboard')){stopTimer();R.stack=[];R.tab='home';}}},
  tabs:{bo:boRoot},
  /* Body Oracle's records, as other sections list and open them */
  kinds:Object.fromEntries(Object.entries(KINDS).map(([k,v])=>[k,{label:v.label,icon:v.icon,open:r=>openBOEntry(r.id)}])),
  tabKeys:{bo:boKey},
  chrome:boAfter,
});
