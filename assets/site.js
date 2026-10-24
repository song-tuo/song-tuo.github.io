/* Independent native interactions; no Cargo runtime or external API. */
(() => {
  if (window.SongDongNavigationUI) return;
  const eventElement = target => target?.nodeType === 1 ? target : target?.parentElement;
  const editableTarget = target => {
    const element = eventElement(target);
    return !!element && (element.matches('input,textarea') || element.isContentEditable);
  };
  // Keep editing controls usable while suppressing ordinary page text copying.
  for (const type of ['selectstart','copy','cut']) {
    document.addEventListener(type,event => {
      if (!editableTarget(event.target)) event.preventDefault();
    },true);
  }
  // Delegation also covers images created later by the lightbox.
  for (const type of ['contextmenu','dragstart']) {
    document.addEventListener(type,event => {
      if (eventElement(event.target)?.closest('img,picture')) event.preventDefault();
    },true);
  }
  const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
  const mobile = matchMedia('(max-width:800px)');
  const nav = document.querySelector('.site-nav');
  const menu = document.querySelector('[data-menu]');
  const ease = 'cubic-bezier(.22,.68,0,1)';
  const lockScroll = () => { document.body.style.overflow = nav?.classList.contains('menu-open') || document.querySelector('.lightbox[open]') ? 'hidden' : ''; };
  const setMenu = requested => {
    const open = requested && mobile.matches, wasOpen = nav?.classList.contains('menu-open');
    if (!open && wasOpen && nav.contains(document.activeElement)) menu?.focus({preventScroll:true});
    nav?.classList.toggle('menu-open',open);
    if (nav) nav.inert = mobile.matches && !open;
    menu?.setAttribute('aria-expanded',String(open));
    if (menu) menu.textContent = open ? 'Close' : 'Index';
    const main = document.querySelector('main');
    if (main) main.inert = open;
    lockScroll();
  };
  menu?.addEventListener('click',() => setMenu(!nav.classList.contains('menu-open')));
  mobile.addEventListener('change',() => setMenu(false));
  setMenu(false);
  window.addEventListener('keydown',event => {
    if (!nav?.classList.contains('menu-open') || document.querySelector('.lightbox[open]')) return;
    if (event.key === 'Escape') setMenu(false);
    if (event.key !== 'Tab') return;
    const focusable = [menu,...nav.querySelectorAll('a[href],button,[tabindex="0"]')].filter(el => el && !el.closest('[inert]') && el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });

  const normalizePath = path => {
    try { path = decodeURIComponent(path); } catch (_) {}
    return path.replace(/\/index\.html$/,'').replace(/\/$/,'');
  };
  const homePath = new URL(nav?.querySelector('h1 a')?.href || location.href).pathname;
  const scrollKey = () => `songdong:nav-scroll:${homePath}:${mobile.matches ? 'mobile' : 'desktop'}`;
  const rememberNav = () => { try { sessionStorage.setItem(scrollKey(),String(nav?.scrollTop || 0)); } catch (_) {} };
  const restoreNav = () => { try { if (nav) nav.scrollTop = Number(sessionStorage.getItem(scrollKey())) || 0; } catch (_) {} };
  document.querySelectorAll('.site-nav a').forEach(link => {
    if (link.closest('li')) {
      if (!link.querySelector(':scope > .nav-title')) {
        const label = document.createElement('span'); label.className = 'nav-title';
        label.append(...link.childNodes); link.append(label);
      }
      link.classList.add('project-link');
    }
    link.addEventListener('click',event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
      rememberNav(); link.classList.add('is-opening');
      // The navigation controller commits normal project clicks; modified clicks remain native.
    });
  });
  const syncNavigation = (url = location.href) => {
    const current = normalizePath(new URL(url,location.href).pathname);
    nav?.querySelectorAll('a').forEach(link => {
      const active = normalizePath(new URL(link.href,location.href).pathname) === current && !!current;
      link.classList.toggle('active',active);
      if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
      link.classList.remove('is-opening');
    });
  };
  window.SongDongNavigationUI = {closeMenu:() => setMenu(false),sync:syncNavigation};
  syncNavigation();
  restoreNav();
  window.addEventListener('pagehide',rememberNav);
  window.addEventListener('pageshow',() => {
    restoreNav(); document.querySelectorAll('.site-nav .is-opening').forEach(link => link.classList.remove('is-opening'));
  });
  requestAnimationFrame(() => requestAnimationFrame(() => nav?.classList.add('nav-ready')));

  const prideFlag = document.querySelector('.site-nav media-item[hash="I2692364029107349555621185121801"]');
  if (prideFlag) {
    prideFlag.classList.add('pride-flag');
    prideFlag.querySelector('img')?.setAttribute('alt','Rainbow flag — love is love');
    const prideMessage = document.createElement('span');
    prideMessage.className = 'pride-message';
    prideMessage.setAttribute('aria-hidden','true');
    prideMessage.textContent = 'love is love';
    prideFlag.append(prideMessage);
    const revealPride = event => prideFlag.classList.toggle('is-hovered',event.pointerType === 'mouse' || event.pointerType === 'pen');
    const resetPride = () => prideFlag.classList.remove('is-hovered');
    prideFlag.addEventListener('pointerenter',revealPride);
    prideFlag.addEventListener('pointermove',revealPride);
    prideFlag.addEventListener('pointerleave',resetPride);
    prideFlag.addEventListener('pointercancel',resetPride);
    window.addEventListener('blur',resetPride);
  }

  window.SongDongPage.register('site-content',scope => {
    const main = document.querySelector('main');
    if (!main) return;
    main.querySelectorAll('gallery-grid,gallery-justify,column-set').forEach(el => {
      ['columns','gutter','mobile-columns','mobile-gutter'].forEach(name => { if (el.hasAttribute(name)) el.style.setProperty(`--${name}`,el.getAttribute(name)); });
      const align = el.getAttribute('vertical-align');
      if (align) el.style.alignItems = ({bottom:'end',top:'start',center:'center'})[align] || align;
    });
    main.querySelectorAll('gallery-grid > media-item').forEach(el => el.style.setProperty('--span',el.getAttribute('grid-span') || '1'));
    main.querySelectorAll('column-unit').forEach(el => el.style.setProperty('--span',el.getAttribute('span') || '1'));

    main.querySelectorAll('gallery-slideshow').forEach((gallery,galleryIndex) => {
      const slides = [...gallery.children].filter(el => el.matches('media-item'));
      if (!slides.length) return;
      gallery.setAttribute('role','region'); gallery.setAttribute('aria-label',`Image slideshow ${galleryIndex+1}`);
      for (let surface = gallery; surface; surface = surface.parentElement) {
        const background = getComputedStyle(surface).backgroundColor;
        if (background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') {
          gallery.style.setProperty('--slide-surface',background); break;
        }
      }
      const firstImage = slides[0].querySelector('img');
      // Use intrinsic dimensions, not the CSS-stretched image box. Keep this
      // frame stable across slides; object-fit:contain preserves every artwork.
      const dimensions = [
        [Number(firstImage?.getAttribute('width')),Number(firstImage?.getAttribute('height'))],
        [firstImage?.naturalWidth,firstImage?.naturalHeight]
      ].find(([width,height]) => Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0);
      const ratio = dimensions ? dimensions[0] / dimensions[1] : 1.5;
      gallery.style.setProperty('--gallery-ratio',ratio);
      let index = 0, displayed = 0, revision = 0, animations = [];
      let paused = reducedMotion.matches, visible = false, touching = false;
      let timer = 0, scheduleVersion = 0, progressAnimation;
      let counter, counterCurrent, counterDigit, counterGhost, counterAnimations = [];
      let progress, feedback, retry, failedTarget = null, failedDirection = 1, loadingTimer = 0;
      let updateToggle = () => {};
      const delay = 2000;
      const settleCounter = () => {
        counterAnimations.forEach(animation => animation.cancel()); counterAnimations = [];
        counterGhost?.remove(); counterGhost = null;
      };
      const updateCounter = (target,direction) => {
        if (!counterDigit) return;
        const label = String(target + 1).padStart(2,'0'), previousLabel = counterDigit.textContent;
        settleCounter();
        counterDigit.textContent = label;
        if (label === previousLabel || reducedMotion.matches || !counterDigit.animate) return;
        // Only the current number moves. The fixed-width slot and total stay still.
        const ghost = counterDigit.cloneNode(); ghost.textContent = previousLabel;
        ghost.classList.add('slide-counter-outgoing'); counterCurrent.append(ghost); counterGhost = ghost;
        const offset = direction < 0 ? -.45 : .45;
        const motion = {duration:160,easing:'cubic-bezier(.2,.65,.3,1)'};
        const currentAnimations = [
          ghost.animate([{transform:'translateY(0)',opacity:1},{transform:`translateY(${-offset}em)`,opacity:0}],motion),
          counterDigit.animate([{transform:`translateY(${offset}em)`,opacity:.6},{transform:'translateY(0)',opacity:1}],motion)
        ];
        counterAnimations = currentAnimations;
        Promise.allSettled(currentAnimations.map(animation => animation.finished)).then(() => {
          ghost.remove();
          if (counterAnimations === currentAnimations) {counterAnimations = [];counterGhost = null;}
        });
      };
      const canAutoplay = () => scope.active && visible && !paused && !touching && !document.hidden && !document.querySelector('.lightbox[open]');
      const stopTimer = () => {
        clearTimeout(timer);timer = 0;scheduleVersion++;
        progressAnimation?.cancel(); progressAnimation = null;
        gallery.dataset.playing = 'false';
      };
      const prepareNext = () => {
        if (!scope.active || !visible) return;
        slides[(index + 1) % slides.length].querySelectorAll('img').forEach(image => {
          image.loading = 'eager';
          image.decode?.().catch(() => {});
        });
      };
      const schedule = () => {
        stopTimer();
        if (!canAutoplay()) return;
        prepareNext();
        gallery.dataset.playing = 'true';
        if (progress?.animate && !reducedMotion.matches) {
          progressAnimation = progress.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:delay,easing:'linear',fill:'forwards'});
        }
        const scheduled = scheduleVersion;
        timer = window.setTimeout(async () => {
          timer = 0;
          if (scheduled !== scheduleVersion || !canAutoplay()) return;
          await show(index + 1, scheduled);
          if (scheduled === scheduleVersion) schedule();
        }, delay);
      };
      slides.forEach((slide,i) => {
        slide.hidden = i !== 0; slide.inert = i !== 0;
        slide.setAttribute('role','group'); slide.setAttribute('aria-roledescription','slide');
        slide.setAttribute('aria-label',`Slide ${i+1} of ${slides.length}`); slide.setAttribute('aria-hidden',String(i !== 0));
      });
      const show = async (next, automaticVersion = null, direction = 1) => {
        if (!scope.active) return false;
        // A new request settles the last committed number while its image decodes.
        settleCounter();
        index = (next+slides.length)%slides.length;
        const target = index, version = ++revision, incoming = slides[target];
        const images = [...incoming.querySelectorAll('img')];
        clearTimeout(loadingTimer);
        gallery.setAttribute('aria-busy','true');
        if (feedback) { feedback.hidden = true; retry.hidden = true; }
        loadingTimer = window.setTimeout(() => {
          if (!scope.active || version !== revision || !feedback) return;
          feedback.firstChild.textContent = 'Loading image…'; feedback.hidden = false;
        },250);
        images.forEach(image => image.loading = 'eager');
        // Decode first so the previous image remains visible while the file loads.
        let deadline;
        await Promise.race([
          Promise.allSettled(images.map(image => image.decode ? image.decode() : Promise.resolve())),
          new Promise(resolve => { deadline = window.setTimeout(resolve,12000); })
        ]);
        clearTimeout(deadline);
        if (!scope.active || version !== revision) return false;
        clearTimeout(loadingTimer); gallery.removeAttribute('aria-busy');
        if (feedback) feedback.hidden = true;
        if (automaticVersion !== null && (automaticVersion !== scheduleVersion || !canAutoplay())) {
          index = displayed;return false;
        }
        if (images.some(image => !image.complete || !image.naturalWidth)) {
          index = displayed; failedTarget = target; failedDirection = direction; paused = true; stopTimer(); updateToggle();
          if (feedback) {
            feedback.firstChild.textContent = 'Image could not load. The previous image is still shown.';
            retry.hidden = false; feedback.hidden = false;
          }
          return false;
        }
        failedTarget = null;
        animations.forEach(animation => animation.cancel()); animations = [];
        const previous = slides[displayed];
        slides.forEach((slide,i) => {
          slide.hidden = i !== target && slide !== previous; slide.inert = i !== target;
          slide.setAttribute('aria-hidden',String(i !== target)); slide.style.zIndex = i === target ? '1' : '0';
        });
        displayed = target;
        updateCounter(target,direction);
        const finish = () => { if (scope.active && version === revision) slides.forEach((slide,i) => slide.hidden = i !== target); };
        if (reducedMotion.matches || previous === incoming || !incoming.animate) { finish(); return true; }
        // Keep the outgoing image opaque underneath; fading both creates a white dip.
        animations = [incoming.animate([{opacity:0},{opacity:1}],{duration:420,easing:ease})];
        Promise.allSettled(animations.map(animation => animation.finished)).then(finish);
        return true;
      };
      scope.cleanup(() => {
        revision++; visible = false; stopTimer(); clearTimeout(loadingTimer); gallery.removeAttribute('aria-busy');
        animations.forEach(animation => animation.cancel()); animations = [];
        settleCounter();
        gallery.querySelectorAll(':scope > .slide-counter,:scope > .slide-progress,:scope > .slide-button,:scope > .slide-toggle,:scope > .slide-feedback').forEach(control => control.remove());
      });
      if (slides.length < 2) return;
      feedback = document.createElement('div'); feedback.className = 'slide-feedback'; feedback.hidden = true;
      const message = document.createElement('span'); message.setAttribute('role','status');
      retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry'; retry.hidden = true;
      feedback.append(message,retry); gallery.append(feedback);
      const retryFailed = () => {
        if (failedTarget === null) return;
        slides[failedTarget].querySelectorAll('img').forEach(image => {image.src = image.src;});
        show(failedTarget,null,failedDirection).then(applied => {if (applied) schedule();});
      };
      scope.listen(retry,'click',retryFailed);
      gallery.setAttribute('autoplay-delay','2');
      counter = document.createElement('span'); counter.className = 'slide-counter'; counter.setAttribute('aria-hidden','true');
      counterCurrent = document.createElement('span'); counterCurrent.className = 'slide-counter-current';
      counterCurrent.style.setProperty('--counter-digits',String(Math.max(2,String(slides.length).length)));
      counterDigit = document.createElement('span'); counterDigit.className = 'slide-counter-digit'; counterDigit.textContent = '01';
      const counterTotal = document.createElement('span'); counterTotal.className = 'slide-counter-total'; counterTotal.textContent = ` / ${String(slides.length).padStart(2,'0')}`;
      counterCurrent.append(counterDigit); counter.append(counterCurrent,counterTotal);
      const track = document.createElement('span'); track.className = 'slide-progress'; track.setAttribute('aria-hidden','true');
      progress = document.createElement('span'); track.append(progress); gallery.append(counter,track);
      const toggle = document.createElement('button');
      updateToggle = () => {
        toggle.textContent = paused ? 'Play' : 'Pause';
        toggle.setAttribute('aria-label',paused ? 'Play slideshow' : 'Pause slideshow');
        gallery.setAttribute('aria-live',paused ? 'polite' : 'off');
      };
      // Manual navigation resets the two-second reading window without changing
      // the visitor's explicit Play/Pause choice.
      const step = direction => {stopTimer();show(index + direction,null,direction).then(applied => {if (applied) schedule();});};
      for (const [direction,label,symbol] of [[-1,'Previous image','‹'],[1,'Next image','›']]) {
        const button = document.createElement('button'); button.type = 'button'; button.className = `slide-button ${direction === -1 ? 'prev' : 'next'}`;
        button.textContent = symbol; button.setAttribute('aria-label',label); scope.listen(button,'click',() => step(direction)); gallery.append(button);
      }
      toggle.type = 'button'; toggle.className = 'slide-toggle';
      scope.listen(toggle,'click',() => {paused = !paused;updateToggle();if (failedTarget !== null && !paused) retryFailed(); else schedule();}); updateToggle(); gallery.append(toggle);
      scope.listen(gallery,'keydown',event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); } });
      scope.listen(reducedMotion,'change',() => {if (reducedMotion.matches) {settleCounter();paused = true;updateToggle();}schedule();});
      scope.observe(new IntersectionObserver(entries => {
        if (!scope.active) return;
        visible = entries[0].isIntersecting;schedule();
      })).observe(gallery);
      scope.listen(document,'visibilitychange',schedule);
      scope.listen(document,'songdong:lightboxchange',schedule);
      scope.listen(window,'pagehide',stopTimer);
      scope.listen(window,'pageshow',schedule);
      let touchStart;
      scope.listen(gallery,'touchstart',event => {const t = event.changedTouches[0];touchStart = {x:t.screenX,y:t.screenY};touching = true;stopTimer();},{passive:true});
      scope.listen(gallery,'touchend',event => {
        touching = false;
        const t = event.changedTouches[0], dx = t.screenX-(touchStart?.x ?? t.screenX), dy = t.screenY-(touchStart?.y ?? t.screenY);
        // Vertical reading gestures must not turn the slideshow as a side effect.
        if (Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.25) step(dx<0 ? 1 : -1);else schedule();
        touchStart = null;
      },{passive:true});
      scope.listen(gallery,'touchcancel',() => {touching = false;schedule();},{passive:true});
    });

    const zoomables = [...document.querySelectorAll('media-item[data-zoom]')];
    if (zoomables.length) {
      const dialog = document.createElement('dialog'); dialog.className = 'lightbox'; dialog.setAttribute('aria-label','Image viewer');
      dialog.innerHTML = '<button type="button" class="close" aria-label="Close image viewer">×</button><button type="button" class="previous" aria-label="Previous image">‹</button><img alt=""><button type="button" class="next" aria-label="Next image">›</button><span class="counter" aria-live="polite"></span><div class="lightbox-feedback" hidden><span role="status"></span><button type="button" class="retry" hidden>Retry image</button></div>';
      document.body.append(dialog);
      const image = dialog.querySelector('img');
      const feedback = dialog.querySelector('.lightbox-feedback'), message = feedback.querySelector('[role="status"]'), retry = feedback.querySelector('.retry');
      let active = 0, group = zoomables, returnFocus, revision = 0, closing = false, imageAnimation, dialogAnimation;
      let loadController = null, loadingTimer = 0, failedTarget = null;
      const cancelLoad = () => {
        clearTimeout(loadingTimer);loadController?.abort();loadController = null;
        dialog.removeAttribute('aria-busy');
      };
      const decodeImage = (src,signal,timeout=8000) => new Promise((resolve,reject) => {
        const asset = new Image();let done = false;
        const finish = error => {
          if(done) return;done = true;clearTimeout(deadline);signal.removeEventListener('abort',abort);
          if(error) {asset.src = '';reject(error);} else resolve(asset.src);
        };
        const abort = () => finish(new DOMException('Aborted','AbortError'));
        const deadline = window.setTimeout(() => finish(new Error('Image load timed out')),timeout);
        signal.addEventListener('abort',abort,{once:true});
        if(signal.aborted) {abort();return;}
        asset.src = src;
        asset.decode().then(() => finish(asset.complete && asset.naturalWidth ? null : new Error('Image unavailable')),finish);
      });
      const view = async (index,opening = false,direction = 1) => {
        if (!scope.active || closing) return;
        cancelLoad();loadController = new AbortController();
        const signal = loadController.signal;
        active = (index+group.length)%group.length;
        const target = active, original = group[target].querySelector('img'), version = ++revision;
        const preview = original.currentSrc || original.src, full = original.dataset.original || preview;
        failedTarget = null;feedback.hidden = true;retry.hidden = true;
        if (opening) {
          image.hidden = !(original.complete && original.naturalWidth);
          if(!image.hidden) image.src = preview;
          else image.removeAttribute('src');
          image.alt = original.alt;
          dialog.querySelector('.counter').textContent = `${target+1} / ${group.length}`;
        }
        dialog.setAttribute('aria-busy','true');
        loadingTimer = window.setTimeout(() => {
          if(!scope.active || version !== revision || signal.aborted || !dialog.open) return;
          message.textContent = 'Loading image…';feedback.hidden = false;
        },250);
        let source, previewOnly = false;
        try {source = await decodeImage(full,signal);}
        catch(error) {
          if(error.name === 'AbortError') return;
          if(full !== preview) {
            try {
              source = original.complete && original.naturalWidth ? preview : await decodeImage(preview,signal,2500);
              previewOnly = true;
            } catch (_) { /* Keep the current image and offer a retry below. */ }
          }
        }
        if (!scope.active || version !== revision || signal.aborted || !dialog.open) return;
        clearTimeout(loadingTimer);loadController = null;
        dialog.removeAttribute('aria-busy');
        if(source) {
          // Swap a decoded image in one frame; never fade the current image to white.
          imageAnimation?.cancel();image.hidden = false;image.src = source;image.alt = original.alt;
          dialog.querySelector('.counter').textContent = `${target+1} / ${group.length}`;
        }
        if(!source || previewOnly) {
          failedTarget = target;retry.hidden = false;feedback.hidden = false;
          message.textContent = previewOnly ? 'Full-size image unavailable. Preview shown.' : opening ? 'Image could not load. Retry or close the viewer.' : 'Image could not load. The previous image is still shown.';
        } else feedback.hidden = true;
      };
      const close = () => {
        if (!scope.active || closing || !dialog.open) return;
        closing = true; revision++;cancelLoad();
        const finish = () => { if (!scope.active) return; if (dialog.open) dialog.close(); closing = false; };
        if (reducedMotion.matches || !dialog.animate) { finish(); return; }
        dialogAnimation?.cancel();
        dialogAnimation = dialog.animate([{opacity:1},{opacity:0}],{duration:150,easing:'ease-out'});
        dialogAnimation.finished.then(finish,finish);
      };
      zoomables.forEach(el => {
        let handle = el;
        if (el.hasAttribute('data-loop')) {
          // Independent sibling buttons keep animation playback and enlargement
          // usable by keyboard without nesting one button inside another.
          handle = document.createElement('button');
          handle.type = 'button'; handle.className = 'loop-enlarge'; el.append(handle);
          scope.cleanup(() => handle.remove());
        } else {handle.tabIndex = 0; handle.setAttribute('role','button');}
        handle.setAttribute('aria-label',`Enlarge ${el.querySelector('img').alt}`);
        const open = () => {
          if (!scope.active || !el.isConnected) return;
          dialogAnimation?.cancel(); imageAnimation?.cancel();
          group = zoomables.filter(item => Boolean(item.closest('.site-nav')) === Boolean(el.closest('.site-nav')));
          dialog.querySelectorAll('.previous,.next,.counter').forEach(control => control.hidden = group.length < 2);
          returnFocus = handle; closing = false; dialog.showModal();document.dispatchEvent(new Event('songdong:lightboxchange'));view(group.indexOf(el),true); lockScroll();
          if (!reducedMotion.matches && dialog.animate) dialogAnimation = dialog.animate([{opacity:0},{opacity:1}],{duration:220,easing:ease});
        };
        scope.listen(handle,'click',open); if (handle === el) scope.listen(handle,'keydown',event => { if (event.target===handle && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); open(); } });
      });
      scope.listen(dialog.querySelector('.close'),'click',close);
      scope.listen(retry,'click',() => {if(failedTarget !== null) view(failedTarget);});
      scope.listen(dialog.querySelector('.previous'),'click',() => view(active-1,false,-1)); scope.listen(dialog.querySelector('.next'),'click',() => view(active+1,false,1));
      scope.listen(dialog,'click',event => { if (event.target === dialog) close(); });
      scope.listen(dialog,'cancel',event => { event.preventDefault(); close(); });
      scope.listen(dialog,'keydown',event => { if (group.length > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); const direction = event.key === 'ArrowLeft' ? -1 : 1; view(active+direction,false,direction); } });
      scope.listen(dialog,'close',() => { if (!scope.active) return; revision++; cancelLoad(); lockScroll(); returnFocus?.focus({preventScroll:true});document.dispatchEvent(new Event('songdong:lightboxchange')); });
      scope.cleanup(() => {
        revision++; closing = true; returnFocus = null;cancelLoad();
        imageAnimation?.cancel(); dialogAnimation?.cancel();
        if (dialog.open) dialog.close();
        dialog.remove(); lockScroll();
      });
    }
  });
})();
