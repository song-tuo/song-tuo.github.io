/* Native, bounded motion: a quiet entrance without delaying navigation. */
window.SongDongPage.register('page-motion', scope => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const content = document.querySelector('main .page-content');
  if (!content || reduced.matches || !content.animate) return;
  // Let back/forward navigation restore the page exactly where it was.
  if (performance.getEntriesByType('navigation')[0]?.type === 'back_forward') return;
  const home = content.closest('.home-page');
  let entrance;
  // A title flight owns this whole navigation after its pending state clears.
  if (home && !document.documentElement.classList.contains('title-flight-navigation')) {
    // Keep a direct-loaded article readable from its first frame. The title
    // flight carries navigation motion; body text should not slide into place.
    entrance = content.animate([{opacity:.85},{opacity:1}],
      {duration:160,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  const animations = new Set();
  let observer;
  if (!home && window.IntersectionObserver) {
    const mediaSelector = 'media-item,gallery-grid,gallery-justify,gallery-slideshow';
    observer = scope.observe(new IntersectionObserver(entries => {
      if (!scope.active) return;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        // Content is visible by default; failed or disabled JS never hides images.
        if (reduced.matches || !entry.target.animate) continue;
        const animation = entry.target.animate([
          {opacity:.85},
          {opacity:1}
        ],{duration:160,easing:'cubic-bezier(.22,1,.36,1)'});
        animations.add(animation);
        animation.finished.catch(() => {}).finally(() => animations.delete(animation));
      }
    },{rootMargin:'0px 0px 36px 0px',threshold:0}));
    content.querySelectorAll(mediaSelector).forEach(media => {
      if (!media.parentElement.closest(mediaSelector) && media.getBoundingClientRect().top >= innerHeight) observer.observe(media);
    });
  }
  const settle = () => {
    entrance?.finish(); observer?.disconnect();
    animations.forEach(animation => animation.finish()); animations.clear();
  };
  scope.listen(reduced,'change', event => {if (event.matches) settle();});
  scope.listen(window,'pagehide',settle);
  scope.cleanup(settle);
});
