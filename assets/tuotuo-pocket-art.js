/* Tuo Tuo's pocket: original monochrome drawings, local preview edition. */
(() => {
  'use strict';
  const drawing = (body) => `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

  window.TuoTuoPocketArt = [
    {
      id: 'compass', label: 'Compass', zh: '圆规',
      svg: drawing(`
        <path d="M56 26V15q4-3 8 0v11M56 19h8"/>
        <circle cx="60" cy="34" r="8" fill="var(--pocket-paper, #e9e7e2)"/>
        <circle cx="60" cy="34" r="2.3"/>
        <path d="M54 40 33 93l5 2 25-54M33 93l-3 13 8-11" fill="var(--pocket-paper, #e9e7e2)"/>
        <path d="m49 62-4 1M33 93l5 2"/>
        <!-- The opening leg rotates around the hinge at 60px 34px. -->
        <g class="compass-leg">
          <path d="m65 40 24 52-5 3-27-54" fill="var(--pocket-paper, #e9e7e2)"/>
          <path d="m84 95 8 11-3-14M72 63l8 18M80 81l5-2"/>
          <path d="m84 95 5-3"/>
        </g>
        <path d="M45 64q15 7 30 0"/>
        <path d="M58 66v7m4-7v7M56 73h8"/>
        <path d="M24 108q36-14 72 0" stroke-dasharray="1 4" opacity=".34"/>
      `)
    },
    {
      id: 'ballet', label: 'Ballet shoes', zh: '芭蕾舞鞋',
      svg: drawing(`
        <g class="ballet-swing">
          <path d="M47 56C32 46 69 37 63 20c-3-8-17-8-18-1-1 6 10 9 13 3M67 54c-3-20 30-18 25-35-3-9-18-7-16 2 1 5 9 6 13 2"/>
          <path d="M44 58c-11 9-17 24-14 36 1 5 6 10 12 10 7 0 13-5 15-11l7-25c2-7-1-14-6-16-4-2-10 1-14 6Z" fill="var(--pocket-paper, #e9e7e2)"/>
          <path d="M44 58c-5 8-7 17-3 21 4 4 12-3 17-14 3-6 2-10 0-11"/>
          <path d="m36 75 18 11m-20-3 18 11M31 93q12-4 25 1M32 98q11-3 21 0"/>
          <path d="M69 54c-7 2-8 11-6 18l9 29c2 6 9 9 16 7 7-2 10-7 9-13-2-13-9-31-17-38-4-4-8-4-11-3Z" fill="var(--pocket-paper, #e9e7e2)"/>
          <path d="M70 55c-4 5 0 19 5 24 5 6 10 2 9-5-1-7-7-19-11-20"/>
          <path d="m67 77 21 8m-19 1 22 7M72 99q11-6 24-5M75 105q10-5 19-5"/>
          <path d="M60 40c-5-6-12-5-15-2M82 37c9 3 12 9 10 15" opacity=".6"/>
        </g>
      `)
    },
    {
      id: 'pencil', label: 'Pencil', zh: '铅笔',
      svg: drawing(`
        <g class="pencil-body">
        <g transform="rotate(36 60 60)">
          <path d="M54 30h12v58l-6 16-6-16Z" fill="var(--pocket-paper, #e9e7e2)"/>
          <path d="M54 30V19c0-8 12-8 12 0v11" fill="var(--pocket-paper, #e9e7e2)"/>
          <path d="M54 24h12M54 28h12M58 31v54m4-54v54M54 88l4-3 4 2 4 1"/>
          <path d="m57.9 98 2.1 6 2.2-6Z" fill="currentColor" stroke="none"/>
          <path d="M58 43v20" stroke-width=".8" opacity=".48"/>
        </g>
        </g>
        <path class="pencil-trace" d="M19 100c7-5 11-5 15-2s8 2 12-1" opacity=".4"/>
      `)
    },
    {
      id: 'cat', label: 'Cat', zh: '猫',
      svg: drawing(`
        <path d="M37 48C49 24 84 26 99 48c11 17 10 40-8 49-12 6-35 5-51 0-16-5-22-18-16-30" fill="var(--pocket-paper, #e9e7e2)"/>
        <path d="M71 43c15 4 25 17 23 32" opacity=".45"/>
        <g class="cat-tail">
          <path d="M91 83c-10 14-29 13-39 9-7-3-7-11 0-12 5-1 11 4 17 2 8-2 11-7 9-12" fill="var(--pocket-paper, #e9e7e2)"/>
        </g>
        <g class="cat-head">
        <path d="M23 51 25 30l16 12c5-2 11-1 16 1l17-8-5 24c3 8 0 17-9 21-10 5-25 3-32-5-7-7-8-16-5-24Z" fill="var(--pocket-paper, #e9e7e2)"/>
        <path d="m28 48 1-10 8 7m24 2 8-6-3 11" stroke-width="1.2"/>
        <g class="cat-eye"><path d="M32 58q4 4 8 0M51 59q4 4 8 0"/></g>
        <path d="m43 64 3 2 3-2Z" fill="currentColor" stroke="none"/>
        <path d="M46 66v3m0 0q-3 4-6 1m6-1q3 4 6 1" stroke-width="1.2"/>
        <path d="m29 64-13-3m14 7-14 2m46-5 13-3m-14 7 14 2" stroke-width="1.1"/>
        </g>
        <path d="M37 83c-6 2-8 6-4 9 4 3 11 2 14 0M38 88v4m4-4v5"/>
      `)
    },
    {
      id: 'tennis', label: 'Tennis ball', zh: '网球',
      svg: drawing(`
        <ellipse cx="60" cy="102" rx="25" ry="3" fill="currentColor" stroke="none" opacity=".07"/>
        <g class="tennis-ball">
          <circle cx="60" cy="58" r="32" fill="var(--pocket-paper, #e9e7e2)"/>
          <path d="M33 41c20 2 26 14 24 27-1 9-6 16-12 18M38 34c23 2 32 18 27 36-2 9-7 15-13 19"/>
          <path d="M84 37C68 40 63 50 66 62c3 11 11 15 20 15M89 44c-12 3-16 10-13 18 2 5 7 8 14 8"/>
          <path d="m43 46 1 1m-6 12 1-1m5 12 1 1m7-33 1 1m24 42 1-1m-5-50 1 1" stroke-width="1" opacity=".4"/>
        </g>
      `)
    },
    {
      id: 'laptop', label: 'Computer', zh: '电脑',
      svg: drawing(`
        <path d="M29 24h64c3 0 5 2 5 5v50H24V29c0-3 2-5 5-5Z" fill="var(--pocket-paper, #e9e7e2)"/>
        <rect x="30" y="31" width="62" height="41" rx="1.5"/>
        <g class="laptop-screen">
          <path d="m39 44 6 4-6 4"/>
          <path class="laptop-cursor" d="M51 53h12"/>
          <path d="M39 61h38m-38 4h26" opacity=".35"/>
        </g>
        <circle cx="61" cy="27.5" r=".8" fill="currentColor" stroke="none"/>
        <path d="m24 79-12 16c-1 2 1 5 4 5h91c3 0 5-3 3-5L98 79Z" fill="var(--pocket-paper, #e9e7e2)"/>
        <path d="M13 95h96M32 83h58m-61 4h64m-54 0-1-4m12 4v-4m12 4v-4m12 4-1-4m12 4-1-4" stroke-width="1.1"/>
        <path d="m51 90-2 3h23l-2-3Z" stroke-width="1.1"/>
      `)
    },
    {
      id: 'book', label: 'Book', zh: '书',
      svg: drawing(`
        <path d="M12 32c16-4 32-2 48 7 16-9 32-11 48-7v58c-17-4-33-2-48 7-15-9-31-11-48-7Z" fill="var(--pocket-paper, #e9e7e2)"/>
        <path d="M60 39v58M12 85c16-3 33 0 48 8 15-8 32-11 48-8"/>
        <g class="book-page">
          <path d="M18 25c14-2 27 2 42 11v51C46 78 31 74 18 76Z" fill="var(--pocket-paper, #e9e7e2)"/>
          <path d="M25 38c9 0 18 3 27 8M25 45c9 0 18 3 27 8m-27-1c9 0 18 3 27 8m-27-1c8 0 15 2 22 6" stroke-width="1.1" opacity=".58"/>
        </g>
        <path d="M60 36c14-8 29-12 42-10v50c-13-2-28 2-42 11Z" fill="var(--pocket-paper, #e9e7e2)"/>
        <path d="M70 45c8-4 15-6 24-6m-24 13c8-4 15-6 24-6m-24 13c8-4 15-6 24-6m-24 13c8-4 15-6 24-6" stroke-width="1.1" opacity=".58"/>
        <path d="M84 27v19l4-4 4 2V26" fill="var(--pocket-paper, #e9e7e2)"/>
      `)
    },
    {
      id: 'wine', label: 'Wine', zh: '酒瓶',
      svg: drawing(`
        <g class="wine-bottle">
        <g transform="rotate(-9 60 60)">
          <path d="M53 12h14v10H53Z" fill="var(--pocket-paper, #e9e7e2)"/>
          <path d="M54 22v22c0 7-11 9-11 19v41c0 4 3 6 7 6h20c4 0 7-2 7-6V63c0-10-11-12-11-19V22" fill="var(--pocket-paper, #e9e7e2)"/>
          <path d="M53 17h14M54 29h12M48 61c0-5 5-8 8-10" opacity=".55"/>
          <path d="M43 69h34v27H43Z" fill="var(--pocket-paper, #e9e7e2)"/>
          <path d="M50 76h20m-17 13h14" stroke-width="1"/>
          <path d="m60 79 3 4-3 4-3-4Z"/>
          <path d="M49 104h22" opacity=".45"/>
        </g>
        </g>
      `)
    },
    {
      id: 'disco', label: 'Disco ball', zh: '镜面球',
      svg: drawing(`
        <defs><clipPath id="tuotuo-pocket-mirror-clip"><circle cx="60" cy="66" r="32"/></clipPath></defs>
        <path d="M60 5v25m-4 4v-4h8v4"/>
        <circle cx="60" cy="66" r="32" fill="var(--pocket-paper, #e9e7e2)"/>
        <g clip-path="url(#tuotuo-pocket-mirror-clip)" stroke-width=".9">
          <path d="M28 49h64M28 60h64M28 72h64M28 83h64M28 91h64M28 41h64"/>
          <path d="M60 34v64M48 35c-8 20-8 42 0 62M72 35c8 20 8 42 0 62M38 42c-6 16-6 32 0 48M82 42c6 16 6 32 0 48"/>
          <path d="M46 49h14v11H44Zm28 23H60v11h12Zm-36-12h6v12h-6ZM60 34h9l3 7H60Zm18 49h8l-5 8h-5Z" fill="currentColor" stroke="none" opacity=".14"/>
          <path d="M60 49h14v11H60Zm-16 23h16v11H46Zm34-12h14v12H78ZM49 91h11v7h-8Z" fill="currentColor" stroke="none" opacity=".055"/>
        </g>
        <g class="disco-glints">
          <path d="M99 39v10m-5-5h10M22 78v8m-4-4h8M83 104v6m-3-3h6" stroke-width="1.2"/>
          <path d="M69 53v6m-3-3h6" stroke="var(--pocket-paper, #e9e7e2)" stroke-width="2"/>
        </g>
      `)
    }
  ];
})();
