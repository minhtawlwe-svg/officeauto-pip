// Builds a .pptx file WITHOUT Microsoft Office (PptxGenJS, MIT), for laptops where PowerPoint is not installed
// or its automation fails. Clean 16:9 design, Burmese text gets the Windows "Myanmar Text" font, speaker notes kept.
// Saved to Documents\Presentations\ and opened with whatever opens .pptx (PowerPoint, WPS, LibreOffice ...).
'use strict';
const fs = require('fs');
const path = require('path');

const MY = /[က-႟]/;   // Burmese script
const strip = (s) => String(s || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/[*_`#]/g, '').trim();

module.exports = async function makePptx(spec, docsDir) {
  let PptxGenJS;
  try { PptxGenJS = require('pptxgenjs'); }
  catch { throw new Error('PowerPoint is not installed, and this copy cannot build slides without it - get the newest app version.'); }

  const slides = Array.isArray(spec.Slides) ? spec.Slides : [];
  const all = [spec.Title, spec.Subtitle, ...slides.flatMap((s) => [s.title, ...(s.bullets || [])])].join(' ');
  const font = MY.test(all) ? 'Myanmar Text' : 'Segoe UI';
  const C = { dark: '1C3A4A', accent: '14A8B4', soft: 'E8F6F7', text: '22313A', muted: '5A6B75' };

  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';   // 13.33 x 7.5 in
  pres.title = strip(spec.Title) || 'Presentation';
  pres.defineSlideMaster({
    title: 'CONTENT', background: { color: 'FFFFFF' },
    objects: [
      { rect: { x: 0, y: 0, w: 0.22, h: 7.5, fill: { color: C.accent } } },
      { rect: { x: 0.6, y: 1.32, w: 1.4, h: 0.06, fill: { color: C.accent } } },
    ],
    slideNumber: { x: 12.4, y: 6.95, fontFace: font, fontSize: 11, color: C.muted },
  });

  // title slide
  const t = pres.addSlide();
  t.background = { color: C.dark };
  t.addShape(pres.ShapeType.rect, { x: 0, y: 5.9, w: 13.33, h: 0.12, fill: { color: C.accent } });
  t.addText(strip(spec.Title) || 'Presentation', { x: 0.8, y: 2.0, w: 11.7, h: 1.8, fontFace: font, fontSize: 44, bold: true, color: 'FFFFFF', valign: 'bottom', fit: 'shrink' });
  if (spec.Subtitle) t.addText(strip(spec.Subtitle), { x: 0.8, y: 3.9, w: 11.7, h: 1.0, fontFace: font, fontSize: 22, color: 'BFE9EC', valign: 'top', fit: 'shrink' });

  for (const sl of slides) {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    s.addText(strip(sl.title), { x: 0.6, y: 0.35, w: 12.1, h: 0.95, fontFace: font, fontSize: 30, bold: true, color: C.dark, valign: 'bottom', fit: 'shrink' });
    const bullets = (sl.bullets || []).map(strip).filter(Boolean);
    if (bullets.length) {
      s.addText(bullets.map((b) => ({ text: b, options: { bullet: { code: '25A0' }, paraSpaceAfter: MY.test(b) ? 10 : 8 } })),
        { x: 0.75, y: 1.65, w: 11.8, h: 5.1, fontFace: font, fontSize: bullets.length > 5 ? 20 : 24, color: C.text, valign: 'top',
          lineSpacingMultiple: MY.test(bullets.join('')) ? 1.25 : 1.05, fit: 'shrink' });
    }
    if (sl.notes) s.addNotes(String(sl.notes));
  }

  const dir = path.join(docsDir, 'Presentations');
  fs.mkdirSync(dir, { recursive: true });
  const base = (strip(spec.Title) || 'Presentation').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'Presentation';
  let file = path.join(dir, base + '.pptx');
  for (let n = 2; fs.existsSync(file); n++) file = path.join(dir, `${base} (${n}).pptx`);
  await pres.writeFile({ fileName: file });
  return { file, slides: slides.length + 1 };
};
