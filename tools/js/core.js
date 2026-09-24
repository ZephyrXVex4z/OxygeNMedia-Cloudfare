(() => {
  const modules = {};
  const cache = {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const bytes = n => { if (!Number.isFinite(n)) return '—'; const units = ['B','KB','MB','GB']; let i=0; while(n>=1024&&i<units.length-1){n/=1024;i++;} return `${n.toFixed(i?1:0)} ${units[i]}`; };
  const download = (blob, name) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=name; a.hidden=true; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 1500); };
  const loadScript = src => cache[src] || (cache[src] = new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>resolve();s.onerror=()=>{delete cache[src];reject(new Error('No se pudo cargar el componente necesario. Comprueba tu conexión e inténtalo de nuevo.'));};document.head.append(s);}));
  const msg = (host, text, kind='error') => { const el=$('.ot-message',host); if(el){el.className=`ot-message ${kind}`;el.textContent=text;} };
  const clearMsg = host => { const el=$('.ot-message',host); if(el){el.className='ot-message';el.textContent='';} };
  const imageFromFile = file => new Promise((resolve,reject)=>{if(/\.svgz?$/i.test(file.name)||file.type==='image/svg+xml'){reject(new Error('Por seguridad, usa una imagen rasterizada como PNG, JPG, WebP, GIF, BMP o AVIF.'));return;}if(file.type&&!file.type.startsWith('image/')){reject(new Error('Selecciona un archivo de imagen válido.'));return;}const url=URL.createObjectURL(file), img=new Image();img.onload=()=>resolve({img,url});img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('No se pudo abrir esta imagen. Comprueba que el archivo sea válido.'));};img.src=url;});
  const canvasBlob = (canvas,type,quality) => new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('El navegador no pudo crear el archivo de salida.')),type,quality));
  const safeFilename = (s, fallback='archivo') => (String(s||fallback).replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,70)||fallback);
  const register = (slug, mount) => { modules[slug]=mount; };
  window.OxygeNTools = { $, $$, esc, bytes, download, loadScript, msg, clearMsg, imageFromFile, canvasBlob, safeFilename, register, modules };
})();
