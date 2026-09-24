(() => {
  const O = window.OxygeNTools;
  const catalog = window.OxygeNToolsCatalog || [];
  const meta = window.OxygeNToolsMeta || {};
  const app = O.$('#app');
  if (!app) return;
  const pathSlug = () => {
    const path = location.pathname.replace(/\/+$/,'');
    const at = path.lastIndexOf('/tools');
    if (at < 0 || path.slice(at, at+6) !== '/tools') return '';
    return path.slice(at+6).replace(/^\//,'').split('/')[0];
  };
  const header = () => `<header class="ot-header"><div class="ot-wrap ot-header-inner"><a class="ot-brand" href="/tools/" aria-label="Inicio de OxygeNTools"><span class="ot-mark" aria-hidden="true">Ox</span><span><span class="ot-brand-name">OxygeNTools</span><span class="ot-brand-sub">Herramientas útiles. Sin complicaciones.</span></span></a><a class="ot-back" href="https://oxygenmedia.online/">← OxygeNMedia</a></div></header>`;
  const footer = () => `<footer class="ot-footer"><div class="ot-wrap ot-footer-inner"><span>OxygeNTools · Una sección de <a href="https://oxygenmedia.online/">OxygeNMedia</a></span><span>Los archivos se procesan en tu dispositivo.</span></div></footer>`;
  const card = tool => `<a class="ot-card" href="/tools/${O.esc(tool.slug)}/" data-search="${O.esc(`${tool.title} ${tool.description} ${tool.tags}`.toLowerCase())}"><span class="ot-card-icon" aria-hidden="true">${tool.icon}</span><h3>${O.esc(tool.title)}</h3><p>${O.esc(tool.description)}</p></a>`;
  function renderHome() {
    document.title = 'OxygeNTools — Herramientas gratuitas | OxygeNMedia';
    document.querySelector('meta[name="description"]')?.setAttribute('content','Herramientas gratuitas de imágenes, documentos, diseño, texto y web. Rápidas, privadas y directas en tu navegador.');
    app.innerHTML = `${header()}<main id="main-content" class="ot-wrap"><section class="ot-hero"><span class="ot-eyebrow">✦ OxygeNMedia · utilidades web</span><h1>Herramientas útiles.<br><span class="ot-hero-accent">Sin complicaciones.</span></h1><p>Pequeñas herramientas para resolver lo de todos los días. Gratis, rápidas y, siempre que es posible, ejecutadas directamente en tu navegador.</p><div class="ot-search-wrap"><span class="ot-search-icon" aria-hidden="true">🔍</span><input class="ot-search" id="tool-search" type="search" placeholder="Buscar herramientas..." aria-label="Buscar herramientas por nombre, descripción o etiquetas" autocomplete="off"></div></section><div class="ot-privacy"><span aria-hidden="true">🔒</span><div><strong>Tu contenido se queda contigo.</strong> Las herramientas de archivos y texto funcionan localmente; no subimos tus imágenes, documentos ni contraseñas.</div></div><section class="ot-categories" id="tool-categories" aria-label="Catálogo de herramientas"></section><div class="ot-empty-results" id="no-results" hidden>No encontramos herramientas con esa búsqueda. Prueba otro nombre o etiqueta.</div></main>${footer()}`;
    const host = O.$('#tool-categories');
    const categoryOrder = ['Imágenes','Documentos','Código y web','Diseño','Utilidades'];
    categoryOrder.forEach(category => {
      const tools = catalog.filter(t => t.category === category);
      const section = document.createElement('section'); section.className='ot-category'; section.dataset.category=category;
      section.innerHTML = `<div class="ot-category-heading"><h2>${category}</h2><span class="ot-count">${tools.length} herramientas</span></div><div class="ot-grid">${tools.map(card).join('')}</div>`;
      host.append(section);
    });
    O.$('#tool-search').addEventListener('input', e => {
      const q=e.currentTarget.value.trim().toLocaleLowerCase('es'); let found=0;
      O.$$('.ot-card',host).forEach(el=>{const yes=el.dataset.search.includes(q);el.hidden=!yes;if(yes)found++;});
      O.$$('.ot-category',host).forEach(sec=>{const any=O.$$('.ot-card',sec).some(el=>!el.hidden);sec.hidden=!any;});
      O.$('#no-results').hidden=found!==0;
    });
  }
  function renderTool(slug) {
    const info=meta[slug];
    if(!info){renderHome();history.replaceState({},'', '/tools/');return;}
    document.title=`${info.title} — OxygeNTools | OxygeNMedia`;
    document.querySelector('meta[name="description"]')?.setAttribute('content',info.description+' Gratis y local en OxygeNTools.');
    document.querySelector('meta[property="og:title"]')?.setAttribute('content',`${info.title} — OxygeNTools | OxygeNMedia`);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content',info.description);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content',`https://oxygenmedia.online/tools/${slug}`);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href',`https://oxygenmedia.online/tools/${slug}`);
    const category=catalog.find(t=>t.slug===slug)?.category || 'Herramientas';
    app.innerHTML=`${header()}<main id="main-content" class="ot-wrap ot-tool-main"><nav class="ot-breadcrumb" aria-label="Ruta de navegación"><a href="/tools/">OxygeNTools</a><span aria-hidden="true">/</span><span>${O.esc(category)}</span></nav><header class="ot-tool-heading"><h1>${O.esc(info.title)}</h1><p>${O.esc(info.description)}</p></header><div id="tool-mount"></div><p class="ot-privacy"><span aria-hidden="true">🔒</span><span>El procesamiento se realiza en este dispositivo. Tus datos y archivos no se envían a OxygeNMedia.</span></p></main>${footer()}`;
    const mount=O.modules[slug];
    if(mount){try{mount(O.$('#tool-mount'));}catch(error){console.error(error);O.$('#tool-mount').innerHTML='<div class="ot-panel"><div class="ot-message error">No se pudo abrir esta herramienta. Recarga la página e inténtalo de nuevo.</div></div>';}}
    else O.$('#tool-mount').innerHTML='<div class="ot-panel"><p>Esta herramienta no está disponible todavía.</p><a class="ot-btn" href="/tools/">Volver al catálogo</a></div>';
  }
  function render() { const slug=pathSlug(); if(!slug){renderHome();return;} renderTool(slug); }
  document.addEventListener('click', e => {
    const a=e.target.closest('a[href]'); if(!a || e.defaultPrevented || e.button!==0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.origin!==location.origin) return;
    const url=new URL(a.href); if(!url.pathname.startsWith('/tools/')) return;
    e.preventDefault(); history.pushState({},'',url.pathname); render(); window.scrollTo({top:0,behavior:'instant'});
  });
  window.addEventListener('popstate',render);
  render();
})();
