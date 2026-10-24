/* A small, local canvas flow field. Only the project index receives pointer dust. */
(() => {
  'use strict';
  const nav = document.querySelector('.site-nav');
  if (!nav || window.SongDongNavParticles) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 801px)');
  const finePointer = matchMedia('(any-pointer: fine)');
  const canvas = document.createElement('canvas');
  canvas.className = 'nav-particle-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;z-index:40;pointer-events:none;display:block;contain:strict;';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) { canvas.remove(); return; }

  const MAX_PARTICLES = 300;
  const particles = [];
  const palette = ['#53677c', '#6d88a6'];
  const pointer = { x: 0, y: 0 };
  const emitter = { x: 0, y: 0 };
  const flow = { x: .98, y: -.2 };
  let bounds = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  let active = false, suspended = false, destroyed = false, enabled = false;
  let raf = 0, previousTime = 0, emission = 0, pixelRatio = 1;
  let viewWidth = 0, viewHeight = 0, serial = 0, travel = 0;
  const removers = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  };
  const inside = (x, y) => x >= bounds.left && x < bounds.right && y >= bounds.top && y < bounds.bottom;

  function clear() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; previousTime = 0; emission = 0;
    particles.length = 0;
    ctx.clearRect(bounds.left, bounds.top, viewWidth, viewHeight);
  }

  function leave() {
    active = false;
    clear();
  }

  function measure() {
    if (destroyed) return;
    const rect = nav.getBoundingClientRect();
    bounds = {
      left: Math.max(0, rect.left), top: Math.max(0, rect.top),
      right: Math.min(innerWidth, rect.right), bottom: Math.min(innerHeight, rect.bottom),
      width: Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left)),
      height: Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top))
    };
    const nextRatio = Math.min(devicePixelRatio || 1, 2);
    // The dust never leaves the index. A local backing store avoids clearing
    // the much larger project panel at Retina resolution on every frame.
    const nextWidth = Math.ceil(bounds.width), nextHeight = Math.ceil(bounds.height);
    if (viewWidth !== nextWidth || viewHeight !== nextHeight || pixelRatio !== nextRatio) {
      viewWidth = nextWidth; viewHeight = nextHeight; pixelRatio = nextRatio;
      canvas.width = Math.round(viewWidth * pixelRatio);
      canvas.height = Math.round(viewHeight * pixelRatio);
      canvas.style.width = `${viewWidth}px`; canvas.style.height = `${viewHeight}px`;
    }
    canvas.style.left = `${bounds.left}px`; canvas.style.top = `${bounds.top}px`;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, -bounds.left * pixelRatio, -bounds.top * pixelRatio);
    if (active && !inside(pointer.x, pointer.y)) leave();
  }

  function updateEnabled() {
    enabled = !destroyed && desktop.matches && finePointer.matches && !reduced.matches;
    canvas.hidden = !enabled;
    canvas.style.display = enabled ? 'block' : 'none';
    if (!enabled) leave();
    measure();
  }

  function noise(index, salt) {
    let n = Math.imul(index + salt, 374761393);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  // The dust keeps the last stroke's direction after the pointer stops.
  // Neighbouring grains share a breeze; none radiate from a cursor-centred ring.
  function addParticle(x, y, vx, vy, speed, seconds, distance) {
    if (particles.length >= MAX_PARTICLES) return;
    const normalX = -flow.y, normalY = flow.x;
    const side = noise(serial,5) < .52 ? -1 : 1;
    const energy = Math.min(speed / 1000, 1);
    const ribbon = Math.sin(distance * .035 - seconds * .8);
    const spread = side * (1.8 + energy * 1.4) + ribbon * 2.5 + (noise(serial,17) - .5) * 7;
    const along = (noise(serial,89) - .5) * (7 - energy * 3);
    const life = .78 + noise(serial,31) * .32;
    const drift = ribbon * 5 + side * 2.5;
    const inheritance = .03 + noise(serial,43) * .025;
    const breeze = 13 + noise(serial,97) * 7;
    particles.push({
      x: x + normalX * spread + flow.x * along, y: y + normalY * spread + flow.y * along,
      vx: vx * inheritance + flow.x * breeze + normalX * drift,
      vy: vy * inheritance + flow.y * breeze + normalY * drift,
      nx:normalX, ny:normalY, side,
      life, remaining:life, size:.65 + noise(serial,59) * .55,
      alpha:.5 + noise(serial,71) * .3,
      color:palette[serial % 5 === 0 ? 1 : 0]
    });
    serial += 1;
  }

  function frame(now) {
    raf = 0;
    if (!enabled || !active || suspended || document.hidden) { clear(); return; }
    const elapsed = previousTime ? Math.max(0,(now - previousTime) / 1000) : 1 / 60;
    const dt = Math.min(elapsed, .05);
    if (!dt) {raf = requestAnimationFrame(frame);return;}
    previousTime = now;
    const seconds = now / 1000;
    const oldX = emitter.x, oldY = emitter.y;
    const follow = 1 - Math.exp(-dt * 32);
    emitter.x += (pointer.x - emitter.x) * follow;
    emitter.y += (pointer.y - emitter.y) * follow;
    const dx = emitter.x - oldX, dy = emitter.y - oldY;
    const distance = Math.hypot(dx, dy), rawSpeed = distance / dt;
    const speed = Math.min(rawSpeed, 1400), velocityScale = rawSpeed ? speed/rawSpeed : 0;
    const vx = dx / dt * velocityScale, vy = dy / dt * velocityScale;
    if (speed > 10) {
      const turn = 1 - Math.exp(-dt * 16);
      flow.x += (dx / distance - flow.x) * turn;
      flow.y += (dy / distance - flow.y) * turn;
      const magnitude = Math.hypot(flow.x, flow.y);
      if (magnitude > .001) { flow.x /= magnitude; flow.y /= magnitude; }
    }
    // Distance-based grains make a continuous stroke. Sparse idle grains keep
    // the interaction present while resting, drifting along the remembered stroke.
    emission += Math.min(distance * 1.15 + dt * 32, dt * 300);
    const count = Math.min(Math.floor(emission), 15);
    emission -= count;
    for (let i = 0; i < count; i++) {
      const along = (i + .15 + noise(serial+i,83)*.7) / count;
      addParticle(oldX + dx * along, oldY + dy * along, vx, vy, speed, seconds, travel + distance * along);
    }
    travel += distance;

    ctx.clearRect(bounds.left, bounds.top, viewWidth, viewHeight);
    ctx.save();
    // Hard clipping makes it impossible for a trail to spill into the project panel.
    ctx.beginPath();
    ctx.rect(bounds.left, bounds.top, bounds.width, bounds.height);
    ctx.clip();
    const drag = Math.exp(-dt * 1.35);
    let alive = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.remaining -= elapsed;
      if (p.remaining <= 0) continue;
      particles[alive++] = p;
      const age = p.life - p.remaining, release = age / p.life;
      const breeze = Math.sin(p.x * .009 + p.y * .011 - seconds * .85) * 6;
      p.vx += (p.nx * (breeze + p.side * release * 4) + Math.sin(seconds * .65) * 2) * dt;
      p.vy += (p.ny * (breeze + p.side * release * 4) - 2 * release) * dt;
      p.vx *= drag; p.vy *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const fadeIn = Math.min(age / .055, 1);
      const fadeOut = Math.sin(Math.min(p.remaining / (p.life * .82),1) * Math.PI / 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha * fadeIn * fadeOut;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    particles.length = alive;
    ctx.restore();
    raf = requestAnimationFrame(frame);
  }

  function onPointerMove(event) {
    if (!enabled || suspended || document.hidden || event.pointerType === 'touch' || event.buttons) { leave(); return; }
    // Also test the actual element under the pointer, so an open dialog suppresses the effect.
    const inNav = inside(event.clientX, event.clientY) && event.composedPath().includes(nav);
    if (!inNav) { if (active) leave(); return; }
    pointer.x = event.clientX; pointer.y = event.clientY;
    if (!active) {
      active = true;
      emitter.x = pointer.x; emitter.y = pointer.y;
      emission = 0; travel = 0;
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }

  listen(document, 'pointermove', onPointerMove, { passive: true });
  listen(document, 'pointerout', event => { if (!event.relatedTarget) leave(); }, { passive: true });
  listen(document, 'pointerdown', event => { if (event.pointerType === 'touch' || !nav.contains(event.target)) leave(); }, { passive: true });
  listen(window, 'blur', leave);
  listen(window, 'resize', measure, { passive: true });
  listen(window, 'scroll', measure, { passive: true });
  listen(document, 'visibilitychange', () => { if (document.hidden) leave(); });
  listen(window, 'pagehide', leave);
  [reduced, desktop, finePointer].forEach(query => listen(query, 'change', updateEnabled));
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
  resizeObserver?.observe(nav);

  window.SongDongNavParticles = {
    suspend(value = true) { suspended = Boolean(value); if (suspended) leave(); },
    clear,
    destroy() {
      destroyed = true; enabled = false; leave();
      removers.forEach(remove => remove()); resizeObserver?.disconnect(); canvas.remove();
      delete window.SongDongNavParticles;
    },
    get debug() {
      return { active, enabled, suspended, count: particles.length, bounds: { ...bounds },
        maxParticles: MAX_PARTICLES, animating: Boolean(raf), pixelRatio,
        surface: {width: viewWidth, height: viewHeight, pixels: canvas.width * canvas.height} };
    }
  };
  updateEnabled();
})();
