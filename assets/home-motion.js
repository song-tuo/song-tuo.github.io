/* Shared clock and responsive canvases for the two original homepage panels. */
window.SongDongPage.register('home-motion', async scope => {
  'use strict';
  // Renderer scripts register their continuations before this shared clock.
  await window.SongDongFontsReady;
  if (!scope.active) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const panels = [...document.querySelectorAll('[data-home-motion]')].map(element => {
    const renderer = element.dataset.homeMotion === 'top' ? window.SongDongTop : window.SongDongBottom;
    const canvas = element.querySelector('canvas');
    const ctx = canvas.getContext('2d', {alpha: element.dataset.homeMotion === 'bottom'});
    return {element, renderer, canvas, ctx, pixelWidth: 0, pixelHeight: 0, visible: true};
  }).filter(p => p.renderer && p.ctx);
  if (!panels.length) return;
  panels.forEach(p => p.renderer.initialize?.(p.element));
  let elapsed = 0, last = performance.now(), request = 0, paused = false;
  let onScreen = true, pageActive = true;
  let pocketOpen = document.body.classList.contains('tuotuo-pocket-open');
  const button = document.querySelector('[data-home-motion-toggle]');
  const pointer = {x: 0, y: 0, active: false};
  const target = {x: 0, y: 0};
  const velocity = {x: 0, y: 0};
  const textPointer = {x: 0, y: 0, radius: 65, active: false, pressed: false};
  const textTarget = {x: 0, y: 0};
  const bottom = panels.find(p => p.renderer === window.SongDongBottom);
  const clientPointer = {x: 0, y: 0, insideBottom: false};
  let bottomBounds = bottom?.canvas.getBoundingClientRect();
  function locateTextPointer() {
    const rect = bottomBounds;
    const wasActive = textPointer.active;
    textPointer.active = !!(clientPointer.insideBottom && rect?.width && rect?.height && !preference.matches);
    if (!textPointer.active) return;
    textTarget.x = (clientPointer.x - rect.left) * bottom.renderer.width / rect.width;
    textTarget.y = (clientPointer.y - rect.top) * bottom.renderer.height / rect.height;
    // Keep the hover area comfortable at every screen size; positions themselves
    // use the unmodified canvas bounds, independent of the sculpture's spring.
    textPointer.radius = 39 * bottom.renderer.width / rect.width;
    textPointer.active = textTarget.x >= 0 && textTarget.x <= bottom.renderer.width &&
      textTarget.y >= 0 && textTarget.y <= bottom.renderer.height;
    // Start at the entered position, then gently damp event-to-event jumps.
    // This avoids a sweep from the origin when the cursor first enters a line.
    if (!wasActive && textPointer.active) {
      textPointer.x = textTarget.x; textPointer.y = textTarget.y;
    }
  }
  function updateBounds() {
    if (!scope.active) return;
    bounds = surface.getBoundingClientRect();
    bottomBounds = bottom?.canvas.getBoundingClientRect();
    locateTextPointer();
  }
  function clearPointer() {
    pointer.x = pointer.y = target.x = target.y = velocity.x = velocity.y = 0;
    pointer.active = false; clientPointer.insideBottom = textPointer.active = textPointer.pressed = false;
    bottom?.renderer.reset?.();
  }
  const surface = panels[0].element.parentElement;
  let bounds = surface.getBoundingClientRect();
  scope.listen(surface,'pointermove', event => {
    if (event.pointerType === 'touch' || preference.matches) {clientPointer.insideBottom = textPointer.active = false; return;}
    target.x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    target.y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    pointer.active = true;
    clientPointer.x = event.clientX; clientPointer.y = event.clientY;
    clientPointer.insideBottom = !!bottom && event.composedPath().includes(bottom.canvas);
    locateTextPointer();
  }, {passive: true});
  scope.listen(surface,'pointerleave', () => {target.x = target.y = 0; pointer.active = false; clientPointer.insideBottom = textPointer.active = textPointer.pressed = false;});
  if (bottom) scope.listen(bottom.canvas,'pointerdown', event => {
    if (event.pointerType !== 'touch' && event.button === 0 && textPointer.active)
      textPointer.pressed = true;
  }, {passive: true});
  scope.listen(window,'pointerup', () => {textPointer.pressed = false;}, {passive: true});
  scope.listen(window,'pointercancel', () => {textPointer.pressed = false;}, {passive: true});
  scope.listen(surface,'pointerenter', updateBounds, {passive: true});
  scope.listen(window,'scroll', updateBounds, {passive: true});
  scope.listen(window,'blur', () => {clearPointer(); draw();});

  function easePointer(delta) {
    // Closed-form critically damped spring: same response at 60 and 120 Hz.
    const frequency = 9, decay = Math.exp(-frequency * delta);
    for (const axis of ['x', 'y']) {
      const offset = pointer[axis] - target[axis];
      const impulse = (velocity[axis] + frequency * offset) * delta;
      pointer[axis] = target[axis] + (offset + impulse) * decay;
      velocity[axis] = (velocity[axis] - frequency * impulse) * decay;
      if (textPointer.active)
        textPointer[axis] += (textTarget[axis] - textPointer[axis]) * (1 - Math.exp(-28 * delta));
    }
  }

  function resize() {
    if (!scope.active) return;
    updateBounds();
    for (const panel of panels) {
      const {canvas, renderer} = panel;
      const scale = Math.min(devicePixelRatio || 1, 2) * canvas.clientWidth / renderer.width;
      panel.pixelWidth = Math.round(renderer.width * scale);
      panel.pixelHeight = Math.round(renderer.height * scale);
      if (canvas.width !== panel.pixelWidth || canvas.height !== panel.pixelHeight) {
        canvas.width = panel.pixelWidth; canvas.height = panel.pixelHeight;
      }
    }
    draw(true);
  }

  function draw(force = false) {
    if (!scope.active) return;
    for (const {element, renderer, ctx, pixelWidth, pixelHeight, visible} of panels) {
      if (!pixelWidth || !pixelHeight || (!force && !visible)) continue;
      ctx.setTransform(pixelWidth / renderer.width, 0, 0, pixelHeight / renderer.height, 0, 0);
      renderer.draw(ctx, elapsed / 1000, {reducedMotion: preference.matches, pointer, textPointer});
      element.classList.add('motion-ready');
    }
  }
  function running() { return scope.active && pageActive && !paused && !pocketOpen && !preference.matches && !document.hidden && onScreen; }
  function frame(now) {
    request = 0;
    if (!running()) {
      // Preference changes can become observable before their change event.
      // Clear the last animated frame immediately instead of freezing its dust.
      if (preference.matches) {clearPointer(); draw(true); schedule();}
      return;
    }
    // The clock follows real visible time, even if a busy frame is skipped.
    // Resume paths reset `last`, so background time never advances the loop.
    const delta = Math.max(0, now - last);
    elapsed += delta; last = now;
    easePointer(delta / 1000); draw();
    request = requestAnimationFrame(frame);
  }
  function schedule() {
    cancelAnimationFrame(request); request = 0; last = performance.now();
    if (running()) request = requestAnimationFrame(frame);
    if (button) {
      button.hidden = preference.matches;
      button.textContent = paused ? 'Play motion' : 'Pause motion';
      button.setAttribute('aria-pressed', String(paused));
    }
  }
  if (button) scope.listen(button,'click', () => {paused = !paused; schedule();});
  scope.listen(document,'songdong:pocketchange',event => {pocketOpen=event.detail.open;clearPointer();schedule();});
  scope.listen(preference,'change', () => {clearPointer(); draw(true); schedule();});
  scope.listen(document,'visibilitychange', () => {
    if (document.hidden) clearPointer();
    schedule(); prepareWhenIdle();
  });
  // Prepare glyph masks before the first text transition instead of uploading
  // and reading every new sprite on the frame where the biography appears.
  const preparation = panels.map(p => () => p.renderer.prepare?.());
  let preparationRequest = 0;
  const requestIdle = window.requestIdleCallback?.bind(window) || (callback => setTimeout(callback, 32));
  const cancelIdle = window.cancelIdleCallback?.bind(window) || clearTimeout;
  function prepareWhenIdle() {
    if (!scope.active || preparationRequest || !preparation.length || document.hidden || !pageActive) return;
    preparationRequest = requestIdle(() => {
      preparationRequest = 0;
      if (!scope.active || document.hidden || !pageActive) return;
      preparation.shift()?.(); prepareWhenIdle();
    }, {timeout: 700});
  }
  scope.listen(window,'pagehide', () => {
    pageActive = false; clearPointer(); schedule();
    cancelIdle(preparationRequest); preparationRequest = 0;
  });
  scope.listen(window,'pageshow', () => {
    pageActive = true; resize(); schedule(); prepareWhenIdle();
  });
  const observer = scope.observe(new ResizeObserver(resize));
  panels.forEach(p => observer.observe(p.canvas));
  scope.listen(window,'resize', resize, {passive: true});
  const visibility = scope.observe(new IntersectionObserver(entries => {
    if (!scope.active) return;
    for (const entry of entries) {
      const panel = panels.find(p => p.element === entry.target);
      if (panel) panel.visible = entry.isIntersecting;
    }
    onScreen = panels.some(p => p.visible);
    if (!bottom?.visible) {clientPointer.insideBottom = textPointer.active = false; bottom?.renderer.reset?.();}
    schedule();
  }));
  panels.forEach(p => visibility.observe(p.element));
  resize(); schedule(); prepareWhenIdle();

  // Deterministic seeking for local visual QA; no URL controls or production UI.
  const motion = window.SongDongMotion = {
    seek(seconds) {elapsed = Math.max(0, seconds * 1000); paused = true; clearPointer(); draw(true); schedule();},
    play() {paused = false; schedule();},
    pause() {paused = true; schedule();},
    get seconds() {return elapsed / 1000;},
    get debug() {return {paused, running: running(), onScreen, textPointer: {...textPointer},
      panels: panels.map(p => ({type: p.element.dataset.homeMotion, visible: p.visible}))};}
  };
  scope.cleanup(() => {
    pageActive = false;
    cancelAnimationFrame(request);request = 0;
    cancelIdle(preparationRequest);preparationRequest = 0;
    clearPointer();
    if (window.SongDongMotion === motion) delete window.SongDongMotion;
  });
});
