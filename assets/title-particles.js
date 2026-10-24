/* One title canvas survives project content replacement in the same document. */
(() => {
  'use strict';
  const KEY = 'songdong:title-flight:v1';
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const nav = document.querySelector('.site-nav');
  const root = document.documentElement;
  const normalize = value => {
    try {return decodeURIComponent(new URL(value, location.href).pathname).replace(/\/index\.html$/, '').replace(/\/$/, '');}
    catch (_) {return '';}
  };
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => {n = clamp(n); return n * n * (3 - 2 * n);};
  const timing = {travel:.70, spread:.10, fade:.20, settle:.02, departure:8.00};
  const grainCount = 1400;
  let canvas, pen, frame = 0, flight = null, restoreTimer = 0, safetyTimer = 0, revision = 0;
  let lastMetrics = null, pendingRecord = null, arrivalPromise = null, ignoreScrollUntil = 0;
  let viewportWidth = innerWidth;
  let viewportRatio = devicePixelRatio || 1, maskEpoch = 0;
  const baselineOffsets = new Map();
  const scriptURL = document.currentScript?.src;
  const embeddedFonts = new Map();
  const headingMasks = new Map(), maskCacheLimit = 24;
  const maskStats = {hits:0, misses:0, samples:0, totalMs:0, lastMs:0, maxMs:0};

  function invalidateHeadingMasks() {
    headingMasks.clear();baselineOffsets.clear();maskEpoch++;
  }

  // An SVG image cannot use the page's loaded @font-face. Embed only the
  // styles used by this heading, on demand, so its mask has the same glyphs.
  function headingFontFace(key) {
    const [family,style]=key.includes('|')?key.split('|'):['Bodoni Moda',key];
    if (!embeddedFonts.has(key)) {
      const filename = family === 'Archivo Study' ? 'Archivo-Variable.ttf' : style === 'italic' ? 'BodoniModa-Italic-Variable.ttf' : 'BodoniModa-Variable.ttf';
      const pending = (async () => {
        if (!scriptURL) throw new Error('missing title script URL');
        const response = await fetch(new URL(`fonts/${filename}`, scriptURL));
        if (!response.ok) throw new Error('heading font unavailable');
        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 16384) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
        }
        return `@font-face{font-family:"${family}";font-style:${style};font-weight:100 900;font-stretch:62% 125%;src:url("data:font/ttf;base64,${btoa(binary)}") format("truetype");}`;
      })();
      embeddedFonts.set(key, pending);
    }
    return embeddedFonts.get(key);
  }

  // Capture actual character geometry, including nested font sizes, indented
  // titles and line wraps. No screenshots, raster assets or retyped headings.
  if(document.querySelector('link[href*="variable-type.css"]')) headingFontFace('Archivo Study|normal').catch(()=>{});

  function sampleText(element, clip = null, limit = 1400) {
    const runs = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue.trim()) continue;
      const style = getComputedStyle(node.parentElement);
      const size = parseFloat(style.fontSize);
      const font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
      let baselineOffset = baselineOffsets.get(font);
      if (baselineOffset === undefined) {
        // DOM baseline measurement also works in browsers that omit Canvas
        // fontBoundingBox metrics (the old proportional fallback could drift).
        const probe = document.createElement('span');
        probe.style.cssText = 'position:fixed;left:-10000px;top:0;white-space:nowrap;line-height:normal;';
        probe.style.font = font;
        const text = document.createElement('span');text.textContent = 'Hg';
        const marker = document.createElement('span');
        marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;';
        probe.append(text, marker);document.body.append(probe);
        baselineOffset = marker.getBoundingClientRect().top - text.getBoundingClientRect().top;
        probe.remove();baselineOffsets.set(font, baselineOffset);
      }
      for (let i = 0; i < node.length; i++) {
        const char = node.nodeValue[i];
        if (/\s/.test(char)) continue;
        const range = document.createRange();range.setStart(node, i);range.setEnd(node, i + 1);
        const r = range.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
        const baseline = r.top + baselineOffset;
        runs.push({char, font, width:r.width, x:r.left, baseline});
        minX = Math.min(minX, r.left - 2);minY = Math.min(minY, r.top - 2);
        maxX = Math.max(maxX, r.right + 2);maxY = Math.max(maxY, r.bottom + 2);
      }
    }
    if (!runs.length) return [];
    minX = Math.floor(Math.max(0, clip?.left || 0, minX));
    minY = Math.floor(Math.max(0, clip?.top || 0, minY));
    maxX = Math.ceil(Math.min(innerWidth, clip?.right || innerWidth, maxX));
    maxY = Math.ceil(Math.min(innerHeight, clip?.bottom || innerHeight, maxY));
    if (maxX <= minX || maxY <= minY) return [];
    const mask = document.createElement('canvas');mask.width = maxX - minX;mask.height = maxY - minY;
    const ctx = mask.getContext('2d', {willReadFrequently:true});
    ctx.fillStyle = '#fff';ctx.textBaseline = 'alphabetic';
    for (const run of runs) {
      ctx.font = run.font;
      const advance = ctx.measureText(run.char).width;
      ctx.save();ctx.translate(run.x-minX,run.baseline-minY);
      if(advance>0)ctx.scale(run.width/advance,1);
      ctx.fillText(run.char,0,0);ctx.restore();
    }
    const pixels = ctx.getImageData(0, 0, mask.width, mask.height).data;
    const points = [];
    for (let y = 0; y < mask.height; y += 2) for (let x = 0; x < mask.width; x += 2) {
      if (pixels[(y * mask.width + x) * 4 + 3] > 90) points.push([x + minX, y + minY]);
    }
    if (points.length <= limit) return points;
    return Array.from({length:limit}, (_, i) => points[Math.floor(i * points.length / limit)]);
  }

  // Let the browser itself shape the destination text. This retains real
  // kerning, Greek glyphs, mixed sizes, line breaks and strike-throughs.
  const textProperties = ('display box-sizing width height min-width max-width min-height max-height ' +
    'margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left ' +
    'font-family font-size font-weight font-style font-stretch font-kerning font-feature-settings ' +
    'font-variation-settings font-optical-sizing font-synthesis line-height letter-spacing word-spacing ' +
    'text-align text-indent text-transform text-decoration text-decoration-thickness text-underline-offset ' +
    'white-space overflow-wrap word-break vertical-align direction writing-mode list-style-type list-style-position color').split(' ');
  function headingStyles(heading) {
    return [heading, ...heading.querySelectorAll('*')].map(element => {
      const css = getComputedStyle(element);
      return {element, values:textProperties.map(property => css.getPropertyValue(property)),
        font:`${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`,
        family:css.fontFamily, style:css.fontStyle};
    });
  }
  async function sampleHeading(heading, version) {
    const started = performance.now();
    try {
      const sampled = await prepareHeadingMask(heading, version);
      sampled.prepareMs = performance.now()-started;
      return sampled;
    } finally {
      const elapsed = performance.now()-started;
      maskStats.samples++;maskStats.totalMs += elapsed;
      maskStats.lastMs = elapsed;maskStats.maxMs = Math.max(maskStats.maxMs,elapsed);
    }
  }
  async function prepareHeadingMask(heading, version) {
    // An unrelated page font must not hold the title invisible. System fonts
    // are ready immediately; wait only for font faces actually in this heading.
    const pendingFonts = new Map();
    let styles = headingStyles(heading);
    for (const {element,font} of styles) {
      const text = element.textContent;
      if (!document.fonts.check(font, text) && !pendingFonts.has(font))
        pendingFonts.set(font, document.fonts.load(font, text));
    }
    if (pendingFonts.size) {
      await Promise.all(pendingFonts.values());
      styles = headingStyles(heading);
    }
    if (version !== revision) throw new Error('superseded title flight');
    const box = heading.getBoundingClientRect();
    // Position is deliberately excluded: the same glyph mask can move with
    // the layout. Exact dimensions, all copied text styles, DOM structure and
    // pixel ratio still distinguish wraps, nested sizes and strike-throughs.
    const epoch = maskEpoch;
    const key = JSON.stringify([heading.innerHTML,box.width,box.height,devicePixelRatio || 1,
      styles.map(style => style.values)]);
    if (headingMasks.has(key)) {
      const local = headingMasks.get(key);
      headingMasks.delete(key);headingMasks.set(key,local);maskStats.hits++;
      // Arrival sorts/translates targets. Never give it the cached arrays.
      return {points:local.map(([x,y]) => [box.left+x,box.top+y]),box,
        method:'native-heading',cacheHit:true};
    }
    maskStats.misses++;
    let inkLeft = box.left, inkTop = box.top, inkRight = box.right, inkBottom = box.bottom;
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue.trim()) continue;
      const range = document.createRange();range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        inkLeft = Math.min(inkLeft,rect.left);inkTop = Math.min(inkTop,rect.top);
        inkRight = Math.max(inkRight,rect.right);inkBottom = Math.max(inkBottom,rect.bottom);
      }
    }
    // Some original headings use a hanging/negative indent outside the h1 box.
    const padLeft = Math.ceil(box.left-inkLeft)+16, padTop = Math.ceil(box.top-inkTop)+16;
    const padRight = Math.ceil(inkRight-box.right)+16, padBottom = Math.ceil(inkBottom-box.bottom)+16;
    const clone = heading.cloneNode(true);
    const copies = [clone, ...clone.querySelectorAll('*')];
    const fontStyles = new Set();
    for (let i = 0; i < styles.length; i++) {
      const {family,style,values} = styles[i];
      if (family.includes('Archivo Study')) fontStyles.add('Archivo Study|normal');
      else if (family.includes('Bodoni Moda')) fontStyles.add('Bodoni Moda|' + (style === 'italic' ? 'italic' : 'normal'));
      copies[i].removeAttribute('id');copies[i].removeAttribute('class');
      copies[i].removeAttribute('style');
      textProperties.forEach((property,index) => copies[i].style.setProperty(property,values[index]));
      copies[i].style.opacity = '1';
    }
    Object.assign(clone.style, {margin:'0', width:`${box.width}px`, height:`${box.height}px`,
      position:'static', transform:'none'});
    const width = Math.ceil(box.width) + padLeft + padRight, height = Math.ceil(box.height) + padTop + padBottom;
    const markup = new XMLSerializer().serializeToString(clone);
    const fontFaces = (await Promise.all([...fontStyles].map(headingFontFace))).join('');
    if (version !== revision) throw new Error('superseded title flight');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><style>${fontFaces}</style><foreignObject x="${padLeft}" y="${padTop}" width="${box.width}" height="${box.height + padBottom}" style="overflow:visible">${markup}</foreignObject></svg>`;
    const image = new Image();image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    let timeout;
    try {await Promise.race([image.decode(), new Promise((_, reject) => {timeout = setTimeout(() => reject(new Error('mask timeout')), 450);})]);}
    finally {clearTimeout(timeout);}
    if (version !== revision) throw new Error('superseded title flight');
    const mask = document.createElement('canvas');mask.width = width;mask.height = height;
    const ctx = mask.getContext('2d', {willReadFrequently:true});ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height).data, points = [];
    // Fixed local sampling retains the exact position even at fractional CSS
    // coordinates and when the browser's device pixel ratio changes.
    for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
      if (pixels[(y * width + x) * 4 + 3] > 80) points.push([x-padLeft,y-padTop]);
    }
    if (!points.length) throw new Error('empty mask');
    const limit = 1400;
    const local = points.length <= limit ? points : Array.from({length:limit}, (_, i) => points[Math.floor(i * points.length / limit)]);
    if (epoch === maskEpoch) {
      headingMasks.set(key,local);
      if (headingMasks.size > maskCacheLimit) headingMasks.delete(headingMasks.keys().next().value);
    }
    return {points:local.map(([x,y]) => [box.left+x,box.top+y]),
      box, method:'native-heading',cacheHit:false};
  }

  function clear() {
    revision++;
    cancelAnimationFrame(frame);frame = 0;
    clearTimeout(restoreTimer);
    clearTimeout(safetyTimer);
    if (flight) lastMetrics = {frames:flight.frames, meanDrawMs:flight.totalDraw / Math.max(1,flight.frames), maxDrawMs:flight.maxDraw, mask:flight.mask, maskPrepareMs:flight.maskPrepareMs, maskCacheHit:flight.maskCacheHit, count:flight.particles.length, surface:flight.surface};
    if (flight?.heading) flight.heading.style.removeProperty('opacity');
    flight?.source?.classList.remove('particle-source');
    root.classList.remove('title-flight-pending');
    root.removeAttribute('data-title-flight-owned');
    canvas?.remove();canvas = pen = null;
    window.SongDongNavParticles?.suspend(false);
    flight = null;pendingRecord = null;arrivalPromise = null;
  }
  function noise(index, salt = 0) {
    let x = Math.imul(index + salt + 1, 374761393);
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }

  function validRecord(record) {
    return Number.isFinite(record.at) && Array.isArray(record.points) && record.points.length > 0 &&
      record.points.length <= 2300 && record.points.every(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }

  function setSurface(minX, minY, maxX, maxY) {
    const left = Math.max(0, Math.floor(minX - 24)), top = Math.max(0, Math.floor(minY - 32));
    const width = Math.max(1, Math.ceil(Math.min(innerWidth,maxX+24)-left));
    const height = Math.max(1, Math.ceil(Math.min(innerHeight,maxY+32)-top));
    if (!canvas) {
      canvas = document.createElement('canvas');canvas.className = 'title-particle-canvas';
      canvas.setAttribute('aria-hidden','true');document.body.append(canvas);
    }
    Object.assign(canvas.style,{inset:'auto',left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`});
    // Reuse the same element when the destination mask arrives. Both resizing
    // and its first draw happen in this task, so there is no empty painted frame.
    const ratio = Math.min(devicePixelRatio || 1, 1.5, Math.max(1, Math.sqrt(1000000 / (width * height))));
    canvas.width = Math.ceil(width*ratio);canvas.height = Math.ceil(height*ratio);
    pen = canvas.getContext('2d');pen.setTransform(ratio,0,0,ratio,-left*ratio,-top*ratio);
    return {left,top,width,height,ratio};
  }

  function departureAxis(start, velocity, limit, index, salt) {
    const direction = velocity < 0 ? -1 : 1;
    const room = Math.max(0,direction < 0 ? start-2 : limit-2-start);
    const amplitude = Math.min(28,room*.25), distance = room-amplitude;
    return {start,direction,distance,amplitude,
      rate:distance ? Math.abs(velocity)/distance : 0,
      frequency:2.1+noise(index,salt)*1.6,phase:noise(index,salt+1)*Math.PI*2,
      position:start,velocity};
  }
  function advanceDepartureAxis(axis, age) {
    const decay = Math.exp(-axis.rate*age), q = 1-decay, dq = axis.rate*decay;
    const angle = axis.frequency*age+axis.phase, wave = Math.sin(angle);
    // The directional release starts at its full speed. A gradually growing
    // drift keeps a slow network wait moving, inside the available viewport.
    // q² gives the drift zero position and velocity at the click boundary.
    axis.position = axis.start+axis.direction*axis.distance*q+axis.amplitude*q*q*wave;
    axis.velocity = axis.direction*axis.distance*dq+
      axis.amplitude*(2*q*dq*wave+q*q*axis.frequency*Math.cos(angle));
  }
  function departureExtent(axis, age) {
    const q = 1-Math.exp(-axis.rate*age);
    return axis.start+axis.direction*(axis.distance*q+axis.amplitude*q*q);
  }
  function departurePosition(p, age) {
    advanceDepartureAxis(p.motionX,age);advanceDepartureAxis(p.motionY,age);
    p.x = p.motionX.position;p.y = p.motionY.position;
    // Arrival inherits the derivative of the exact current path, including
    // its drift, rather than the initial click velocity.
    p.vx = p.motionX.velocity;p.vy = p.motionY.velocity;
  }

  function depart(record, source, heading = null) {
    let minX = innerWidth, minY = innerHeight, maxX = 0, maxY = 0;
    const mobile = record.width <= 800, horizon = timing.departure;
    const particles = Array.from({length:grainCount}, (_, i) => {
      const start = record.points[Math.floor(noise(i,101) * record.points.length)];
      const vx = mobile ? (noise(i,22)-.5)*30 : 150+noise(i,22)*70;
      const vy = -(mobile ? 110+noise(i,37)*50 : 35+noise(i,37)*30);
      const motionX = departureAxis(start[0],vx,record.width,i,51);
      const motionY = departureAxis(start[1],vy,record.height,i,73);
      const endX = departureExtent(motionX,horizon), endY = departureExtent(motionY,horizon);
      minX = Math.min(minX,start[0],endX);maxX = Math.max(maxX,start[0],endX);
      minY = Math.min(minY,start[1],endY);maxY = Math.max(maxY,start[1],endY);
      return {sx:start[0],sy:start[1],x:start[0],y:start[1],
        vx,vy,motionX,motionY,
        phase:noise(i,9)*Math.PI*2,size:.60+noise(i,11)*.34};
    });
    const surface = setSurface(minX,minY,maxX,maxY);
    source.classList.add('particle-source');window.SongDongNavParticles?.suspend(true);
    flight = {phase:'departure',heading,source,particles,record,start:null,elapsed:0,
      from:record.text,to:heading?.textContent.trim().replace(/\s+/g,' ') || '',
      keyboard:record.keyboard,mask:'departure',frames:0,totalDraw:0,maxDraw:0,surface};
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(() => source.classList.remove('particle-source'),400);
    // Draw in the click task, without waiting for another page or an RAF.
    render(performance.now());
  }

  async function begin(record) {
    const version = revision;
    const heading = document.querySelector('[data-project-title]');
    const source = [...document.querySelectorAll('.site-nav .project-link')].find(a => normalize(a.href) === record.to);
    if (!heading || !source || preference.matches || Math.abs(record.width - innerWidth) > 20 || !validRecord(record)) {clear();return;}
    // Cover font loading as well as animation. If a font stalls, reveal the
    // real heading promptly and never start a stale flight several seconds later.
    const remainingDeparture = timing.departure*1000-(Date.now()-record.at);
    // The source has already restored itself after this absolute deadline.
    // A very late page must show its real title rather than replay old grains.
    if (remainingDeparture <= 0) {clear();return;}
    clearTimeout(safetyTimer);
    safetyTimer = setTimeout(clear,Math.min(600,remainingDeparture));
    const departure = flight;
    if (departure?.phase === 'departure' && departure.record === record) departure.heading = heading;
    else return;
    let sampled;
    try {sampled = await sampleHeading(heading, version);}
    catch (_) {
      if (version !== revision) return;
      sampled = {points:sampleText(heading), box:heading.getBoundingClientRect(), method:'dom-baseline'};
    }
    if (version !== revision || flight !== departure) return;
    if (document.hidden || preference.matches || root.hasAttribute('data-title-flight-expired')) {clear();return;}
    const targets = sampled.points;
    if (!targets.length) {clear();return;}
    const current = heading.getBoundingClientRect();
    for (const p of targets) {p[0] += current.left - sampled.box.left;p[1] += current.top - sampled.box.top;}
    targets.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let minX = innerWidth, minY = innerHeight, maxX = 0, maxY = 0;
    const age = Math.max(0,(Date.now()-record.at)/1000);
    let revealAt = 0;
    const particles = Array.from({length:grainCount}, (_, i) => {
      const target = targets[Math.floor(i * targets.length / grainCount)];
      const grain = departure.particles[i];departurePosition(grain,age);
      const start = [grain.x,grain.y];
      // Hermite-to-Bezier: inherit the actual outgoing velocity instead of
      // stopping at the handoff and easing every grain up from zero again.
      const duration = timing.travel+timing.spread*(noise(i,7)*.4+i/grainCount*.6);
      revealAt = Math.max(revealAt,duration);
      const cx1 = start[0]+grain.vx*duration/3, cy1 = start[1]+grain.vy*duration/3;
      const cx2 = target[0], cy2 = target[1];
      minX = Math.min(minX,start[0],target[0],cx1,cx2);maxX = Math.max(maxX,start[0],target[0],cx1,cx2);
      minY = Math.min(minY,start[1],target[1],cy1,cy2);maxY = Math.max(maxY,start[1],target[1],cy1,cy2);
      // Precompute cubic coefficients; no allocations or style changes per grain.
      return {sx:start[0],sy:start[1],tx:target[0],ty:target[1],
        ax:-start[0]+3*cx1-3*cx2+target[0], bx:3*start[0]-6*cx1+3*cx2, cx:3*(cx1-start[0]),
        ay:-start[1]+3*cy1-3*cy2+target[1], by:3*start[1]-6*cy1+3*cy2, cy:3*(cy1-start[1]),
        duration,
        phase:noise(i,9)*Math.PI*2, size:.60+noise(i,11)*.34};
    });
    cancelAnimationFrame(frame);
    const surface = setSurface(minX,minY,maxX,maxY);
    flight = {phase:'arrival',heading,source,particles,start:null,from:record.text,to:heading.textContent.trim().replace(/\s+/g,' '),
      elapsed:0,keyboard:record.keyboard,box:current,mask:sampled.method,frames:0,totalDraw:0,maxDraw:0,
      maskPrepareMs:sampled.prepareMs,maskCacheHit:sampled.cacheHit === true,
      surface,dx:0,dy:0,revealAt,finishAt:revealAt+timing.fade+timing.settle};
    clearTimeout(safetyTimer);
    safetyTimer = setTimeout(clear,1600);
    render(performance.now());
  }

  function render() {
    if (!flight || !pen) return;
    // RAF timestamps describe the frame's start and can precede a synchronous
    // handoff draw in that same frame. Sample one clock here for both callers.
    const now = performance.now(), before = now, f = flight;
    if (f.start === null) f.start = now;
    const departing = f.phase === 'departure';
    const t = f.elapsed = Math.max(0,departing ? (Date.now()-f.record.at)/1000 : (now-f.start)/1000);
    if (departing && t >= timing.departure) {clear();return;}
    const {left,top,width,height} = f.surface;
    // Track actual heading movement rather than retaining stale viewport coordinates.
    if (!departing && f.frames % 8 === 0) {
      const box = f.heading.getBoundingClientRect();
      if (Math.abs(box.width-f.box.width)>.5 || Math.abs(box.height-f.box.height)>.5) {clear();return;}
      f.dx = box.left-f.box.left;f.dy = box.top-f.box.top;
    }
    pen.clearRect(left,top,width,height);
    const reveal = departing ? 0 : smooth((t-f.revealAt)/timing.fade);
    if (!departing && t >= f.revealAt) f.heading.style.opacity = String(reveal);
    pen.globalAlpha = .86*(1-reveal);pen.fillStyle = '#272727';
    // One batched path, one fill, and a cropped backing store per frame.
    pen.beginPath();
    for (const p of f.particles) {
      if (departing) {
        departurePosition(p,t);pen.rect(p.x-p.size,p.y-p.size,p.size*2,p.size*2);continue;
      }
      const u = clamp(t/p.duration), correction = smooth(u);
      // The ripple and heading correction have zero first derivative at both
      // ends, preserving the inherited speed and a stationary final glyph.
      const envelope = 16*u*u*(1-u)*(1-u);
      const x = ((p.ax*u+p.bx)*u+p.cx)*u+p.sx + Math.sin(t*6+p.phase)*12*envelope + f.dx*correction;
      const y = ((p.ay*u+p.by)*u+p.cy)*u+p.sy + Math.cos(t*7+p.phase)*19*envelope + f.dy*correction;
      const radius = p.size*(1+envelope*.18);
      pen.rect(x-radius,y-radius,radius*2,radius*2);
    }
    pen.fill();pen.globalAlpha = 1;
    const cost = performance.now()-before;
    f.frames++;f.totalDraw += cost;f.maxDraw = Math.max(f.maxDraw,cost);
    if (!departing && t >= f.finishAt) {
      const {heading,keyboard} = f;clear();
      if (keyboard) {heading.tabIndex=-1;heading.focus({preventScroll:true});}
    } else frame = requestAnimationFrame(render);
  }

  // No session replay: a native fallback reveals a normal page. A single
  // in-memory flight alone owns the transfer across a successful soft navigation.
  try {sessionStorage.removeItem(KEY);} catch (_) {}
  root.classList.remove('title-flight-pending');
  function start(link, keyboard = false) {
    clear();root.classList.add('title-flight-navigation');
    if (preference.matches || document.hidden) return false;
    try {
      const at=Date.now(), label=link.querySelector('.nav-title') || link;
      const points=sampleText(label,nav.getBoundingClientRect(),1000);
      if(!points.length) return false;
      const record={to:normalize(link.href),at,width:innerWidth,height:innerHeight,points,
        text:label.textContent.trim(),keyboard};
      pendingRecord=record;
      safetyTimer=setTimeout(clear,Math.max(0,timing.departure*1000-(Date.now()-at)));
      depart(record,link);
      return true;
    } catch (_) {clear();return false;}
  }
  function arrive() {
    const record=pendingRecord;
    if(!record || !flight || preference.matches) {clear();return Promise.resolve();}
    if(arrivalPromise) return arrivalPromise;
    if(flight.phase !== 'departure') return Promise.resolve();
    root.classList.add('title-flight-pending','title-flight-navigation');
    root.removeAttribute('data-title-flight-expired');
    root.setAttribute('data-title-flight-owned','');
    const version=revision;
    const promise=begin(record).catch(()=>{if(version===revision)clear();});
    if(version===revision) arrivalPromise=promise;
    return promise;
  }
  window.addEventListener('resize', () => {
    // Mobile browser chrome can change height during the owned scroll-to-top.
    // Preserve that flight; a width change still invalidates its glyph layout.
    const ratio = devicePixelRatio || 1;
    if(innerWidth !== viewportWidth || ratio !== viewportRatio) {clear();invalidateHeadingMasks();}
    viewportWidth=innerWidth;viewportRatio=ratio;
  }, {passive:true});
  window.addEventListener('scroll', () => {
    if (performance.now()>ignoreScrollUntil && (flight || root.classList.contains('title-flight-pending'))) clear();
  }, {passive:true});
  window.addEventListener('pagehide', clear);
  document.addEventListener('visibilitychange', () => {if (document.hidden) clear();});
  preference.addEventListener('change', () => {if (preference.matches) clear();});
  document.fonts.addEventListener('loadingdone',invalidateHeadingMasks);
  document.fonts.addEventListener('loadingerror',invalidateHeadingMasks);
  // Read-only status for regression tests and local debugging.
  window.SongDongTitleParticles = {start,arrive,cancel:clear,
    navigationScroll(){ignoreScrollUntil=performance.now()+250;},
    get debug() {return {active:!!flight,
    phase:flight?.phase || '',
    count:flight?.particles.length || 0,elapsed:flight?.elapsed || 0,
    from:flight?.from || '',to:flight?.to || '',mask:flight?.mask || lastMetrics?.mask || '',
    maskPrepareMs:flight?.maskPrepareMs ?? lastMetrics?.maskPrepareMs ?? null,
    maskCacheHit:flight?.maskCacheHit ?? lastMetrics?.maskCacheHit ?? false,
    maskCache:{hits:maskStats.hits,misses:maskStats.misses,size:headingMasks.size,limit:maskCacheLimit},
    maskPreparation:{samples:maskStats.samples,lastMs:maskStats.lastMs,
      meanMs:maskStats.totalMs/Math.max(1,maskStats.samples),maxMs:maskStats.maxMs},
    surface:flight?.surface || lastMetrics?.surface || null,metrics:lastMetrics};}};
})();
