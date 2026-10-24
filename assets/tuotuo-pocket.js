/* A small, local-only personal pocket. No idle animation or page remount. */
(() => {
  'use strict';
  if (window.TuoTuoPocket) return;
  const nav = document.querySelector('.site-nav');
  const roll = nav?.querySelector('.tuotuo-roll');
  const artwork = window.TuoTuoPocketArt;
  if (!roll || !artwork?.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width:800px)');
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'tuotuo-pocket-trigger';
  trigger.setAttribute('aria-label', 'Open Tuo Tuo’s pocket');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'tuotuo-pocket');
  roll.before(trigger); trigger.append(roll);
  const mark = document.createElement('span'); mark.className = 'pocket-trigger-mark';
  mark.setAttribute('aria-hidden', 'true'); trigger.append(mark);

  const panel = document.createElement('section');
  panel.id = 'tuotuo-pocket'; panel.className = 'tuotuo-pocket';
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'pocket-title');
  const nativePopover = typeof panel.showPopover === 'function';
  // Outside-click and Escape are handled below so the trigger cannot race native light-dismiss.
  if (nativePopover) panel.setAttribute('popover', 'manual'); else panel.hidden = true;
  panel.innerHTML = `<header class="pocket-heading"><h2 id="pocket-title">Tuo Tuo’s pocket</h2><button class="pocket-close" type="button" aria-label="Close Tuo Tuo’s pocket"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button></header><div class="pocket-table"></div><footer class="pocket-caption"><span class="pocket-object-name">Nine little things.</span><span class="pocket-hint">Hover or tap.</span></footer><span class="pocket-announcement" role="status" aria-live="polite"></span>`;
  const table = panel.querySelector('.pocket-table');
  const caption = panel.querySelector('.pocket-object-name');
  const announcement = panel.querySelector('.pocket-announcement');
  const closeButton = panel.querySelector('.pocket-close');
  // Keeping the popover in the nav preserves the existing mobile Index tab order.
  nav.append(panel);
  const animations = new Set();
  const transitions = new Set();
  const arrangements = new Set();
  let pairActive = false, reportedOpen = false;
  let open = false, closing = false, transitionRevision = 0;
  let lastResponseButton = null, lastResponseAt = 0, lastResponseWasClick = false;
  const easing = 'cubic-bezier(.16,1,.3,1)';
  function animate(element, frames, duration, extra = {}) {
    if (!element || reduced.matches || !open || document.hidden) return;
    element.getAnimations().forEach(animation => animation.cancel());
    const animation = element.animate(frames, {duration, easing, ...extra});
    animations.add(animation);
    const finished = () => animations.delete(animation);
    animation.addEventListener('finish', finished, {once:true});
    animation.addEventListener('cancel', finished, {once:true});
  }
  function stopMotion() { for (const animation of animations) animation.cancel(); animations.clear(); }
  function stopTransition() {
    transitionRevision++;
    for (const animation of transitions) animation.cancel();
    transitions.clear();
  }
  function reportState(value) {
    if (reportedOpen === value) return;
    reportedOpen = value;
    document.dispatchEvent(new CustomEvent('songdong:pocketchange',{detail:{open:value}}));
  }
  function stopArrangement() {
    for (const animation of arrangements) animation.cancel();
    arrangements.clear();
  }
  function setPair(active, gentle = true) {
    if (pairActive === active) return;
    const targets = [...table.querySelectorAll('.pocket-object')];
    const snapshots = targets.map(element => {
      const style = getComputedStyle(element);
      return {transform:style.transform,opacity:style.opacity};
    });
    stopTransition(); stopArrangement();
    pairActive = active;
    table.classList.toggle('is-pair-active',active);
    if (!gentle || reduced.matches || document.hidden) return;
    targets.forEach((element,index) => {
      const style = getComputedStyle(element);
      const animation = element.animate([snapshots[index],{transform:style.transform,opacity:style.opacity}],
        {duration:active ? 420 : 280,easing,fill:'both'});
      arrangements.add(animation);
      animation.finished.then(() => {arrangements.delete(animation);animation.cancel();},()=>arrangements.delete(animation));
    });
  }
  function spread(enter, interrupted = false) {
    // Drawings leave the name itself, then keep their individual resting angles.
    // Capture before cancellation so repeated clicks reverse from the visible frame.
    const targets = [...table.querySelectorAll('.pocket-object')];
    const snapshots = targets.map(element => {
      const style = getComputedStyle(element);
      return {transform:style.transform,opacity:style.opacity};
    });
    const labels = [panel.querySelector('.pocket-heading'),panel.querySelector('.pocket-caption')];
    const labelOpacity = labels.map(element => getComputedStyle(element).opacity);
    stopTransition(); stopArrangement();
    const revision = transitionRevision;
    if (reduced.matches || document.hidden || !panel.animate) {
      if (!enter) finishClose();
      return;
    }
    const origin = trigger.getBoundingClientRect();
    const originX = origin.left + origin.width * .5;
    const originY = origin.top + origin.height * .5;
    const active = [];
    const add = (element, frames, options) => {
      const animation = element.animate(frames, {...options,easing,fill:'both'});
      transitions.add(animation); active.push(animation);
    };
    targets.forEach((element,index) => {
      const bounds = table.getBoundingClientRect();
      const style = getComputedStyle(element);
      const angle = parseFloat(style.getPropertyValue('--angle')) || 0;
      const x = originX - bounds.left - element.offsetLeft - element.offsetWidth * .5;
      const y = originY - bounds.top - element.offsetTop - element.offsetHeight * .5;
      const gathered = {transform:`translate(${x}px,${y}px) rotate(${angle - 16}deg) scale(.12)`,opacity:enter ? .28 : 0};
      const resting = {transform:style.transform,opacity:style.opacity};
      add(element,enter ? [interrupted ? snapshots[index] : gathered,resting] : [snapshots[index],gathered],
        {duration:enter ? 420 : 260,delay:enter && !interrupted ? (index % 5)*16 : 0});
    });
    labels.forEach((element,index) => add(element,
      [{opacity:enter && !interrupted ? 0 : labelOpacity[index]},{opacity:enter ? 1 : 0}],{duration:enter ? 180 : 120,delay:enter ? 80 : 0}));
    Promise.allSettled(active.map(animation => animation.finished)).then(() => {
      if (revision !== transitionRevision) return;
      stopTransition();
      if (!enter) finishClose();
    });
  }
  function respond(button, item, spoken = false) {
    if (!open) return;
    // Pointer entry, focus and click may arrive together; play one response, not three restarts.
    const now = performance.now();
    // A deliberate tennis click adds the cat response even if pointer/focus just ran.
    const pairItem = item.id === 'tennis' || item.id === 'cat';
    if (!spoken && pairActive) return;
    const pairClick = pairItem && spoken;
    if (button === lastResponseButton && now-lastResponseAt < 180 && (!pairClick || lastResponseWasClick)) return;
    if (spoken) setPair(pairItem);
    caption.textContent = item.label;
    table.querySelectorAll('.is-selected').forEach(element => element.classList.remove('is-selected'));
    button.classList.add('is-selected');
    if (spoken) announcement.textContent = item.label;
    lastResponseButton = button; lastResponseAt = now; lastResponseWasClick = spoken;
    stopMotion();
    const part = selector => button.querySelector(selector);
    switch (item.id) {
      case 'compass':
        animate(part('.compass-leg'), [{transform:'rotate(0deg)'},{transform:'rotate(-12deg)',offset:.42},{transform:'rotate(0deg)'}], 650); break;
      case 'ballet':
        animate(part('.ballet-swing'), [{transform:'rotate(0deg)'},{transform:'rotate(8deg)',offset:.25},{transform:'rotate(-4deg)',offset:.62},{transform:'rotate(0deg)'}], 750); break;
      case 'pencil':
        animate(part('.pencil-body'), [{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(1.5px,-1px) rotate(-1.5deg)',offset:.3},{transform:'translate(-.5px,0) rotate(.6deg)',offset:.65},{transform:'translate(0,0) rotate(0deg)'}], 480, {easing:'ease-in-out'});
        animate(part('.pencil-trace'), [{opacity:.4},{opacity:.72,offset:.55},{opacity:.4}], 480); break;
      case 'cat':
      case 'tennis': {
        const cat = table.querySelector('.pocket-object--cat');
        const ball = table.querySelector('.tennis-ball');
        if (spoken) {
          caption.textContent = 'Cat & tennis ball';
          announcement.textContent = 'The tennis ball rolls closer. The cat looks up.';
          animate(ball,[{transform:'translateY(0) rotate(0deg)'},{transform:'translateY(-8px) rotate(-12deg)',offset:.35},{transform:'translateY(0) rotate(0deg)',offset:.78},{transform:'translateY(-1px) rotate(1deg)',offset:.9},{transform:'translateY(0) rotate(0deg)'}],650,{easing:'ease-in-out'});
          animate(cat.querySelector('.cat-head'),[
            {transform:'translate(0,0) rotate(0deg)'},
            {transform:'translate(0,0) rotate(0deg)',offset:.16},
            {transform:'translate(1px,-2px) rotate(5deg)',offset:.42},
            {transform:'translate(1px,-2px) rotate(5deg)',offset:.68},
            {transform:'translate(0,0) rotate(0deg)'}],760,{easing:'ease-in-out'});
          animate(cat.querySelector('.cat-tail'),[{transform:'rotate(0deg)'},{transform:'rotate(-6deg)',offset:.45},{transform:'rotate(0deg)'}],720);
        } else if (item.id === 'cat') {
          animate(part('.cat-eye'),[{transform:'scaleY(1)'},{transform:'scaleY(.12)',offset:.35},{transform:'scaleY(1)'}],320);
        } else {
          animate(ball,[{transform:'translateY(0)'},{transform:'translateY(-3px)',offset:.4},{transform:'translateY(0)'}],320,{easing:'ease-in-out'});
        }
        break;
      }
      case 'laptop':
        animate(part('.laptop-cursor'), [{opacity:1},{opacity:.18,offset:.4},{opacity:1}], 440, {easing:'ease-in-out'}); break;
      case 'book':
        animate(part('.book-page'), [{transform:'scaleX(1) skewY(0deg)'},{transform:'scaleX(.95) skewY(-1.5deg)',offset:.4},{transform:'scaleX(1) skewY(0deg)'}], 540, {easing:'ease-in-out'}); break;
      case 'wine':
        animate(part('.wine-bottle'), [{transform:'rotate(0deg)'},{transform:'rotate(2deg)',offset:.3},{transform:'rotate(-.8deg)',offset:.65},{transform:'rotate(0deg)'}], 520, {easing:'ease-in-out'}); break;
      case 'disco':
        animate(part('.disco-glints'), [{opacity:0},{opacity:1,offset:.3},{opacity:.25,offset:.65},{opacity:1,offset:.8},{opacity:0}], 800); break;
      default: break;
    }
  }
  artwork.forEach((item, index) => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = `pocket-object pocket-object--${item.id}`;
    button.setAttribute('aria-label', `${item.label} · ${item.zh}`);
    button.dataset.object = item.id;
    button.style.setProperty('--order', index);
    button.innerHTML = `<span class="pocket-art">${item.svg}</span>`;
    table.append(button);
    button.addEventListener('pointerenter', event => {if(event.pointerType !== 'touch') respond(button,item);});
    button.addEventListener('focus', () => respond(button,item));
    button.addEventListener('click', () => respond(button,item,true));
  });
  function position() {
    if (mobile.matches) {
      panel.style.removeProperty('left'); panel.style.removeProperty('top');
      panel.style.removeProperty('width');
      return;
    }
    const origin = trigger.getBoundingClientRect();
    const navBounds = nav.getBoundingClientRect();
    const available = innerWidth - navBounds.right - 38;
    const width = Math.max(280,Math.min(640,available,(innerHeight - 116)*1.27));
    panel.style.width = `${width}px`;
    const height = panel.getBoundingClientRect().height || width * .79 + 90;
    const left = Math.min(innerWidth-width-12,Math.max(12,navBounds.right+24));
    const top = Math.max(12,Math.min(origin.top-18,innerHeight-height-12));
    panel.style.left = `${left}px`; panel.style.top = `${top}px`;
  }
  function finishClose() {
    open = false; closing = false; stopMotion(); stopTransition(); stopArrangement();
    pairActive = false; table.classList.remove('is-pair-active'); reportState(false);
    panel.classList.remove('is-open','is-closing');
    document.body.classList.remove('tuotuo-pocket-open','tuotuo-pocket-settling');
    trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-label','Open Tuo Tuo’s pocket');
    if (nativePopover && panel.matches(':popover-open')) panel.hidePopover();
    else if (!nativePopover) panel.hidden = true;
    panel.inert = true;
  }
  function close(restore = false, gentle = false) {
    if (!open && !closing) return;
    if (closing && gentle) return;
    open = false; closing = true; stopMotion(); reportState(false);
    trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-label','Open Tuo Tuo’s pocket');
    panel.inert = true;
    if (restore && !nav.inert) trigger.focus({preventScroll:true});
    panel.classList.add('is-closing');
    document.body.classList.add('tuotuo-pocket-settling');
    document.body.classList.remove('tuotuo-pocket-open');
    if (gentle && !reduced.matches && !document.hidden) spread(false);
    else finishClose();
  }
  function show() {
    if (open) {close(true,true);return;}
    const interrupted = closing;
    open = true; closing = false; panel.inert = false;
    panel.classList.remove('is-closing');
    document.body.classList.remove('tuotuo-pocket-settling');
    lastResponseButton = null; lastResponseAt = 0; lastResponseWasClick = false;
    caption.textContent = 'Nine little things.'; announcement.textContent = '';
    table.querySelectorAll('.is-selected').forEach(element => element.classList.remove('is-selected'));
    pairActive = false; table.classList.remove('is-pair-active');
    trigger.setAttribute('aria-expanded','true'); trigger.setAttribute('aria-label','Close Tuo Tuo’s pocket');
    panel.classList.toggle('on-dark', !mobile.matches && !!document.querySelector('main .home-page'));
    panel.hidden = false;
    if (nativePopover && !panel.matches(':popover-open')) panel.showPopover();
    position(); panel.classList.add('is-open');
    document.body.classList.add('tuotuo-pocket-open'); reportState(true);
    window.SongDongNavParticles?.clear();
    closeButton.focus({preventScroll:true});
    spread(true,interrupted);
  }
  trigger.addEventListener('click', show);
  closeButton.addEventListener('click', () => close(true,true));
  panel.addEventListener('toggle', event => {if(event.newState==='closed' && !panel.matches(':popover-open'))finishClose();});
  panel.addEventListener('pointermove', event => event.stopPropagation());
  window.addEventListener('keydown', event => {
    if (open && event.key==='Escape') {event.preventDefault();event.stopImmediatePropagation();close(true,true);}
  }, true);
  document.addEventListener('pointerdown', event => {
    if(open && !panel.contains(event.target) && !trigger.contains(event.target)) close(false,true);
  }, true);
  document.addEventListener('navigationstart', () => close(false));
  document.addEventListener('songdong:lightboxchange', () => close(false));
  nav.addEventListener('click', event => {if(event.target.closest('a[href]'))close(false);});
  new MutationObserver(() => {if(mobile.matches && !nav.classList.contains('menu-open'))close(false);}).observe(nav,{attributes:true,attributeFilter:['class','inert']});
  mobile.addEventListener('change', () => close(false));
  reduced.addEventListener('change', () => {stopMotion();stopTransition();stopArrangement();if(closing)finishClose();});
  window.addEventListener('resize', () => {if(closing)finishClose();else if(open){stopMotion();stopTransition();stopArrangement();position();}},{passive:true});
  window.addEventListener('popstate', () => close(false));
  window.addEventListener('pagehide', () => close(false));
  document.addEventListener('visibilitychange', () => {if(document.hidden){stopMotion();stopTransition();stopArrangement();if(closing)finishClose();}});
  window.TuoTuoPocket = {close, get debug(){return {open,closing,objects:artwork.length,activeAnimations:animations.size,transitionAnimations:transitions.size,arrangementAnimations:arrangements.size,pairActive,nativePopover};}};
})();
