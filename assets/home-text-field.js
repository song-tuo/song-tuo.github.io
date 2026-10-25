/* Original rendering of two observed motion behaviours: orbiting type that
   resolves into dots, and a fine character field with sparse flips and ripples.
   One instanced GPU draw per layer; a 2D fallback keeps the scene usable. */
(() => {
  'use strict';
  const chars = ' .ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+*#@–';
  const orbitText = 'LISTENING TO THE RHYTHMS OF MACHINES THINKING . SONG DONG . ';
  const fieldText = 'SONG DONG . INTERDISCIPLINARY DESIGN . AI PERCEPTUAL INFRASTRUCTURES . ' +
    'COMPUTATIONAL DESIGN . HUMAN COMPUTER INTERACTION . EMBODIED SYSTEMS . ' +
    'TEMPORAL AND MATERIAL LOGICS . MACHINE REASONING . UNDERSTAND NEGOTIATE INTERVENE . ';
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => {n = clamp(n); return n * n * (3 - 2 * n);};
  const hash = n => {const x = Math.sin(n * 73.13 + 19.1) * 14371.71; return x - Math.floor(x);};
  const index = c => Math.max(0, chars.indexOf(c));
  const vertex = `#version 300 es
  precision highp float;
  layout(location=0) in vec2 corner;
  layout(location=1) in vec4 placement;
  layout(location=2) in vec4 detail;
  uniform vec2 viewport;
  uniform float clock;
  uniform float orbitClock;
  uniform float layer;
  uniform float opacity;
  uniform float motion;
  uniform vec4 cursor;
  uniform vec4 gesture;
  uniform vec4 pulse;
  out vec2 texcoord;
  out float ink;
  float noise(float v) {return fract(sin(v * 73.13 + 19.1) * 14371.71);}
  void main() {
    float seed = detail.y;
    float glyph = detail.x;
    float angle = 0.0;
    float size = placement.z;
    vec2 center = viewport * vec2(.514, .492);
    vec2 pos = placement.xy;
    float baseInk;
    float dot = 0.0;
    float release = 0.0;
    if (layer < .5) {
      angle = placement.y + orbitClock * detail.w;
      float radius = placement.x * (1.0 - gesture.z * .075);
      pos = center + vec2(cos(angle),sin(angle)) * radius;
      // Broken arcs open and close gradually; point slots keep the orbit legible.
      float arc = sin(angle * 1.6 + detail.z * .66 - clock * .22);
      float breath = sin(detail.z * .72 - clock * .48);
      dot = smoothstep(-.08,.16, arc + breath * .42 + seed * .34);
      baseInk = mix(.22,.44,clamp(radius / 720.0,0.0,1.0));
      // The sculpture floats in front of a quieter center, without a solid disc.
      baseInk *= .42 + .58 * smoothstep(110.0,400.0,length(pos-center));
      angle += 1.5707963;
    } else {
      // Stationary lines and a softly mottled luminous volume, with no rain or
      // scrolling texture. The content remains words except for sparse flips.
      vec2 q = (pos - center) / vec2(420.0,335.0);
      float body = 1.0 - smoothstep(.28,1.65,length(q));
      float relief = sin(q.x * 5.0 + sin(q.y * 4.0) * 1.7) *
        cos(q.y * 5.4 - q.x * 2.4);
      float contour = smoothstep(.12,.72,relief * .5 + .5);
      float twinkle = pow(.5 + .5*sin(clock * .83 + seed * 91.0),18.0) * motion;
      baseInk = .052 + body * contour * (.09 + seed * .13) + twinkle * .10;
      if (twinkle > .36) glyph = 2.0 + floor(noise(seed * 913.0 + floor(clock * 2.4)) * 40.0);
    }
    // A release expands through existing letters. It is made of glyphs, never
    // a separately drawn circle or a mask over the biography.
    float age = clock - pulse.z;
    if (age > 0.0 && age < 1.9 && motion > .5) {
      float r = age * 530.0;
      float d = layer < .5 ? length(pos-center) : distance(pos,pulse.xy);
      float envelope = 1.0 - smoothstep(0.0,100.0,abs(d-r));
      release = envelope * sin(age / 1.9 * 3.1415926);
      release *= .35 + seed * .65;
      if (layer < .5) {dot = max(dot,release); pos += normalize(pos-center) * release * 10.0;}
      else if (release > .24) glyph = 2.0 + floor(noise(seed * 611.0 + floor(clock * 15.0)) * 40.0);
      baseInk += release * .26;
    }
    vec2 fromMouse = pos - cursor.xy;
    float d = length(fromMouse / vec2(1.0,.86));
    float softness = 1.0 - smoothstep(0.0,cursor.z,d);
    float hover = softness * softness * cursor.w;
    // Different thresholds give the local dissolution a porous, feathered edge.
    float dissolve = smoothstep(seed * .62,seed * .62 + .18,hover);
    if (layer < .5) dot = max(dot,dissolve);
    else {
      baseInk *= 1.0 - dissolve * .97;
      float flip = smoothstep(.035,.34,hover) * (1.0 - dissolve);
      if (flip > .24) glyph = 2.0 + floor(noise(seed * 327.0 + floor(clock * 5.0)) * 40.0);
    }
    if (dot > .5) glyph = 1.0;
    // A tiny amount of drift belongs to dissolving background grains only.
    pos += gesture.xy * dissolve * (seed * 3.5) * motion;
    vec2 local = corner * size;
    vec2 rotated = vec2(local.x*cos(angle)-local.y*sin(angle),
      local.x*sin(angle)+local.y*cos(angle));
    vec2 point = (pos + rotated) / viewport;
    gl_Position = vec4(point.x * 2.0 - 1.0, 1.0 - point.y * 2.0, 0.0, 1.0);
    vec2 uv = corner + .5;
    texcoord = (vec2(mod(glyph,8.0),floor(glyph/8.0)) + uv) / 8.0;
    float edge = smoothstep(0.0,32.0,pos.y) * (1.0-smoothstep(viewport.y-32.0,viewport.y,pos.y));
    ink = baseInk * opacity * edge;
  }`;
  const fragment = `#version 300 es
  precision mediump float;
  uniform sampler2D atlas;
  in vec2 texcoord;
  in float ink;
  out vec4 color;
  void main() {color = vec4(vec3(.91,.92,.90),texture(atlas,texcoord).a * ink);}`;

  function makeAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.font = '400 46px "SFMono-Regular", Menlo, Consolas, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    for (let i = 0; i < chars.length; i++) {
      const x = (i % 8 + .5) * 64, y = (Math.floor(i / 8) + .5) * 64;
      if (chars[i] === '.') {ctx.fillRect(x - 1.25, y - 1.25, 2.5, 2.5);}
      else ctx.fillText(chars[i], x, y + 2);
    }
    return canvas;
  }
  function makeGeometry(width, height) {
    const orbit = [], grid = [];
    for (let ring = 0; ring < 24; ring++) {
      const radius = 42 + ring * 29.5, size = 15.5 + radius * .012;
      const slots = Math.floor(2 * Math.PI * radius / (size * .51));
      for (let i = 0; i < slots; i++) orbit.push(radius,
        i / slots * Math.PI * 2 + ring * .17, size, 0,
        index(orbitText[(i + ring * 11) % orbitText.length]), hash(i * 11 + ring * 751),ring,
        .055 + (ring % 4) * .009);
    }
    const cols = 128, rows = 57, dx = width / cols, dy = height / rows;
    for (let y = 0; y < rows; y++) {
      const offset = Math.floor(hash(y + 300) * fieldText.length);
      for (let x = 0; x < cols; x++) grid.push((x + .5) * dx,(y + .5) * dy,15.1,0,
        index(fieldText[(offset + x) % fieldText.length]),hash(x + y * cols),0,0);
    }
    return {orbit:new Float32Array(orbit),grid:new Float32Array(grid)};
  }
  function gpuRenderer(canvas, atlas, data, width, height) {
    const gl = canvas.getContext('webgl2', {alpha:true,antialias:false,depth:false,
      stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'low-power'});
    if (!gl) return null;
    const device = gl.getExtension('WEBGL_debug_renderer_info');
    const deviceName = device ? gl.getParameter(device.UNMASKED_RENDERER_WEBGL) : '';
    if (/SwiftShader|llvmpipe|software/i.test(deviceName)) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return {backend:'software'};
    }
    let program, uniforms, layers, lost = false, disposed = false;
    let buffers=[],arrays=[],textures=[];
    function release() {
      buffers.forEach(buffer=>gl.deleteBuffer(buffer));buffers=[];
      arrays.forEach(array=>gl.deleteVertexArray(array));arrays=[];
      textures.forEach(texture=>gl.deleteTexture(texture));textures=[];
      if(program) gl.deleteProgram(program);program=null;
    }
    function initialize() {
      function compile(kind, source) {
        const shader = gl.createShader(kind);gl.shaderSource(shader,source);gl.compileShader(shader);
        if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
          const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(message);
        }
        return shader;
      }
      program = gl.createProgram();
      const vs = compile(gl.VERTEX_SHADER,vertex), fs = compile(gl.FRAGMENT_SHADER,fragment);
      gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.deleteShader(vs);gl.deleteShader(fs);
      uniforms = Object.fromEntries(['viewport','clock','orbitClock','layer','opacity','motion','cursor','gesture','pulse','atlas'].map(n => [n,gl.getUniformLocation(program,n)]));
      const quad = gl.createBuffer();buffers.push(quad);gl.bindBuffer(gl.ARRAY_BUFFER,quad);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-.5,-.5,.5,-.5,-.5,.5,-.5,.5,.5,-.5,.5,.5]),gl.STATIC_DRAW);
      layers = Object.values(data).map(vertices => {
        const vao=gl.createVertexArray();arrays.push(vao);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,quad);
        gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
        const buffer = gl.createBuffer();buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
        for (let i=1;i<=2;i++) {gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,4,gl.FLOAT,false,32,(i-1)*16);gl.vertexAttribDivisor(i,1);}
        return {vao,count:vertices.length/8};
      });
      const texture = gl.createTexture();textures.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);
      gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    }
    try {initialize();} catch(error) {release();throw error;}
    const contextLost=e=>{e.preventDefault();lost=true;};
    const contextRestored=()=>{
      if(disposed) return;
      // Objects from the lost context are already invalidated by the browser.
      buffers=[];arrays=[];textures=[];program=null;
      initialize();lost=false;
    };
    canvas.addEventListener('webglcontextlost',contextLost);
    canvas.addEventListener('webglcontextrestored',contextRestored);
    return {backend:'webgl2', draw(state) {
      if (lost || disposed) return;
      gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);gl.uniform2f(uniforms.viewport,width,height);
      gl.uniform1f(uniforms.clock,state.time);gl.uniform1f(uniforms.orbitClock,state.orbitTime);
      gl.uniform1f(uniforms.motion,state.reduced ? 0 : 1);
      gl.uniform4f(uniforms.cursor,state.x,state.y,state.radius,state.hover);
      gl.uniform4f(uniforms.gesture,state.vx,state.vy,state.charge,0);
      gl.uniform4f(uniforms.pulse,state.pulse.x,state.pulse.y,state.pulse.start,0);
      gl.uniform1i(uniforms.atlas,0);
      for (let i=0;i<2;i++) {
        const opacity = i === 0 ? 1-state.mix : state.mix;
        if (opacity < .001) continue;
        gl.uniform1f(uniforms.layer,i);gl.uniform1f(uniforms.opacity,opacity);
        gl.bindVertexArray(layers[i].vao);gl.drawArraysInstanced(gl.TRIANGLES,0,6,layers[i].count);
      }
    },dispose() {
      if(disposed) return;disposed=true;
      canvas.removeEventListener('webglcontextlost',contextLost);
      canvas.removeEventListener('webglcontextrestored',contextRestored);
      release();gl.getExtension('WEBGL_lose_context')?.loseContext();
    }};
  }

  // Older devices still get live type and hover, using the same cached atlas.
  function fallbackRenderer(canvas, atlas, data, width, height) {
    const ctx = canvas.getContext('2d');let last = -Infinity;
    const gridBase = new Float32Array(data.grid.length/8);
    for(let i=0;i<data.grid.length;i+=8) {
      const qx=(data.grid[i]-width*.514)/420,qy=(data.grid[i+1]-height*.492)/335;
      const body=1-smooth((Math.hypot(qx,qy)-.28)/1.37);
      const relief=Math.sin(qx*5+Math.sin(qy*4)*1.7)*Math.cos(qy*5.4-qx*2.4)*.5+.5;
      gridBase[i/8]=.052+body*smooth((relief-.12)/.6)*(.09+data.grid[i+5]*.13);
    }
    return {backend:'canvas2d', draw(s, force) {
      if (!force && s.time >= last && s.time-last < 1/30) return;last=s.time;
      ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);ctx.clearRect(0,0,width,height);
      for (const [layer,values] of Object.values(data).entries()) {
        const opacity=layer ? s.mix : 1-s.mix;if (opacity < .001) continue;
        for (let i=0;i<values.length;i+=8) {
          let x=values[i],y=values[i+1],size=values[i+2],char=values[i+4],seed=values[i+5],angle=0,alpha=.075;
          if (!layer) {
            const r=x*(1-s.charge*.075);angle=y+s.orbitTime*values[i+7];
            x=width*.514+Math.cos(angle)*r;y=height*.492+Math.sin(angle)*r;
            if (Math.sin(angle*1.6+values[i+6]*.66-s.time*.22)+Math.sin(values[i+6]*.72-s.time*.48)*.42+seed*.34>.04) char=1;
            angle+=Math.PI/2;alpha=(.22+.22*clamp(r/720))*(.42+.58*smooth((r-110)/290));
          } else {
            const twinkle=s.reduced ? 0 : Math.pow(.5+.5*Math.sin(s.time*.83+seed*91),18);
            alpha=gridBase[i/8]+twinkle*.10;
            if(twinkle>.36)char=2+Math.floor(hash(seed*913+Math.floor(s.time*2.4))*40);
          }
          if(x<-30||x>width+30||y<-30||y>height+30)continue;
          const age=s.time-s.pulse.start;
          if(age>0&&age<1.9&&!s.reduced) {
            const dist=layer?Math.hypot(x-s.pulse.x,y-s.pulse.y):Math.hypot(x-width*.514,y-height*.492);
            const wave=(1-smooth(Math.abs(dist-age*530)/100))*Math.sin(age/1.9*Math.PI)*(.35+seed*.65);
            alpha+=wave*.26;
            if(wave>.5&&!layer)char=1;
            else if(wave>.24&&layer)char=2+Math.floor(hash(seed*611+Math.floor(s.time*15))*40);
          }
          const hover=Math.pow(1-smooth(Math.hypot(x-s.x,(y-s.y)/.86)/s.radius),2)*s.hover;
          const dissolve=smooth((hover-seed*.62)/.18);
          if(!layer&&dissolve>.5)char=1;else if(layer)alpha*=1-dissolve*.97;
          if(char===0)continue;
          ctx.globalAlpha=opacity*alpha*smooth(y/32)*smooth((height-y)/32);
          if(layer) {
            ctx.drawImage(atlas,char%8*64,Math.floor(char/8)*64,64,64,x-size/2,y-size/2,size,size);
          } else {
            ctx.save();ctx.translate(x,y);ctx.rotate(angle);
            ctx.drawImage(atlas,char%8*64,Math.floor(char/8)*64,64,64,-size/2,-size/2,size,size);ctx.restore();
          }
        }
      }
      ctx.globalAlpha=1;
    }};
  }
  function create(element,width,height) {
    let canvas = document.createElement('canvas');
    canvas.dataset.textField='';canvas.setAttribute('aria-hidden','true');
    element.prepend(canvas);
    const atlas=makeAtlas(),data=makeGeometry(width,height);
    let renderer;
    try {renderer=gpuRenderer(canvas,atlas,data,width,height);} catch(error) {
      // A context that failed initialization cannot switch its type in place.
      console.warn('Text field uses its 2D fallback:',error.message);
      const replacement=canvas.cloneNode();canvas.replaceWith(replacement);canvas=replacement;
    }
    if(renderer?.backend==='software') {
      const replacement=canvas.cloneNode();canvas.replaceWith(replacement);canvas=replacement;renderer=null;
    }
    if (!renderer) renderer=fallbackRenderer(canvas,atlas,data,width,height);
    const state={time:0,orbitTime:0,mix:0,x:0,y:0,radius:115,hover:0,vx:1,vy:0,
      charge:0,pulse:{x:width/2,y:height/2,start:-100},reduced:false};
    let last=null,pressed=false,lastX=0,lastY=0,disposed=false;
    function reset() {last=null;pressed=false;state.hover=state.charge=0;state.pulse.start=-100;}
    return {draw(seconds,options) {
      if(disposed) return;
      const reduced=!!options.reducedMotion,time=reduced ? 21 : seconds;
      let delta=last===null ? 0 : time-last;
      const seek=last===null||delta<0||delta>.25;
      if(seek) {delta=0;state.orbitTime=time;state.hover=state.charge=0;state.pulse.start=-100;}
      last=time;
      const p=options.pointer,active=!reduced&&!!p?.active;
      state.hover+=((active?1:0)-state.hover)*(1-Math.exp(-delta*(active?10:6)));
      state.charge+=((active&&p.pressed?1:0)-state.charge)*(1-Math.exp(-delta*5));
      if(active) {
        const distance=Math.hypot(p.x-lastX,p.y-lastY);
        if(distance>1&&delta>0) {state.vx=(p.x-lastX)/distance;state.vy=(p.y-lastY)/distance;}
        state.x=lastX=p.x;state.y=lastY=p.y;state.radius=Math.max(90,Math.min(160,(p.radius||65)*1.7));
      }
      if(pressed&&!p?.pressed&&active) state.pulse={x:state.x,y:state.y,start:time};
      pressed=active&&!!p?.pressed;
      state.time=time;state.orbitTime+=delta*(1-state.charge*.85);
      state.mix=options.mix;state.reduced=reduced;
      let resized=false;
      // A cap avoids giant GPU surfaces on high-DPI displays; the foreground
      // serif remains at the full device resolution supplied by the shared clock.
      const pixelWidth=Math.min(options.pixelWidth,1608),pixelHeight=Math.round(pixelWidth*height/width);
      if(canvas.width!==pixelWidth||canvas.height!==pixelHeight) {canvas.width=pixelWidth;canvas.height=pixelHeight;resized=true;}
      renderer.draw(state,resized||seek);
    },reset,dispose() {
      if(disposed) return;disposed=true;reset();renderer.dispose?.();
      canvas.width=canvas.height=0;canvas.remove();
    },get debug() {return {backend:renderer.backend,disposed,mode:state.mix<.01?'orbits':state.mix>.99?'characters':'transition',
      orbitGlyphs:data.orbit.length/8,fieldGlyphs:data.grid.length/8,hover:state.hover,charge:state.charge,
      pulseAge:state.pulse.start<0?null:state.time-state.pulse.start,mix:state.mix,reducedMotion:state.reduced};}};
  }
  window.SongDongTextField={create};
})();
