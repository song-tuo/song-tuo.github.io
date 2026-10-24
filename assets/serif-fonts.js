/* Finish font loading before any animated glyph atlas is sampled. */
window.SongDongFontsReady = !document.querySelector('.home-page') ? Promise.resolve([]) : Promise.all([
  document.fonts.load('500 43px "Bodoni Moda"'),
  document.fonts.load('600 54px "Bodoni Moda"')
]).catch(() => []);
