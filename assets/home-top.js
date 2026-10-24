/*
 * Homepage / upper animation.
 * The text, dots and flicker are drawn from glyphs at runtime: no GIF frames,
 * image textures or animation libraries are used; type is a local serif font.
 * Times follow the original 8.83-second loop; change TEXT to edit the headline.
 */
(async function () {
  'use strict';
  // Resolve the local face before caching glyphs and their particle samples.
  await window.SongDongFontsReady;

  const WIDTH = 1072;
  const HEIGHT = 164;
  const DURATION = 8.83;
  const TEXT = 'LISTENING TO THE RHYTHMS OF MACHINES THINKING';
  const FONT = '"Bodoni Moda", Georgia, serif';
  const glyphs = new Map();
  let dots;

  const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
  const smooth = n => {const x = clamp(n, 0, 1); return x * x * (3 - 2 * x);};
  let pointer = {x: 0, y: 0};
  function noise(a, b) {
    let n = Math.imul(a + 11, 374761393) ^ Math.imul(b + 29, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  const letterMotion = [...TEXT].map((_, i) => ({
    phase: noise(i, 901) * Math.PI * 2, density: noise(i, 73)
  }));

  function glyph(character, bold) {
    const key = character + (bold ? ':bold' : ':regular');
    if (glyphs.has(key)) return glyphs.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 120;
    const pen = canvas.getContext('2d');
    pen.scale(2, 2);
    pen.fillStyle = '#fff';
    pen.font = `${bold ? '600' : '500'} 36px ${FONT}`;
    pen.textAlign = 'center';
    pen.textBaseline = 'alphabetic';
    pen.fillText(character, 32, 44);
    glyphs.set(key, canvas);
    return canvas;
  }

  function drawLetter(ctx, character, x, y, bold, scaleX) {
    if (character === ' ') return;
    const source = glyph(character, bold);
    ctx.drawImage(source, x - 32 * scaleX, y, 64 * scaleX, 60);
  }

  function makeDots() {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const pen = canvas.getContext('2d', { willReadFrequently: true });
    for (let i = 0; i < TEXT.length; i += 1) {
      drawLetter(pen, TEXT[i], 220 + i * 14.42, 50, false, 0.55);
    }
    const pixels = pen.getImageData(0, 0, WIDTH, HEIGHT).data;
    const points = [];
    for (let y = 66; y < 96; y += 2) {
      for (let x = 211; x < 866; x += 2) {
        const alpha = pixels[(y * WIDTH + x) * 4 + 3];
        if (alpha > 30) {
          const seed = noise(points.length, 47);
          points.push({ x, y, seed, phase: seed * Math.PI * 2 });
        }
      }
    }
    return points;
  }

  function drawDots(ctx, time, opacity = 1) {
    if (!dots) dots = makeDots();
    const progress = clamp(time / 2.47, 0, 1);
    const rise = 1 - Math.exp(-2.05 * time);
    const density = 0.09 + progress * 0.91;
    for (const dot of dots) {
      const {seed, phase} = dot;
      const flow = (1 - smooth(progress)) * 12;
      const x = dot.x + Math.sin(time * 3 + phase) * flow + pointer.x * 3;
      const y = 94 - (94 - dot.y) * rise + Math.cos(time * 2.4 + phase) * flow * .7 + pointer.y * 2;
      const shimmer = .68 + .32 * Math.sin(time * 8 + phase);
      ctx.globalAlpha = opacity * smooth((density - seed + .2) / .35) * shimmer;
      ctx.fillRect(x, y, 1.1, 1.5);
    }
    ctx.globalAlpha = 1;
  }

  function drawFlicker(ctx, time, opacity = 1) {
    const progress = clamp((time - 2.47) / 2.66, 0, 1);
    const density = 0.09 + Math.pow(progress, 0.85) * 0.91;
    const tick = Math.floor(time * 24);
    for (let i = 0; i < TEXT.length; i += 1) {
      const {phase, density: letterDensity} = letterMotion[i];
      const shimmer = .5 + .5 * Math.sin(time * 13 + phase);
      ctx.globalAlpha = opacity * smooth((density - letterDensity + .24) / .32) * (progress + (1 - progress) * shimmer);
      const jitter = Math.sin(time * 5 + phase) * 5 * (1 - progress);
      drawLetter(ctx, TEXT[i], 29 + i * 23.05 + pointer.x * 3, 50 + jitter + pointer.y * 2, true, 0.68);
    }
    // Fine dark scan lines give the flickering letters their original texture.
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.18 * opacity;
    for (let y = 67 + (tick % 2); y < 97; y += 4) ctx.fillRect(16, y, 1040, 0.75);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
  }

  function drawPhrase(ctx, spacing, center, time = 0) {
    const left = center - (TEXT.length - 1) * spacing / 2;
    for (let i = 0; i < TEXT.length; i += 1) {
      const drift = time ? Math.sin(time * 1.7 + i * .22) * .65 : 0;
      drawLetter(ctx, TEXT[i], left + i * spacing + pointer.x * 3, 50 + drift + pointer.y * 2, false, 0.68);
    }
  }

  function draw(ctx, timeSeconds, options) {
    const reducedMotion = Boolean(options && options.reducedMotion);
    pointer = reducedMotion ? {x: 0, y: 0} : (options && options.pointer) || {x: 0, y: 0};
    const time = ((Number(timeSeconds) || 0) % DURATION + DURATION) % DURATION;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#fff';
    if (reducedMotion) {
      drawPhrase(ctx, 23.05, 536.1);
    } else if (time > 0.07 && time < 2.7) {
      const blend = smooth((time - 2.15) / .55);
      drawDots(ctx, time, 1 - blend);
      if (blend) drawFlicker(ctx, time, blend);
    } else if (time >= 2.7 && time < 5.32) {
      const blend = smooth((time - 4.95) / .37);
      drawFlicker(ctx, time, 1 - blend);
      ctx.globalAlpha = blend; drawPhrase(ctx, 23.05, 536.1, time); ctx.globalAlpha = 1;
    } else if (time >= 5.32 && time < 7.03) {
      drawPhrase(ctx, 23.05, 536.1, time);
    } else if (time >= 7.03 && time < 8.5) {
      const progress = clamp((time - 7.03) / 1.39, 0, 1);
      ctx.globalAlpha = 1 - smooth((progress - .85) / .15);
      drawPhrase(ctx, 23.05 * (1 - smooth(progress)), 536.1 + 12 * progress, time);
    }
    ctx.restore();
  }

  function prepare() {
    if (!dots) dots = makeDots();
    for (const character of new Set(TEXT)) if (character !== ' ') glyph(character, true);
  }
  window.SongDongTop = Object.freeze({ draw, prepare, duration: DURATION, width: WIDTH, height: HEIGHT, text: TEXT });
}());
