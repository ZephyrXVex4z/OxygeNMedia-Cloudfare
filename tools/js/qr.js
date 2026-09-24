(() => {
  const O=window.OxygeNTools;
  O.register('qr',host=>{
    host.innerHTML=`<section class="ot-panel"><div class="ot-fields"><div class="ot-field full"><label for="qr-text">URL o texto</label><textarea class="ot-textarea" id="qr-text" maxlength="2500" placeholder="https://oxygenmedia.online" aria-describedby="qr-hint"></textarea><span class="ot-hint" id="qr-hint">Puedes pegar un enlace, texto o datos de contacto (máximo 2,500 caracteres).</span></div><div class="ot-field"><label for="qr-size">Tamaño de descarga</label><select class="ot-select" id="qr-size"><option>256</option><option selected>512</option><option>768</option><option>1024</option></select></div><div class="ot-field"><label for="qr-margin">Margen (módulos)</label><input class="ot-input" id="qr-margin" type="number" min="0" max="10" value="4"></div><div class="ot-field"><label for="qr-dark">Color del código</label><input class="ot-input" id="qr-dark" type="color" value="#111827"></div><div class="ot-field"><label for="qr-light">Color de fondo</label><input class="ot-input" id="qr-light" type="color" value="#ffffff"></div><div class="ot-field"><label for="qr-style">Estilo de módulos</label><select class="ot-select" id="qr-style"><option value="square">Cuadrado</option><option value="rounded">Redondeado</option><option value="dots">Puntos</option></select></div><div class="ot-field"><label for="qr-logo">Logo central (opcional)</label><input class="ot-input" id="qr-logo" type="file" accept="image/png,image/jpeg,image/webp"></div><div class="ot-field"><label for="qr-logo-size">Tamaño del logo (%)</label><input class="ot-input" id="qr-logo-size" type="range" min="10" max="30" value="18"><span class="ot-hint" id="qr-logo-label">18% del código</span></div></div><div id="qr-warning" class="ot-message error" hidden>El logo ocupa mucho espacio y puede dificultar la lectura. Reduce su tamaño o prueba el QR con varios lectores.</div><div class="ot-preview" id="qr-preview"><span class="ot-hint">Escribe un texto para ver la previsualización.</span></div><div class="ot-actions"><button class="ot-btn primary" id="qr-png" type="button">Descargar PNG</button><button class="ot-btn" id="qr-svg" type="button">Descargar SVG</button><button class="ot-btn ghost" id="qr-clear" type="button">Limpiar</button></div><div class="ot-message" aria-live="polite"></div></section>`;
    const $=s=>O.$(s,host), canvas=document.createElement('canvas'); let matrix=null, logoImg=null, logoUrl=null, lastSvg='';
    const draw=async()=>{
      const text=$('#qr-text').value.trim();$('#qr-logo-label').textContent=`${$('#qr-logo-size').value}% del código`;
      $('#qr-warning').hidden=Number($('#qr-logo-size').value)<=20;
      if(!text){matrix=null;$('#qr-preview').innerHTML='<span class="ot-hint">Escribe un texto para ver la previsualización.</span>';return;}
      try{
        await O.loadScript('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js');
        if(!window.QRCode?.create) throw new Error('No fue posible preparar el código QR.');
        matrix=window.QRCode.create(text,{errorCorrectionLevel:'H'}).modules;
        paint(Number($('#qr-size').value));
      }catch(e){console.error(e);O.msg(host,e.message||'No se pudo generar el QR. Revisa el texto e inténtalo de nuevo.');}
    };
    function paint(targetSize){
      if(!matrix)return;
      const count=matrix.size, margin=Math.max(0,Math.min(10,Number($('#qr-margin').value)||0)), full=count+2*margin, cell=targetSize/full;
      canvas.width=targetSize;canvas.height=targetSize;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;
      const dark=$('#qr-dark').value, light=$('#qr-light').value, style=$('#qr-style').value;ctx.fillStyle=light;ctx.fillRect(0,0,targetSize,targetSize);
      for(let y=0;y<count;y++)for(let x=0;x<count;x++){
        if(!matrix.data[y*count+x])continue;
        const finder=(x<8&&y<8)||(x>=count-8&&y<8)||(x<8&&y>=count-8), px=(x+margin)*cell,py=(y+margin)*cell;ctx.fillStyle=dark;
        if(style==='dots'&&!finder){ctx.beginPath();ctx.arc(px+cell/2,py+cell/2,cell*.43,0,Math.PI*2);ctx.fill();}
        else if(style==='rounded'&&!finder){ctx.beginPath();ctx.roundRect(px+cell*.04,py+cell*.04,cell*.92,cell*.92,cell*.23);ctx.fill();}
        else ctx.fillRect(Math.floor(px),Math.floor(py),Math.ceil(cell),Math.ceil(cell));
      }
      if(logoImg){const side=targetSize*(Number($('#qr-logo-size').value)/100),x=(targetSize-side)/2,r=side*.12;ctx.fillStyle=light;ctx.beginPath();ctx.roundRect(x-side*.07,x-side*.07,side*1.14,side*1.14,r);ctx.fill();ctx.save();ctx.beginPath();ctx.roundRect(x,x,side,side,r);ctx.clip();const ratio=Math.min(side/logoImg.width,side/logoImg.height),w=logoImg.width*ratio,h=logoImg.height*ratio;ctx.drawImage(logoImg,x+(side-w)/2,x+(side-h)/2,w,h);ctx.restore();}
      $('#qr-preview').replaceChildren(canvas);
      const cellSvg=1000/full, pad=margin*cellSvg, svgSize=1000, paths=[];
      for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(matrix.data[y*count+x]){
        const finder=(x<8&&y<8)||(x>=count-8&&y<8)||(x<8&&y>=count-8), px=(x+margin)*cellSvg,py=(y+margin)*cellSvg;
        if(style==='dots'&&!finder)paths.push(`<circle cx="${px+cellSvg/2}" cy="${py+cellSvg/2}" r="${cellSvg*.43}" fill="${dark}"/>`);
        else {const radius=style==='rounded'&&!finder?cellSvg*.23:0;paths.push(`<rect x="${px}" y="${py}" width="${cellSvg+.1}" height="${cellSvg+.1}" rx="${radius}" fill="${dark}"/>`);}
      }
      let logo=''; if(logoImg){try{const c=document.createElement('canvas');c.width=logoImg.naturalWidth||logoImg.width;c.height=logoImg.naturalHeight||logoImg.height;c.getContext('2d').drawImage(logoImg,0,0);const data=c.toDataURL('image/png'),side=svgSize*Number($('#qr-logo-size').value)/100,x=(svgSize-side)/2;logo=`<rect x="${x-side*.07}" y="${x-side*.07}" width="${side*1.14}" height="${side*1.14}" rx="${side*.12}" fill="${light}"/><image href="${data}" x="${x}" y="${x}" width="${side}" height="${side}" preserveAspectRatio="xMidYMid meet"/>`; }catch(err){console.error(err);}}
      lastSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="${targetSize}" height="${targetSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${light}"/>${paths.join('')}${logo}</svg>`;
      O.clearMsg(host);
    }
    host.addEventListener('input',e=>{if(e.target.matches('#qr-text,#qr-margin,#qr-size,#qr-dark,#qr-light,#qr-style,#qr-logo-size'))draw();});
    $('#qr-logo').addEventListener('change',async e=>{if(logoUrl)URL.revokeObjectURL(logoUrl);logoImg=null;const f=e.target.files?.[0];if(f){try{const r=await O.imageFromFile(f);logoImg=r.img;logoUrl=r.url;draw();}catch(err){O.msg(host,err.message);}}else draw();});
    $('#qr-png').addEventListener('click',async()=>{await draw();if(!matrix)return O.msg(host,'Escribe un texto antes de descargar.');canvas.toBlob(b=>{if(b)O.download(b,'oxygetools-qr.png');else O.msg(host,'No se pudo crear el PNG.');},'image/png');});
    $('#qr-svg').addEventListener('click',async()=>{await draw();if(!matrix)return O.msg(host,'Escribe un texto antes de descargar.');O.download(new Blob([lastSvg],{type:'image/svg+xml'}),'oxygetools-qr.svg');});
    $('#qr-clear').addEventListener('click',()=>{$('#qr-text').value='';$('#qr-logo').value='';logoImg=null;if(logoUrl)URL.revokeObjectURL(logoUrl);logoUrl=null;draw();O.clearMsg(host);});
    draw();
  });
})();
