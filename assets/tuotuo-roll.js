/* Wheel-driven vertical type rotation. No scroll interception or idle loop. */
(() => {
  'use strict';
  const nav=document.querySelector('.site-nav');
  const label=nav?.querySelector('bodycopy>h1:first-child+hr+span');
  if(!label)return;
  const text=label.textContent.trim();
  if(!text)return;
  const roll=document.createElement('span'),prism=document.createElement('span');
  roll.className='tuotuo-roll';prism.className='tuotuo-prism';
  for(let face=0;face<4;face++){
    const side=document.createElement('span');side.className='tuotuo-face';side.textContent=text;
    if(face)side.setAttribute('aria-hidden','true');
    prism.append(side);
  }
  roll.append(prism);label.replaceChildren(roll,document.createElement('br'));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const desktop=matchMedia('(min-width:801px)');
  let angle=0,target=0,frame=0,lastFrame=0,lastWheel=0,snapping=false,visible=true;
  function reset(){
    cancelAnimationFrame(frame);frame=0;angle=target=lastFrame=lastWheel=0;snapping=false;
    prism.style.transform='';roll.removeAttribute('data-turning');
  }
  function tick(now){
    frame=0;
    if(reduced.matches||document.hidden||!visible){reset();return;}
    const dt=lastFrame?Math.min(50,now-lastFrame):16.7;lastFrame=now;
    if(!snapping&&now-lastWheel>140){target=Math.round(target/90)*90;snapping=true;}
    angle+=(target-angle)*(1-Math.exp(-dt/(snapping?72:58)));
    if(snapping&&Math.abs(target-angle)<.025){
      angle=target=((target%360)+360)%360;lastFrame=0;
      prism.style.transform=`translateZ(-10px) rotateX(${angle}deg)`;roll.removeAttribute('data-turning');return;
    }
    prism.style.transform=`translateZ(-10px) rotateX(${(angle%360).toFixed(3)}deg)`;
    frame=requestAnimationFrame(tick);
  }
  addEventListener('wheel',event=>{
    if(event.ctrlKey||reduced.matches||document.hidden||!visible||(!desktop.matches&&!nav.classList.contains('menu-open')))return;
    if(event.target instanceof Element&&event.target.closest('dialog,[role="dialog"],.lightbox'))return;
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
    if(!delta)return;
    target-=Math.max(-120,Math.min(120,delta))*.38;
    lastWheel=performance.now();snapping=false;roll.setAttribute('data-turning','');
    if(!frame)frame=requestAnimationFrame(tick);
  },{passive:true,capture:true});
  if(typeof IntersectionObserver!=='undefined')new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;if(!visible)reset();
  }).observe(roll);
  reduced.addEventListener('change',reset);
  desktop.addEventListener('change',reset);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  addEventListener('pagehide',reset);
})();
