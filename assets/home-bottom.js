/* The lower panel is drawn entirely from text and a moving 3D helix.
   All positions are continuous in time; no GIF frames or external libraries. */
(async () => {
  'use strict';
  // Serif metrics and ink masks must be sampled from the loaded local face.
  await window.SongDongFontsReady;
  const FONT = '"Bodoni Moda", Georgia, serif';
  const width = 1072, height = 744, duration = 69;
  const sculptureDuration = 5.35, typingStart = sculptureDuration, typingEnd = 65.75;
  const loopStart = 68.15;
  let field = null;
  function initialize(element) {
    field?.dispose();
    field = window.SongDongTextField?.create(element, width, height);
  }
  const lines = [
    'Song Dong is an Interdisciplinary',
    'Designer working at the intersection of',
    'AI’s perceptual infrastructures,',
    'computational design, and',
    'human–computer interaction. As an',
    'architect, media artist, and HCI',
    'researcher, they build embodied',
    'systems that surface the hidden',
    'temporal and material logics of machine',
    'reasoning—reframing how humans',
    'understand, negotiate, and intervene in',
    'algorithmic processes.'
  ];
  const text = lines.join(' ');
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const smooth = n => {n = clamp(n); return n * n * (3 - 2 * n);};
  // The uneven cadence follows the source, with room for a readable final hold.
  const reveal = [[4.97, 0], [5.5, 1], [6, 3], [6.5, 6], [7, 9], [8, 15],
    [9, 21], [10, 27], [11, 31], [17.23, 69], [27.6, 134], [37.93, 202],
    [48.3, 267], [58.63, 333], [68.8, text.length]];
  const glyphs = [];
  // Sample by distance instead of angle: letters stay apart at the waist.
  // A single unbroken ribbon also avoids the rigid, stacked-ring appearance.
  const turns = 8.35, steps = 5000, letterSpacing = 43 / 3;
  let previous = null, travelled = 0, letter = text.indexOf('embodied');
  for (let step = 0; step <= steps; step++) {
    const v = step / steps, y = (v - .5) * 410;
    const radius = 17 + 218 * Math.pow(Math.abs(v * 2 - 1), .92);
    const angle = v * Math.PI * 2 * turns + .38;
    const p = {x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius};
    if (previous) travelled += Math.hypot(p.x - previous.x, p.y - previous.y, p.z - previous.z);
    if (!previous || travelled >= letterSpacing) {
      glyphs.push({char: text[letter++ % text.length], angle, radius, y, v,
        phase: glyphs.length * 1.61803398875});
      travelled = 0;
    }
    previous = p;
  }

  // Rasterize each distinct letter once. The denser ribbon can then move using
  // image transforms instead of re-rasterizing hundreds of font glyphs a frame.
  const sprites = new Map();
  function glyphSprite(char, size, sculptureLetter = false) {
    const key = `${size}:${char}:${sculptureLetter}`;
    if (sprites.has(key)) return sprites.get(key);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', {willReadFrequently: !sculptureLetter});
    const font = `${sculptureLetter ? 600 : 500} ${size}px ${FONT}`;
    ctx.font = font;
    ctx.textAlign = sculptureLetter ? 'center' : 'left';
    ctx.textBaseline = sculptureLetter ? 'middle' : 'alphabetic';
    const m = ctx.measureText(char);
    const left = Math.floor(-m.actualBoundingBoxLeft) - 2;
    const top = Math.floor(-m.actualBoundingBoxAscent) - 2;
    const w = Math.max(1, Math.ceil(m.actualBoundingBoxRight) - left + 2);
    const h = Math.max(1, Math.ceil(m.actualBoundingBoxDescent) - top + 2);
    canvas.width = w * 2; canvas.height = h * 2;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.font = font; ctx.fillStyle = '#fff';
    ctx.textAlign = sculptureLetter ? 'center' : 'left';
    ctx.textBaseline = sculptureLetter ? 'middle' : 'alphabetic';
    ctx.fillText(char, -left, -top);
    const points = [], chips = [];
    let inkMask = null;
    if (!sculptureLetter && char !== ' ') {
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let y = 3; y < canvas.height; y += 6) {
        for (let x = 3; x < canvas.width; x += 6) {
          if (pixels[(y * canvas.width + x) * 4 + 3] > 130)
            points.push({x: left + x / 2, y: top + y / 2});
        }
      }
      // Cache only real ink fragments. Hover erodes these small pieces of the
      // letter itself, never a circular or elliptical patch over the panel.
      for (let y = 0; y < canvas.height; y += 8) for (let x = 0; x < canvas.width; x += 8) {
        const sw = Math.min(8, canvas.width - x), sh = Math.min(8, canvas.height - y);
        let point = null;
        for (let dy = 1; dy < sh; dy += 2) for (let dx = 1; dx < sw; dx += 2) {
          if (pixels[((y + dy) * canvas.width + x + dx) * 4 + 3] > 130)
            point = {x: left + (x + dx) / 2, y: top + (y + dy) / 2};
        }
        if (point) chips.push({sx:x, sy:y, sw, sh, x:left + x / 2, y:top + y / 2,
          w:sw / 2, h:sh / 2, point});
      }
      inkMask = document.createElement('canvas');
      inkMask.width = canvas.width; inkMask.height = canvas.height;
      const mask = inkMask.getContext('2d');
      mask.drawImage(canvas, 0, 0); mask.globalCompositeOperation = 'source-in';
      mask.fillStyle = '#000'; mask.fillRect(0, 0, canvas.width, canvas.height);
    }
    const sprite = {canvas, left, top, w, h, points, chips, inkMask};
    sprites.set(key, sprite); return sprite;
  }
  const sculptureItems = glyphs.filter(g => g.char !== ' ').map((g, index) => {
    // A fixed rhythm of sizes, rather than new randomness every frame. The
    // centers stay on the same helix and the narrow waist gets smaller type.
    const waist = Math.abs(g.v * 2 - 1);
    const rhythm = .96 + .20 * Math.sin(index * .39) + .085 * Math.sin(index * 1.73 + .8);
    const fontScale = clamp(rhythm * (.82 + .18 * Math.sqrt(waist)), .66, 1.23);
    return {g, sprite:glyphSprite(g.char, 43, true), fontScale,
      angle:0, scale:1, depth:0, x:0, y:0, z:0, a:1, b:0, c:0, d:1, tx:0, ty:0};
  });
  const fontRange = {min:Math.min(...sculptureItems.map(p => p.fontScale * 43)),
    max:Math.max(...sculptureItems.map(p => p.fontScale * 43))};
  // Keep references before depth-sorting: these are the spatial ends of the
  // spiral, never whichever letters happen to be nearest the camera.
  const ends = [sculptureItems.slice(0, 2), sculptureItems.slice(-6)];
  function fraction(n) {return n - Math.floor(n);}
  const seeded = n => fraction(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  function grainPoints(sprite) {
    if (sprite.points.length) return sprite.points;
    const pixels = sprite.canvas.getContext('2d').getImageData(0, 0, sprite.canvas.width, sprite.canvas.height).data;
    for (let y = 2; y < sprite.canvas.height; y += 5) for (let x = 2; x < sprite.canvas.width; x += 5) {
      if (pixels[(y * sprite.canvas.width + x) * 4 + 3] > 130)
        sprite.points.push({x:sprite.left + x / 2, y:sprite.top + y / 2});
    }
    return sprite.points;
  }
  const endTrails = ends.map((anchors, end) => ({
    end, anchors,
    letters:Array.from({length:end === 0 ? 6 : 18}, (_, i) => ({kind:'letter', anchor:anchors[i % anchors.length], phase:i / (end === 0 ? 6 : 18),
      seed:seeded(i + end * 41)})),
    grains:Array.from({length:end === 0 ? 192 : 144}, (_, i) => {
      const anchor = anchors[i % anchors.length], points = grainPoints(anchor.sprite);
      return {kind:'grain', anchor, point:points[Math.floor(seeded(i + 17) * points.length)] || {x:0,y:0},
        phase:i / (end === 0 ? 192 : 144), seed:seeded(i + end * 101), size:1.4 + seeded(i + 53) * 1.7};
    })
  }));
  const tailState = {active:false, letters:0, grains:0,
    ends:[{x:0,y:0,direction:1,flowX:0,flowY:0,path:[]},
      {x:0,y:0,direction:1,flowX:0,flowY:0,path:[]}]};
  const drawItems = [], tailArc = 1.05;
  const tangentSample = {};
  function edgeOpacity(x, y) {
    return smooth((x - 5) / 24) * smooth((width - 5 - x) / 24) *
      smooth((y - 5) / 24) * smooth((height - 5 - y) / 24);
  }
  function sculptureFrame(time, pointer, dissolve) {
    const px = clamp(pointer?.px ?? pointer?.x ?? 0, -1, 1), py = clamp(pointer?.py ?? pointer?.y ?? 0, -1, 1);
    const ax = .18 + Math.sin(time * 1.01) * .34 + Math.sin(time * 1.7) * .05 + py * .10;
    const az = Math.sin(time * .72) * .17 + px * .06;
    return {time, px, py, dissolve, az, sx:Math.sin(ax), cx:Math.cos(ax),
      sz:Math.sin(az), cz:Math.cos(az),
      driftX:Math.sin(time * .64) * 7 + px * 19,
      driftY:Math.sin(time * .81) * 5 + py * 10};
  }
  // The body and its fading echoes share one 3D projection. Advancing angle
  // before projection preserves the orbit, perspective and facing at every view.
  function projectGlyph(p, scene, angleOffset = 0, expansion = 0, out = p, lift = 0) {
    const {time, px, dissolve, az, sx, cx, sz, cz, driftX, driftY} = scene;
    const g = p.g, waist = Math.abs(g.v * 2 - 1);
    const flow = time * (1.08 + .16 * (g.v - .5));
    const twist = Math.sin(time * 1.16 + g.v * 6.1) * .13;
    const angle = g.angle + flow + twist + px * .30 + angleOffset;
    const breath = 1 + Math.sin(time * 1.45 + g.v * 4.2) * .038;
    const radius = g.radius * breath + Math.sin(angle * 3 + time * 1.2) * (2 + waist * 3) + expansion;
    const ripple = Math.sin(angle * 1.7 + time * 1.7 + g.phase * .04) * (2 + waist * 4);
    const unravel = smooth(dissolve) * (17 + 27 * waist);
    const x = Math.cos(angle) * (radius + unravel);
    const y = g.y + ripple + Math.sin(g.phase) * dissolve * 10 - lift;
    const z = Math.sin(angle) * radius;
    const y1 = y * cx - z * sx, z1 = y * sx + z * cx;
    const rotatedX = x * cz - y1 * sz, rotatedY = x * sz + y1 * cz;
    out.angle = angle; out.scale = 1500 / (1500 - z1);
    out.depth = clamp((z1 + 300) / 600);
    out.x = 560 + driftX + rotatedX * out.scale;
    out.y = 352 + driftY + rotatedY * out.scale - dissolve * (12 + 9 * Math.cos(g.phase));
    out.z = z1;
    const settle = .018 * Math.sin(time * 1.8 + g.phase);
    const side = .54 + .46 * Math.abs(Math.sin(angle));
    const turn = az + Math.cos(angle) * .13 + settle;
    const ct = Math.cos(turn), st = Math.sin(turn), factor = p.fontScale;
    const a = out.scale * side, b = Math.cos(angle) * .075 * out.scale;
    const c = -sx * Math.cos(angle) * .12, d = out.scale;
    out.a = (ct * a - st * b) * factor;out.b = (st * a + ct * b) * factor;
    out.c = (ct * c - st * d) * factor;out.d = (st * c + ct * d) * factor;
    return out;
  }
  function projectUpperTail(anchor, scene, age, out) {
    // Follow the letter's real motion, including tilt and breathing. Then open
    // away from the upper rim in model space: an angular offset alone runs
    // straight into the next letters of the descending first turn.
    const future = sculptureFrame(scene.time + age * .58, scene, scene.dissolve);
    const separation = age * age;
    return projectGlyph(anchor,future,0,separation * 70,out,separation * 64);
  }
  function endpointTrails(scene) {
    tailState.active = true;
    for (const trail of endTrails) {
      const endpoint = trail.anchors[trail.end === 0 ? 0 : trail.anchors.length - 1];
      const state = tailState.ends[trail.end];
      state.x = endpoint.x;state.y = endpoint.y;
      const upper = trail.end === 0;
      if (upper) projectUpperTail(endpoint,scene,.002,tangentSample);
      else projectGlyph(endpoint,scene,.002,0,tangentSample);
      state.flowX = (tangentSample.x - endpoint.x) / .002;
      state.flowY = (tangentSample.y - endpoint.y) / .002;
      for (let i = 0; i <= 5; i++) {
        const age = i / 5, sample = state.path[i] || (state.path[i] = {});
        if (upper) projectUpperTail(endpoint,scene,age,sample);
        else projectGlyph(endpoint,scene,age * tailArc,age * age * 28,sample);
      }
      // Both ends turn with the letters; the upper mouth releases outward
      // before its first turn. Analytical ages preserve seeking and looping.
      for (const echo of trail.letters) {
        const age = fraction(scene.time * .67 + echo.phase);
        const fade = upper ? smooth(age / .045) * (1 - smooth((age - .06) / .32)) :
          smooth(age / .07) * (1 - smooth((age - .36) / .44));
        if (fade < .005) continue;
        if (upper) projectUpperTail(echo.anchor,scene,age,echo);
        else projectGlyph(echo.anchor,scene,age * tailArc,age * age * 28,echo);
        echo.shrink = upper ? .86 - age * .70 : .96 - age * .44;
        echo.alpha = fade * (upper ? .32 : .76) * edgeOpacity(echo.x,echo.y);
        drawItems.push(echo);tailState.letters++;
      }
      for (const grain of trail.grains) {
        const age = fraction(scene.time * .67 + grain.phase), spread = age * age;
        const fade = smooth(age / .12) * (1 - smooth((age - .50) / .50));
        if (fade < .02) continue;
        if (upper) projectUpperTail(grain.anchor,scene,age,grain);
        else projectGlyph(grain.anchor,scene,age * tailArc,spread * 28,grain);
        // Sampled ink and dispersion stay in the glyph's local plane so the
        // fragments turn and foreshorten with the letter that released them.
        const localX = grain.point.x * (1 - age * .46) + Math.sin(grain.seed * 12 + age * 5) * spread * 24;
        const localY = grain.point.y * (1 - age * .46) + (grain.seed - .5) * spread * 30;
        grain.x += grain.a * localX + grain.c * localY;
        grain.y += grain.b * localX + grain.d * localY;
        grain.alpha = fade * .82 * edgeOpacity(grain.x,grain.y);
        grain.drawSize = grain.size * grain.scale * (1 - age * .32);
        drawItems.push(grain);tailState.grains++;
      }
    }
  }
  function sculpture(ctx, time, pointer, opacity = 1, dissolve = 0) {
    const scene = sculptureFrame(time,pointer,dissolve);
    drawItems.length = 0;
    for (const p of sculptureItems) {
      projectGlyph(p,scene);
      drawItems.push(p);
    }
    if (opacity > .001) endpointTrails(scene);
    // Far-side echoes sit behind nearer letters instead of floating over the
    // whole sculpture when the endpoints rotate through the back of the orbit.
    drawItems.sort((a,b) => a.z - b.z);
    const alpha = ctx.globalAlpha;
    ctx.fillStyle = '#fff';
    for (const p of drawItems) {
      ctx.globalAlpha = alpha * opacity * (.58 + .42 * p.depth) * (p.alpha ?? 1);
      if (p.kind === 'grain') {
        ctx.fillRect(p.x,p.y,p.drawSize,p.drawSize);
      } else {
        const s = p.sprite || p.anchor.sprite, shrink = p.shrink ?? 1;
        ctx.save();
        ctx.transform(p.a * shrink,p.b * shrink,p.c * shrink,p.d * shrink,p.x,p.y);
        ctx.drawImage(s.canvas,s.left,s.top,s.w,s.h);
        ctx.restore();
      }
    }
    ctx.globalAlpha = alpha;
  }

  let layout = null;
  function textLayout(ctx) {
    if (layout) return layout;
    ctx.font = `500 54px ${FONT}`;
    const result = []; let index = 0;
    for (let row = 0; row < lines.length; row++) {
      const line = lines[row], fit = Math.min(1, 1025 / ctx.measureText(line).width);
      for (let column = 0; column < line.length; column++) {
        const g = {char: line[column], index: index + column,
          x: 14 + ctx.measureText(line.slice(0, column)).width * fit,
          y: 49 + row * 60.6, fit, sprite: glyphSprite(line[column], 54)};
        g.chips = g.sprite.chips.map((chip, part) => ({...chip, glyph:g,
          x:g.x + chip.x * fit, y:g.y + chip.y,
          emitX:g.x + chip.point.x * fit, emitY:g.y + chip.point.y,
          seed:seeded(g.index * 97 + part), damage:0, target:0, touched:0, active:false}));
        result.push(g);
      }
      index += line.length + 1;
    }
    layout = result;
    return result;
  }
  function revealPosition(time) {
    const absolute = 4.97 + clamp((time - typingStart) / (typingEnd - typingStart)) * (68.8 - 4.97);
    for (let i = 1; i < reveal.length; i++) {
      if (absolute <= reveal[i][0]) {
        const [a, start] = reveal[i - 1], [b, end] = reveal[i];
        return start + (end - start) * clamp((absolute - a) / (b - a));
      }
    }
    return text.length;
  }
  const textLayer = document.createElement('canvas');
  textLayer.width = width * 2; textLayer.height = height * 2;
  const textContext = textLayer.getContext('2d');
  textContext.setTransform(2, 0, 0, 2, 0, 0);
  const backdropLayer = document.createElement('canvas');
  backdropLayer.width = width * 2;backdropLayer.height = height * 2;
  const backdropContext = backdropLayer.getContext('2d');
  backdropContext.setTransform(2,0,0,2,0,0);
  const backdropOpacity = .10;
  const particleInkStep = (1 - backdropOpacity) / 2;
  let backdropReady = false;
  let textLayerReady = false;
  const textState = {active:false,backdropOpacity:0,count:0};
  let paintedThrough = -1;
  const dust = {particles: [], candidates: [], cuts: [], strength: 0, active: false,
    x: 0, y: 0, radius: 65, lastX: NaN, lastY: NaN,
    vx: 0, vy: 0, directionX: .984, directionY: -.178, speed: 0,
    lastSeconds: null, emission: 0, serial: 0, frame: 0};
  const maxDust = 260, maxCuts = 900;

  function clearDust() {
    for (const chip of dust.cuts) {chip.damage = chip.target = 0; chip.active = false;}
    dust.particles.length = dust.candidates.length = dust.cuts.length = 0;
    dust.strength = 0; dust.active = false; dust.emission = 0;
    dust.lastSeconds = null; dust.lastX = dust.lastY = NaN;
    dust.vx = dust.vy = dust.speed = 0;
    dust.directionX = .984; dust.directionY = -.178;
  }
  function drawGlyph(ctx, g, offset = 0) {
    const s = g.sprite;
    ctx.drawImage(s.canvas, g.x + s.left * g.fit, g.y + s.top + offset,
      s.w * g.fit, s.h);
  }
  function prepare() {
    const positions = textLayout(textContext);
    if (!backdropReady) {
      for (const g of positions) if (g.char !== ' ') drawGlyph(backdropContext, g);
      backdropReady = true;
    }
    return positions;
  }
  function resetTextLayer() {
    textContext.clearRect(0, 0, width, height);
    textContext.globalAlpha = backdropOpacity;
    textContext.drawImage(backdropLayer, 0, 0, width, height);
    textContext.globalAlpha = 1;
    paintedThrough = -1; textLayerReady = true;
  }
  function biography(ctx, time, complete, opacity = 1) {
    const positions = prepare(), count = complete ? text.length : revealPosition(time);
    textState.active = true;textState.backdropOpacity = complete ? 0 : backdropOpacity;
    textState.count = count;
    const stable = complete || count === text.length ? text.length : Math.max(-1, Math.floor(count - 1.4));
    if (!textLayerReady || stable < paintedThrough) resetTextLayer();
    if (!complete && stable > paintedThrough) {
      textContext.save();
      textContext.globalCompositeOperation = 'lighter';
      textContext.globalAlpha = 1 - backdropOpacity;
      for (const g of positions) {
        if (g.index <= paintedThrough || g.index > stable || g.char === ' ') continue;
        drawGlyph(textContext, g);
      }
      textContext.restore();
      paintedThrough = stable;
    }
    const alpha = ctx.globalAlpha;
    ctx.save();
    // Backdrop and settled ink share one cached surface: a single full-panel
    // copy per frame, retaining the 10% backdrop and 90% foreground brightness.
    ctx.globalAlpha = alpha * opacity;
    ctx.drawImage(complete ? backdropLayer : textLayer, 0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    // Only the newly arriving letters need repainting; settled text is cached.
    for (const g of positions) {
      if (complete || g.index <= stable || g.index > count || g.char === ' ') continue;
      const age = count - g.index, eased = complete || count === text.length ? 1 : smooth(age / 1.4);
      ctx.globalAlpha = alpha * opacity * (1 - backdropOpacity) * eased;
      drawGlyph(ctx, g);
    }
    ctx.restore();
    if (!complete && count < text.length - 1) {
      const cursor = positions.find(g => g.index > count && g.char !== ' ');
      if (cursor) {
        ctx.globalAlpha = alpha * opacity * (.50 + .18 * Math.sin(time * 7));
        ctx.fillRect(cursor.x - 3,cursor.y - 40,1.7,43);
      }
    }
    ctx.globalAlpha = alpha;
    return {positions,count,visibleCount:text.length,backdropOpacity:complete ? 0 : backdropOpacity};
  }

  // A narrow, uneven current follows the gesture. The envelope only chooses
  // ink fragments; it is never drawn as a mask, so no geometric hole appears.
  function windAt(x, y, seed, seconds, movement) {
    const dx = x - dust.x, dy = y - dust.y;
    const along = dx * dust.directionX + dy * dust.directionY;
    const across = dy * dust.directionX - dx * dust.directionY;
    const trail = dust.radius * (1.05 + movement * .42), lead = dust.radius * .38;
    const stream = smooth((along + trail) / (trail * .76)) *
      (1 - smooth((along - lead * .08) / (lead * .92)));
    if (stream < .005) return 0;
    const bend = Math.sin(along * .037 + seconds * .73) * 4.5;
    const feather = 1 - smooth(Math.abs(across - bend - (seed - .5) * 11) /
      (dust.radius * (.28 + movement * .06)));
    // Each fragment has a different susceptibility and breathing phase. This
    // breaks up the contour while retaining ink through the center of a hover.
    return stream * feather * feather * (.48 + seed * .42) *
      (.83 + .17 * Math.sin(seed * 19 + seconds * 1.9 + along * .045));
  }
  function dissolveText(ctx, seconds, subtitle, pointer, opacity) {
    let delta = dust.lastSeconds === null ? 0 : seconds - dust.lastSeconds;
    if (delta < 0 || delta > .2) {clearDust(); delta = 0;}
    dust.lastSeconds = seconds; delta = clamp(delta, 0, .2);
    const wasActive = dust.active;
    dust.active = !!pointer?.active;
    if (dust.active) {
      dust.x = pointer.x; dust.y = pointer.y;
      dust.radius = clamp(pointer.radius || 65, 48, 105);
    }
    const follow = 1 - Math.exp(-delta * 10);
    const moving = dust.active && wasActive && delta > 0 && Number.isFinite(dust.lastX);
    const vx = moving ? clamp((dust.x - dust.lastX) / delta, -1600, 1600) : 0;
    const vy = moving ? clamp((dust.y - dust.lastY) / delta, -1600, 1600) : 0;
    dust.vx += (vx - dust.vx) * follow; dust.vy += (vy - dust.vy) * follow;
    dust.speed = Math.hypot(dust.vx, dust.vy);
    if (dust.speed > 24) {
      const steer = 1 - Math.exp(-delta * 7);
      const heading = Math.atan2(dust.directionY, dust.directionX);
      const desired = Math.atan2(dust.vy, dust.vx);
      // Interpolate the angle, not normalized opposing vectors: even an exact
      // horizontal reversal must turn smoothly instead of locking its heading.
      const turn = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
      const next = heading + turn * steer;
      dust.directionX = Math.cos(next); dust.directionY = Math.sin(next);
    }
    dust.lastX = dust.active ? dust.x : NaN; dust.lastY = dust.active ? dust.y : NaN;
    dust.strength += ((dust.active ? 1 : 0) - dust.strength) *
      (1 - Math.exp(-delta * (dust.active ? 10 : 8)));
    if (!dust.active && dust.strength < .005) dust.strength = 0;
    const movement = clamp(dust.speed / 580), reach = dust.radius * 1.6;
    const frame = ++dust.frame;
    dust.candidates.length = 0;
    if (dust.active) for (const g of subtitle.positions) {
      if (g.char === ' ') continue;
      const s = g.sprite;
      if (g.x + s.left * g.fit > dust.x + reach || g.x + (s.left + s.w) * g.fit < dust.x - reach ||
        g.y + s.top > dust.y + reach || g.y + s.top + s.h < dust.y - reach) continue;
      for (const chip of g.chips) {
        const influence = windAt(chip.emitX, chip.emitY, chip.seed, seconds, movement);
        if (influence < .025) continue;
        chip.target = influence * dust.strength * (.46 + movement * .35);
        chip.touched = frame;
        if (!chip.active) {
          if (dust.cuts.length >= maxCuts) continue;
          chip.active = true; dust.cuts.push(chip);
        }
        dust.candidates.push(chip);
      }
    }
    const alpha = ctx.globalAlpha;
    let cutsAlive = 0;
    for (const chip of dust.cuts) {
      const target = chip.touched === frame ? chip.target : 0;
      chip.damage += (target - chip.damage) * (1 - Math.exp(-delta * (target > chip.damage ? 12 : 7)));
      if (chip.damage < .003 && target === 0) {chip.damage = 0; chip.active = false; continue;}
      dust.cuts[cutsAlive++] = chip;
      const g = chip.glyph;
      ctx.globalAlpha = alpha * chip.damage;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(g.sprite.inkMask, chip.sx, chip.sy, chip.sw, chip.sh,
        chip.x, chip.y, chip.w * g.fit, chip.h);
    }
    ctx.globalCompositeOperation = 'source-over';
    dust.cuts.length = cutsAlive; ctx.globalAlpha = alpha;
    // Fragments inherit the current's heading and speed, never a vector away
    // from the cursor. A resting cursor keeps a sparse, gentle stream alive.
    if (dust.active && dust.candidates.length && dust.strength > .05) {
      dust.emission += delta * Math.min(210, dust.candidates.length * (1.1 + movement * .9)) * dust.strength;
      while (dust.emission >= 1 && dust.particles.length < maxDust) {
        dust.emission--;
        const n = ++dust.serial, seed = seeded(n);
        const chip = dust.candidates[Math.floor((n * .61803398875 % 1) * dust.candidates.length)];
        if (seed > .60 + chip.target * 1.6) continue;
        const ink = subtitle.backdropOpacity + (1 - subtitle.backdropOpacity) *
          smooth((subtitle.count - chip.glyph.index) / 1.4);
        const speed = 38 + seed * 38 + Math.min(dust.speed, 650) * .13;
        dust.particles.push({x:chip.emitX, y:chip.emitY, age:0, life:.78 + seed * .40,
          vx:dust.directionX * speed, vy:dust.directionY * speed - 3,
          sideX:-dust.directionY, sideY:dust.directionX,
          seed, inkBucket:Math.round((ink - backdropOpacity) / particleInkStep), size:1.4 + seed * 1.35});
      }
      if (dust.particles.length >= maxDust) dust.emission = 0;
    } else dust.emission = 0;
    let alive = 0;
    for (const p of dust.particles) {
      p.age += delta;
      if (p.age >= p.life) continue;
      dust.particles[alive++] = p;
    }
    dust.particles.length = alive;
    ctx.fillStyle = '#fff';
    for (let ink = 0; ink < 3; ink++) for (let bucket = 0; bucket < 3; bucket++) {
      ctx.beginPath();
      for (const p of dust.particles) {
        const life = p.age / p.life;
        if (p.inkBucket !== ink || Math.min(2, Math.floor((1 - life) * 3)) !== bucket) continue;
        const travel = p.age * (1 - life * .22);
        const curl = Math.sin(p.age * 4.6 + p.seed * 6) * p.age * 6;
        const x = p.x + p.vx * travel + p.sideX * curl;
        const y = p.y + p.vy * travel + p.sideY * curl;
        ctx.rect(x, y, p.size * (1 - life * .25), p.size * (1 - life * .25));
      }
      ctx.globalAlpha = alpha * opacity * (.20 + bucket * .32) * (backdropOpacity + ink * particleInkStep);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
  }

  function draw(ctx, seconds, options = {}) {
    const time = ((seconds % duration) + duration) % duration;
    tailState.active = false;tailState.letters = tailState.grains = 0;
    textState.active = false;textState.backdropOpacity = 0;textState.count = 0;
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    const fieldMix = smooth((time - 4.70) / .92) * (1 - smooth((time - loopStart) / .85));
    field?.draw(seconds, {mix: options.reducedMotion ? 1 : fieldMix,
      pointer:options.textPointer, reducedMotion:options.reducedMotion,
      pixelWidth:ctx.canvas.width, pixelHeight:ctx.canvas.height});
    ctx.fillStyle = '#fff';
    if (options.reducedMotion) {clearDust(); biography(ctx, time, true);}
    else {
      if (time < sculptureDuration) {
        clearDust();
        const dissolve = smooth((time - 4.60) / (sculptureDuration - 4.60));
        sculpture(ctx, time, options.pointer, 1 - dissolve, dissolve);
      }
      if (time >= sculptureDuration) {
        const entrance = smooth((time - sculptureDuration) / .42);
        const exit = 1 - smooth((time - loopStart) / .65);
        const subtitle = biography(ctx, time, false, entrance * exit);
        if (time >= sculptureDuration && time < loopStart)
          dissolveText(ctx, seconds, subtitle, options.textPointer, entrance * exit);
        else clearDust();
      }
      if (time > loopStart) {
        // Continue the same sculpture clock across the loop boundary.
        sculpture(ctx, time - duration, options.pointer, smooth((time - loopStart) / (duration - loopStart)));
      }
    }
    ctx.restore();
  }
  window.SongDongBottom = {draw, prepare, initialize, duration, width, height, lines,
    reset() {clearDust(); field?.reset();},
    dispose() {clearDust();field?.dispose();field=null;},
    get debug() {return {glyphCount: glyphs.length, visibleGlyphs: sculptureItems.length,
      letterSpacing, densityFactor: 43 / letterSpacing, dustLimit: maxDust,
      fontRange:{...fontRange}, endpointTails:{active:tailState.active,letters:tailState.letters,
        grains:tailState.grains,ends:tailState.ends.map(p => ({...p,path:p.path.map(point => ({...point}))}))},
      typewriter:{...textState,start:typingStart},
      hoverActive: dust.active, hoverStrength: dust.strength,
      particles: dust.particles.length, samples: dust.candidates.length,
      wind:{cuts:dust.cuts.length,cutLimit:maxCuts,speed:dust.speed,directionX:dust.directionX,directionY:dust.directionY},
      pointer: {x: dust.x, y: dust.y, radius: dust.radius}, background:field?.debug};}
  };
})();
