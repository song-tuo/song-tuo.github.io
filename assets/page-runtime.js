/* Explicit page lifetimes; the index and title canvas survive main replacement. */
(() => {
  'use strict';
  const modules = new Map(), scopes = new Map();
  function createScope() {
    const abort = new AbortController(), cleanups = [];
    const scope = {
      active:true,
      listen(target,type,handler,options={}) {
        if (!target || !scope.active) return;
        const opts = typeof options === 'boolean' ? {capture:options} : options;
        target.addEventListener(type,handler,{...opts,signal:abort.signal});
      },
      cleanup(fn) {if(scope.active) cleanups.push(fn); else fn();},
      observe(observer) {scope.cleanup(()=>observer.disconnect());return observer;},
      dispose() {
        if(!scope.active) return;
        scope.active=false;abort.abort();
        for(const fn of cleanups.reverse()) {try {fn();} catch(error) {console.error('Page cleanup failed',error);}}
        cleanups.length=0;
      }
    };
    return scope;
  }
  function mount(name, factory) {
    const scope=createScope();scopes.set(name,scope);
    try {Promise.resolve(factory(scope)).catch(error=>{scope.dispose();console.error('Page initialization failed',error);});}
    catch(error) {scope.dispose();console.error('Page initialization failed',error);}
  }
  window.SongDongPage={
    register(name,factory) {scopes.get(name)?.dispose();modules.set(name,factory);mount(name,factory);},
    unmount() {for(const scope of scopes.values())scope.dispose();scopes.clear();},
    mount() {for(const [name,factory] of modules) {scopes.get(name)?.dispose();mount(name,factory);}},
    get debug(){return {modules:[...modules.keys()],active:[...scopes].filter(([,scope])=>scope.active).map(([name])=>name)};}
  };
})();
