/* Keep the index and its particle surface alive while replacing project content. */
(() => {
  'use strict';
  const nav=document.querySelector('.site-nav'), root=document.documentElement;
  if(!nav || !window.SongDongPage || !document.querySelector('main .home-page, main [data-project-title]')) return;
  const path=value=>{
    let pathname=new URL(value,location.href).pathname;
    // Hosting may encode punctuation in redirects (Sugar's commas become %2C).
    // Compare decoded paths so the same project keeps its in-document flight.
    try {pathname=decodeURIComponent(pathname);} catch (_) {}
    return pathname.replace(/\/index\.html$/,'/').replace(/\/$/,'');
  };
  const event=(name,url,extra={})=>document.dispatchEvent(new CustomEvent(name,{detail:{url,...extra}}));
  const cache=new Map();
  let revision=0, controller=null, displayedURL=location.href, scrollFrame=0, committing=false, pendingNavigation=null;
  function cancelNavigation(reason) {
    if(!pendingNavigation) return;
    const url=pendingNavigation;pendingNavigation=null;
    const detail={cancelled:true,reason,destination:displayedURL};
    event('navigationcancel',url,detail);
    // Existing consumers finish their busy state on navigationend.
    event('navigationend',url,detail);
  }
  const resolve=(value,base)=>{try{return new URL(value,base).href;}catch(_){return value;}};
  function resolveContent(container,base) {
    for(const el of [container,...container.querySelectorAll('*')]) {
      for(const name of ['href','src','poster','data-original','data-loop-src']) {
        const value=el.getAttribute(name);
        if(value && !value.startsWith('#')) el.setAttribute(name,resolve(value,base));
      }
      const srcset=el.getAttribute('srcset');
      if(srcset && !srcset.trim().startsWith('data:')) el.setAttribute('srcset',srcset.split(',').map(part=>{
        const [url,...descriptor]=part.trim().split(/\s+/);return [resolve(url,base),...descriptor].join(' ');
      }).join(', '));
      const style=el.getAttribute('style');
      if(style?.includes('url(')) el.setAttribute('style',style.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g,(_,q,url)=>`url("${resolve(url,base).replace(/"/g,'%22')}")`));
    }
  }
  resolveContent(nav,displayedURL);
  const mobileHeader=document.querySelector('.mobile-header');
  if(mobileHeader) resolveContent(mobileHeader,displayedURL);
  const projectPaths=new Set([...nav.querySelectorAll('.project-link')].map(link=>path(link.href)));
  const projectURL=url=>url.origin===location.origin && projectPaths.has(path(url.href));
  const sameDocument=(url,previous=displayedURL)=>{
    const current=new URL(previous);
    return url.origin===current.origin && path(url.href)===path(current.href) && url.search===current.search;
  };
  const savedScroll=(url,state)=>{
    const saved=state?.__songdongProject;
    return saved?.url===url.href && Number.isFinite(saved.scrollY) && saved.scrollY>=0 ? saved.scrollY : null;
  };
  function scrollToLocation(url,position=null) {
    if(position!==null) {window.scrollTo({top:position,left:0,behavior:'instant'});return;}
    let id=url.hash.slice(1);
    try {id=decodeURIComponent(id);} catch (_) {}
    const target=id && document.getElementById(id);
    if(target) target.scrollIntoView({block:'start',behavior:'instant'});
    else window.scrollTo({top:0,left:0,behavior:'instant'});
  }
  function rememberScroll() {
    if(committing || location.href!==displayedURL) return;
    const state=history.state && typeof history.state==='object' ? history.state : {};
    history.replaceState({...state,__songdongProject:{url:displayedURL,scrollY}},'',displayedURL);
  }
  rememberScroll();
  history.scrollRestoration='manual';
  addEventListener('scroll',()=>{
    if(scrollFrame) return;
    scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;rememberScroll();});
  },{passive:true});
  function navigateWithinPage(url,{pop=false,state=null,keyboard=false}={}) {
    // Fragment history belongs to the current document: keep its media and
    // reading controls mounted instead of fetching/replacing the project.
    const version=++revision;controller?.abort();controller=null;
    cancelNavigation('within-page');
    window.SongDongTitleParticles?.cancel();
    nav.removeAttribute('aria-busy');
    window.SongDongNavigationUI?.closeMenu();
    window.SongDongNavigationUI?.sync(url.href);
    if(!pop) rememberScroll();
    committing=true;
    if(!pop && location.href!==url.href) history.pushState({},'',url.href);
    displayedURL=url.href;
    const position=pop?savedScroll(url,state):null;
    const restore=()=>{
      if(version!==revision || location.href!==url.href) return;
      scrollToLocation(url,position);
      if(keyboard && url.hash) {
        let id=url.hash.slice(1);
        try {id=decodeURIComponent(id);} catch (_) {}
        const target=document.getElementById(id);
        if(target) {if(!target.hasAttribute('tabindex')) target.tabIndex=-1;target.focus({preventScroll:true});}
      }
      committing=false;
      rememberScroll();
    };
    // A browser can apply persisted scroll/fragment state after dispatching
    // popstate. Restore after that traversal task, and ignore its transient
    // scroll events so they cannot overwrite the saved destination position.
    if(pop) requestAnimationFrame(restore);else restore();
  }
  async function load(url,signal) {
    if(cache.has(url.href)) return cache.get(url.href);
    const response=await fetch(url.href,{signal,credentials:'same-origin',headers:{Accept:'text/html'}});
    if(!response.ok || !response.headers.get('content-type')?.includes('text/html') || !projectURL(new URL(response.url)) || path(response.url)!==path(url.href)) throw new Error('Project response unavailable');
    const html=await response.text();
    if(signal.aborted) throw new DOMException('Aborted','AbortError');
    cache.set(url.href,html);
    if(cache.size>6) cache.delete(cache.keys().next().value);
    return html;
  }
  async function navigate(url,{link=null,keyboard=false,pop=false,restoreY=null}={}) {
    const version=++revision;
    controller?.abort();cancelNavigation('superseded');controller=new AbortController();
    const signal=controller.signal;
    const particles=window.SongDongTitleParticles;
    particles?.navigationScroll();
    const animated=link ? particles?.start(link,keyboard) : (particles?.cancel(),false);
    pendingNavigation=url.href;event('navigationstart',url.href);
    if(!pop) rememberScroll();
    nav.setAttribute('aria-busy','true');
    const timeout=setTimeout(()=>controller?.signal===signal && controller.abort(),7000);
    try {
      const html=await load(url,signal);
      if(version!==revision || signal.aborted) return;
      const parsed=new DOMParser().parseFromString(html,'text/html');
      const next=parsed.querySelector('main'), pageStyle=parsed.querySelector('head > style[data-page-style]');
      if(!next?.querySelector('[data-project-title]') || !pageStyle || !parsed.querySelector('.site-nav')) throw new Error('Invalid project document');
      resolveContent(next,url.href);
      const main=document.importNode(next,true);
      main.querySelectorAll('script').forEach(script=>script.remove());
      const style=document.querySelector('head > style[data-page-style]');
      if(!style) throw new Error('Missing page styles');
      committing=true;
      particles?.navigationScroll();
      window.SongDongNavigationUI?.closeMenu();
      window.SongDongPage.unmount();
      root.classList.add('title-flight-navigation');
      if(animated && particles.debug.active) root.classList.add('title-flight-pending');
      style.textContent=pageStyle.textContent;
      document.body.className=parsed.body.className;
      document.querySelector('main').replaceWith(main);
      document.title=parsed.title;
      for(const selector of ['meta[name="description"]','link[rel="canonical"]']) {
        const source=parsed.querySelector(selector), target=document.querySelector(selector);
        if(source && target) target.setAttribute(source.tagName==='META'?'content':'href',source.getAttribute(source.tagName==='META'?'content':'href'));
      }
      const state={...(history.state && typeof history.state==='object'?history.state:{}),__songdongProject:{url:url.href,scrollY:restoreY??0}};
      if(!pop) history[path(displayedURL)===path(url.href)?'replaceState':'pushState'](state,'',url.href);
      displayedURL=url.href;
      scrollToLocation(url,restoreY);
      window.SongDongNavigationUI?.sync(url.href);
      window.SongDongPage.mount();
      // DOM replacement is complete; scrolling while the title mask prepares
      // must still update this history entry and survive a quick next click.
      committing=false;
      rememberScroll();
      event('navigationcommit',url.href);
      // Keyboard navigation must reach the new content even when particle
      // preparation is skipped, interrupted, or cannot produce a title mask.
      if(keyboard) {const heading=main.querySelector('[data-project-title]');heading.tabIndex=-1;heading.focus({preventScroll:true});}
      if(animated) await particles.arrive();
      if(version!==revision) return;
      pendingNavigation=null;
      event('navigationend',url.href);
    } catch(error) {
      if(version!==revision) return;
      particles?.cancel();
      pendingNavigation=null;
      event('navigationerror',url.href,{message:error.message});
      history.scrollRestoration='auto';
      location[pop?'replace':'assign'](url.href);
    } finally {
      clearTimeout(timeout);
      if(version===revision) {controller=null;committing=false;nav.removeAttribute('aria-busy');}
    }
  }
  nav.addEventListener('click',e=>{
    const link=e.target.closest('a.project-link');
    if(!link || e.defaultPrevented || e.button!==0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.hasAttribute('download') || (link.target && link.target!=='_self')) return;
    const url=new URL(link.href);
    if(!projectURL(url)) return;
    e.preventDefault();navigate(url,{link,keyboard:e.detail===0});
  });
  document.addEventListener('click',e=>{
    const link=e.target.closest('a[href]');
    if(!link || e.defaultPrevented || e.button!==0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.hasAttribute('download') || (link.target && link.target!=='_self')) return;
    const url=new URL(link.href,location.href);
    if(!url.hash || !sameDocument(url)) return;
    e.preventDefault();navigateWithinPage(url,{keyboard:e.detail===0});
  });
  addEventListener('popstate',e=>{
    const url=new URL(location.href);
    if(sameDocument(url)) navigateWithinPage(url,{pop:true,state:e.state});
    else if(projectURL(url)) navigate(url,{pop:true,restoreY:savedScroll(url,e.state)});
    else {++revision;controller?.abort();cancelNavigation('document-navigation');window.SongDongTitleParticles?.cancel();history.scrollRestoration='auto';location.reload();}
  });
  // Also cover programmatic location.hash changes and browsers that dispatch
  // hashchange without popstate. A handled traversal already updated this URL.
  addEventListener('hashchange',()=>{
    const url=new URL(location.href);
    if(location.href!==displayedURL && sameDocument(url)) navigateWithinPage(url,{pop:true,state:history.state});
  });
})();
