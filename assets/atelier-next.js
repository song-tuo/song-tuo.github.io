/* Small, progressive enhancements: native navigation and visible content first. */
window.SongDongPage.register('atelier-next', scope => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const reader = document.querySelector('[data-project-reader]');
  const intro = document.querySelector('main [data-project-title]');
  if (reader && intro) {
    // The content entrance uses a transform. Fixed reading controls belong to
    // the viewport, outside that transformed ancestor.
    document.querySelector('.site-nav').after(reader);
    reader.hidden = false;
    const contents = reader.querySelector('details');
    const index = document.querySelector('.site-nav');
    const main = document.querySelector('main');
    const summary = contents?.querySelector('summary');
    const sections = [...(contents?.querySelectorAll('a[href^="#"]') || [])].map(link => {
      let id = link.getAttribute('href').slice(1);
      try {id = decodeURIComponent(id);} catch (_) {}
      const heading = document.getElementById(id);
      return heading?.matches('[data-section]') ? {link,heading,label:link.textContent.trim(),top:0} : null;
    }).filter(Boolean);
    let currentLabel, labelAnimation, activeSection = null, positionsDirty = true, queued = 0;
    if (summary && sections.length) {
      currentLabel = document.createElement('span');
      currentLabel.className = 'reader-current-section';
      currentLabel.textContent = 'On this page';
      const marker = summary.querySelector('[aria-hidden="true"]') || document.createElement('span');
      marker.className = 'reader-contents-marker';
      marker.setAttribute('aria-hidden','true');
      marker.textContent = '＋';
      summary.replaceChildren(currentLabel,marker);
      summary.setAttribute('aria-label','On this page — show sections');
      contents.classList.add('has-sections');
    }
    const setSection = (section,visible) => {
      if (!currentLabel || section === activeSection) return;
      const previous = activeSection;
      activeSection?.link.removeAttribute('aria-current');
      activeSection = section;
      const label = section?.label || 'On this page';
      section?.link.setAttribute('aria-current','location');
      currentLabel.textContent = label;
      summary.title = `${label} — show sections`;
      summary.setAttribute('aria-label',`${label} — show sections`);
      labelAnimation?.cancel();
      // A short opacity settle keeps the new text readable immediately. The
      // reserved summary width never changes as section names get longer.
      if (visible && previous && !reduced.matches && currentLabel.animate) {
        labelAnimation = currentLabel.animate([{opacity:.62},{opacity:1}],{duration:120,easing:'ease-out'});
      }
    };
    const update = () => {
      queued = 0;
      if (!scope.active) return;
      const visible = !index.classList.contains('menu-open') && intro.getBoundingClientRect().bottom <= (innerWidth <= 800 ? 66 : 0);
      const total = Math.max(1,document.documentElement.scrollHeight-innerHeight);
      if (positionsDirty) {
        sections.forEach(section => {section.top = section.heading.getBoundingClientRect().top + scrollY;});
        positionsDirty = false;
      }
      // Match the existing anchor scroll margins, including the mobile header.
      // Only cached numbers are read during ordinary scrolling (at most 8).
      const readingLine = scrollY + (innerWidth <= 800 ? 145 : 90) + 1;
      let section = null;
      for (const item of sections) {if (item.top <= readingLine) section = item; else break;}
      if (scrollY > 0 && scrollY >= total - 2) section = sections[sections.length - 1] || null;
      reader.classList.toggle('is-visible', visible);
      reader.inert = !visible;
      if (!visible && contents) contents.open = false;
      setSection(section,visible);
      reader.style.setProperty('--reading-progress',Math.max(0,Math.min(1,scrollY/total)));
    };
    const schedule = () => {if (scope.active && !queued) queued = requestAnimationFrame(update);};
    const remeasure = () => {positionsDirty = true;schedule();};
    scope.listen(window,'scroll',schedule,{passive:true});
    scope.listen(window,'resize',remeasure,{passive:true});
    scope.listen(window,'pageshow',remeasure);
    scope.listen(window,'hashchange',schedule);
    scope.listen(window,'popstate',schedule);
    scope.listen(main,'load',remeasure,{capture:true});
    scope.observe(new ResizeObserver(remeasure)).observe(main);
    scope.observe(new MutationObserver(schedule)).observe(index,{attributes:true,attributeFilter:['class']});
    if (document.fonts) {
      document.fonts.ready.then(() => {if (scope.active) remeasure();});
      scope.listen(document.fonts,'loadingdone',remeasure);
    }
    scope.listen(reduced,'change',() => {if (reduced.matches) labelAnimation?.cancel();});
    scope.cleanup(() => {cancelAnimationFrame(queued);labelAnimation?.cancel();reader.remove();});
    scope.listen(reader,'click',event => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      if (contents) contents.open = false;
      schedule();
    });
    scope.listen(document,'click',event => {if(contents?.open && !contents.contains(event.target)) contents.open=false;});
    scope.listen(document,'keydown',event => {
      if(event.key==='Escape' && contents?.open){contents.open=false;contents.querySelector('summary').focus();}
    });
    update();
  }

  document.querySelectorAll('[data-film]').forEach(film => {
    const button = film.querySelector('.film-play');
    if (!button) return;
    button.hidden = false;
    let player, timer = 0;
    const feedback = document.createElement('div'); feedback.className = 'film-feedback'; feedback.hidden = true;
    const message = document.createElement('span'); message.setAttribute('role','status');
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Reload video'; retry.hidden = true;
    feedback.append(message,retry); film.append(feedback);
    const openPlayer = () => {
      clearTimeout(timer); player?.remove();
      player = document.createElement('iframe');
      const current = player;
      feedback.hidden = false; retry.hidden = true; feedback.dataset.loading = 'true';
      message.textContent = 'Opening video player…';
      const offerFallback = text => {
        if (!scope.active || current !== player) return;
        feedback.dataset.loading = 'false'; message.textContent = text; retry.hidden = false;
      };
      scope.listen(player,'load',() => {
        if (!scope.active || current !== player) return;
        clearTimeout(timer); feedback.dataset.loading = 'false';
        message.textContent = 'If the video does not play, use Open on YouTube.';
        retry.hidden = false;
      },{once:true});
      scope.listen(player,'error',() => {clearTimeout(timer);offerFallback('Video unavailable. Reload it or use Open on YouTube.');},{once:true});
      timer = window.setTimeout(() => offerFallback('The video is taking longer to load. Reload it or use Open on YouTube.'),10000);
      player.title = button.getAttribute('aria-label').replace('Play film: ','') + ' — film';
      player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      player.allowFullscreen = true;
      player.referrerPolicy = 'strict-origin-when-cross-origin';
      player.src = `https://www.youtube-nocookie.com/embed/${film.dataset.film}?autoplay=1&playsinline=1&rel=0`;
      film.querySelector('.film-stage').append(player);
      button.hidden = true;
      film.classList.add('film-playing');
      player.focus();
    };
    scope.listen(button,'click',openPlayer);
    scope.listen(retry,'click',openPlayer);
    scope.cleanup(() => {clearTimeout(timer);player?.remove();feedback.remove();});
  });

  const loops = [];
  const observer = scope.observe(new IntersectionObserver(entries => {
    if (!scope.active) return;
    for (const entry of entries) {
      const state = loops.find(item => item.element === entry.target);
      if (state) {state.visible=entry.isIntersecting;state.update();}
    }
  },{rootMargin:'80px',threshold:0}));
  document.querySelectorAll('[data-loop]').forEach(element => {
    const video = element.querySelector('video');
    const button = element.querySelector('.loop-toggle');
    const state = {element,visible:false,paused:reduced.matches,update};
    video.muted=true;
    let revision=0;
    function update() {
      if (!scope.active) return;
      const token=++revision;
      const play=state.visible && !state.paused && !document.hidden && !element.closest('[aria-hidden="true"]') && !document.querySelector('.lightbox[open]');
      if (play) {
        if (!video.src) video.src=video.dataset.loopSrc;
        video.play().then(()=>{if(scope.active && token===revision)element.classList.add('is-playing');}).catch(()=>{
          if(scope.active && token===revision){state.paused=true;button.textContent='Play motion';button.setAttribute('aria-label','Play animation');}
        });
      } else video.pause();
    }
    button.hidden=false;
    const label=()=>{button.textContent=state.paused?'Play motion':'Pause motion';button.setAttribute('aria-label',state.paused?'Play animation':'Pause animation');};
    scope.listen(button,'click',event=>{event.stopPropagation();state.paused=!state.paused;label();update();});
    scope.listen(reduced,'change',()=>{state.paused=reduced.matches;if(reduced.matches)element.classList.remove('is-playing');label();update();});
    scope.listen(document,'visibilitychange',update);
    scope.listen(document,'songdong:lightboxchange',update);
    scope.listen(window,'pagehide',()=>video.pause());
    scope.listen(window,'pageshow',update);
    scope.observe(new MutationObserver(update)).observe(element,{attributes:true,attributeFilter:['aria-hidden','hidden']});
    scope.cleanup(() => {revision++;video.pause();});
    label();loops.push(state);observer.observe(element);
  });
});
