/* Archivo variable-type study. Independent of the existing navigation clock. */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const pointer={x:-9999,y:-9999,inside:false};
  const measured=new WeakMap();
  let targets=[],raf=0,measureFrame=0,last=0,busy=false,ready=false,pulse=null;
  let metricsDirty=false,viewportWidth=innerWidth;
  const clamp=n=>Math.max(0,Math.min(1,n));
  const profiles={name:{width:125,weight:290,radius:150},title:{width:124,weight:280,radius:175},index:{width:108,weight:320,radius:90}};

  function enhance(element,kind){
    if(!element || element.classList.contains('vt-target'))return;
    const label=element.textContent.replace(/\s+/g,' ').trim();
    const control=kind==='index'?element.closest('a'):element;
    control?.setAttribute('aria-label',label);
    element.querySelectorAll('a').forEach(a=>a.setAttribute('aria-label',a.textContent.trim()));
    element.classList.add('vt-target');element.dataset.vtKind=kind;
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      if(!node.nodeValue.trim())continue;
      const fragment=document.createDocumentFragment();
      for(const token of node.nodeValue.split(/(\s+)/)){
        if(!token)continue;
        if(/^\s+$/.test(token)){fragment.append(document.createTextNode(token));continue;}
        const word=document.createElement('span');word.className='vt-word';
        for(const char of Array.from(token)){
          const cell=document.createElement('span'),glyph=document.createElement('span');
          cell.className='vt-cell';glyph.className='vt-glyph';glyph.textContent=char;
          cell.append(glyph);word.append(cell);
        }
        fragment.append(word);
      }
      node.replaceWith(fragment);
    }
  }
  function paint(c,width='',weight='',transform=''){
    if(c.paintedWidth!==width){
      if(width)c.glyph.style.setProperty('--vt-width',width);else c.glyph.style.removeProperty('--vt-width');
      c.paintedWidth=width;
    }
    if(c.paintedWeight!==weight){
      if(weight)c.glyph.style.setProperty('--vt-weight',weight);else c.glyph.style.removeProperty('--vt-weight');
      c.paintedWeight=weight;
    }
    if(c.paintedTransform!==transform){c.cell.style.transform=transform;c.paintedTransform=transform;}
  }
  function resetTarget(t){
    if(t.active)t.el.removeAttribute('data-vt-active');
    t.active=t.moving=false;
    for(const c of t.chars){c.value=0;paint(c);}
  }
  function reset(){
    cancelAnimationFrame(raf);raf=0;last=0;
    for(const t of targets)resetTarget(t);
  }
  function updatePositions(){
    // Scrolling moves a target, not its glyphs relative to each other. Read one
    // box per target without clearing widths or changing variable font axes.
    for(const t of targets){
      const box=t.el.getBoundingClientRect();
      t.left=box.left;t.top=box.top;
      for(const c of t.chars){c.x=box.left+c.localX;c.y=box.top+c.localY;}
    }
  }
  function measure(force=false){
    const pending=[];
    targets=[...document.querySelectorAll('.vt-target')].filter(el=>el.getBoundingClientRect().width).map(el=>{
      let t=measured.get(el);
      if(!t){
        const kind=el.dataset.vtKind,profile=profiles[kind];
        const base=Number(getComputedStyle(el).getPropertyValue('--vt-base-weight'))||460;
        const chars=[...el.querySelectorAll('.vt-cell')].map(cell=>({cell,glyph:cell.firstElementChild,value:0,
          paintedWidth:'',paintedWeight:'',paintedTransform:''}));
        t={el,kind,profile,base,chars,rows:[],active:false,moving:false};
        measured.set(el,t);pending.push(t);
      }else if(force)pending.push(t);
      return t;
    });
    // Batch each write/read phase across all new or resized targets. Persistent
    // index labels keep their measured native width when only main is replaced.
    for(const t of pending){resetTarget(t);for(const c of t.chars)c.cell.style.width='';}
    for(const t of pending)for(const c of t.chars)c.base=c.glyph.getBoundingClientRect().width;
    for(const t of pending)for(const c of t.chars){
      c.cell.style.width=`${c.base}px`;
      paint(c,`${t.profile.width}%`,String(t.profile.weight));
    }
    for(const t of pending)for(const c of t.chars)c.growth=Math.max(0,c.glyph.getBoundingClientRect().width-c.base);
    for(const t of pending)for(const c of t.chars)paint(c);
    for(const t of pending){
      const box=t.el.getBoundingClientRect(),boundary=t.kind==='index'?t.el.closest('li'):t.el;
      const bounds=boundary.getBoundingClientRect(),css=getComputedStyle(boundary);
      const right=bounds.right-(parseFloat(css.paddingRight)||0)-3,rows=[];
      t.minX=t.minY=Infinity;t.maxX=t.maxY=-Infinity;
      for(const c of t.chars){
        const b=c.cell.getBoundingClientRect();c.x=b.left+b.width/2;c.y=b.top+b.height/2;
        c.localX=c.x-box.left;c.localY=c.y-box.top;
        t.minX=Math.min(t.minX,c.localX);t.maxX=Math.max(t.maxX,c.localX);
        t.minY=Math.min(t.minY,c.localY);t.maxY=Math.max(t.maxY,c.localY);
        let row=rows.find(row=>Math.abs(row.y-c.y)<3);
        if(!row){row={y:c.y,chars:[],right:0,room:0};rows.push(row);}
        row.chars.push(c);row.right=Math.max(row.right,b.right);
      }
      for(const row of rows)row.room=Math.max(0,right-row.right);
      t.rows=rows;
    }
    updatePositions();metricsDirty=false;
  }
  function mount(initial=false){
    if(!ready)return;
    if(initial){
      enhance(document.querySelector('.site-nav bodycopy>h1:first-child'),'name');
      enhance(document.querySelector('.mobile-header>a'),'name');
      document.querySelectorAll('.site-nav .project-link .nav-title').forEach(el=>enhance(el,'index'));
    }
    document.querySelectorAll('main [data-project-title]').forEach(el=>enhance(el,'title'));
    measure(metricsDirty);
  }
  function schedulePositions(){
    if(measureFrame)return;
    measureFrame=requestAnimationFrame(()=>{
      measureFrame=0;
      if(!ready||busy)return;
      if(metricsDirty)measure(true);else updatePositions();
      wake();
    });
  }
  function resume(){
    busy=false;pointer.inside=false;last=0;
    // Cancel and its paired navigationend share this frame; neither remounts
    // the retained title nor repeats the arrival's geometry preparation.
    schedulePositions();
  }
  function wake(){if(ready&&!busy&&!reduced.matches&&!document.hidden&&!raf)raf=requestAnimationFrame(tick);}
  function tick(now){
    raf=0;
    if(busy||reduced.matches||document.hidden)return;
    const dt=last?Math.min(40,now-last):16.7;last=now;
    const ease=1-Math.exp(-dt/78);let unsettled=false;
    if(pulse&&now>pulse.until)pulse=null;
    for(const t of targets){
      const radius=t.profile.radius;
      const near=pointer.inside&&pointer.x>=t.left+t.minX-radius&&pointer.x<=t.left+t.maxX+radius&&
        pointer.y>=t.top+t.minY-radius&&pointer.y<=t.top+t.maxY+radius;
      if(!near&&!t.moving&&pulse?.element!==t.el)continue;
      let active=false,moving=false;
      for(const row of t.rows){
        let growth=0;
        for(const c of row.chars){
          const distance=pointer.inside?Math.hypot(pointer.x-c.x,(pointer.y-c.y)*1.4):Infinity;
          let desired=clamp(1-distance/t.profile.radius);desired=desired*desired*(3-2*desired);
          if(pulse?.element===t.el)desired=Math.max(desired,.85);
          c.value+=(desired-c.value)*ease;
          if(Math.abs(desired-c.value)<.002)c.value=desired;else unsettled=true;
          growth+=c.growth*c.value;moving=moving||c.value>0;
        }
        const fit=growth>0?Math.min(1,row.room/growth):1;let offset=0;
        for(const c of row.chars){
          const value=c.value*fit;active=active||c.value>.015;
          paint(c,value?`${(100+(t.profile.width-100)*value).toFixed(2)}%`:'',
            c.value?(t.base+(t.profile.weight-t.base)*c.value).toFixed(1):'',
            offset>.01?`translateX(${offset.toFixed(2)}px)`:'');
          offset+=c.growth*value;
        }
      }
      if(t.active!==active){t.el.toggleAttribute('data-vt-active',active);t.active=active;}
      t.moving=moving;
    }
    if(unsettled||pulse)raf=requestAnimationFrame(tick);else last=0;
  }
  addEventListener('pointermove',event=>{
    if(event.pointerType==='touch')return;
    pointer.x=event.clientX;pointer.y=event.clientY;pointer.inside=true;wake();
  },{passive:true});
  document.addEventListener('pointerleave',()=>{pointer.inside=false;wake();});
  document.addEventListener('pointerdown',event=>{
    const heading=event.target.closest('.vt-target[data-vt-kind="title"]');
    if(heading&&event.pointerType==='touch'){pulse={element:heading,until:performance.now()+550};wake();}
  },{passive:true});
  document.addEventListener('navigationstart',()=>{busy=true;pulse=null;reset();});
  document.addEventListener('navigationcommit',()=>mount());
  document.addEventListener('navigationend',resume);
  document.addEventListener('navigationcancel',()=>{pulse=null;resume();});
  document.addEventListener('navigationerror',()=>{reset();resume();});
  addEventListener('resize',()=>{
    if(innerWidth!==viewportWidth){viewportWidth=innerWidth;metricsDirty=true;}
    schedulePositions();
  },{passive:true});
  document.addEventListener('scroll',schedulePositions,{passive:true,capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pointer.inside=false;reset();}else schedulePositions();});
  reduced.addEventListener('change',()=>{reset();metricsDirty=true;schedulePositions();});
  document.fonts.load('460 28px "Archivo Study"').then(()=>{ready=true;mount(true);}).catch(()=>{});
})();
