const { Document, Paragraph, TextRun, ImageRun, HeadingLevel, Footer, PageNumber } = require('docx');

function safeFilename(value) {
  let name = String(value || 'Export').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
  name = Array.from(name).slice(0, 180).join('').replace(/[. ]+$/g, '') || 'Export';
  return /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name) ? `_${name}` : name;
}

function buildCodeReportDocx(report) {
  const children = [];
  const heading = (text, level) => children.push(new Paragraph({ text, heading: level, keepNext: true }));
  const metadata = (text, keepNext = true) => children.push(new Paragraph({ children: [new TextRun({ text, size: 19, color: '526475' })], spacing: { after: 120 }, keepNext }));
  const prose = (text, label, options = {}) => {
    const lines = String(text || '').split(/\r\n|\r|\n/);
    lines.forEach((line, index) => children.push(new Paragraph({
      children: [...(label && index === 0 ? [new TextRun({ text: `${label}: `, bold: true })] : []), new TextRun(line)],
      spacing: { after: 100 }, ...options
    })));
  };
  const memo = (label, text) => { if (text?.trim()) prose(text, label); };
  const codeBlock = code => {
    heading(code.path, HeadingLevel.HEADING_2);
    metadata(`${code.excerptCount} coded ${code.excerptCount === 1 ? 'excerpt' : 'excerpts'}`, !!(code.definition || code.summary || code.frameworkMemo || code.excerpts.length));
    memo('Definition', code.definition);
    memo('Code summary', code.summary);
    memo('Framework memo', code.frameworkMemo);
    code.excerpts.forEach((excerpt, index) => {
      metadata(`${excerpt.region ? 'Image excerpt' : 'Excerpt'} ${index + 1}${excerpt.location ? ` · ${excerpt.location}` : ''} · Coder: ${excerpt.coder}${excerpt.starred ? ' · Key excerpt' : ''}`);
      if(excerpt.cases)metadata('Cases: '+excerpt.cases);
      if(excerpt.attributes)metadata('Attributes: '+excerpt.attributes);
      if (excerpt.region) {
        if (excerpt.image) {
          const image = excerpt.image;
          const scale = Math.min(1, 460 / image.width, 450 / image.height);
          children.push(new Paragraph({ children: [new ImageRun({ type: 'png', data: Buffer.from(image.base64, 'base64'),
            transformation: { width: Math.max(1, Math.round(image.width * scale)), height: Math.max(1, Math.round(image.height * scale)) } })], spacing: { after: 100 } }));
        } else prose('Image preview unavailable');
        const r = excerpt.region;
        const percent = n => `${Math.round(n * 1000) / 10}%`;
        children.push(new Paragraph({ children: [new TextRun({ text: `Region position: left ${percent(r.x)}, top ${percent(r.y)}, width ${percent(r.width)}, height ${percent(r.height)}`, size: 19, color: '526475' })], spacing: { after: 100 } }));
      } else prose(excerpt.text, undefined, { indent: { left: 240 } });
      memo('Excerpt memo', excerpt.note);
    });
  };
  heading(report.title, HeadingLevel.TITLE);
  prose(report.projectName, 'Project');
  prose(report.description);
  if (!report.sources.length && !report.uncoded.length) prose('No codes in this export selection.');
  for (const source of report.sources) {
    heading(source.name, HeadingLevel.HEADING_1);
    const count = source.codes.reduce((n, code) => n + code.excerptCount, 0);
    metadata(`${source.type} · ${source.codes.length} ${source.codes.length === 1 ? 'code' : 'codes'} · ${count} coded ${count === 1 ? 'excerpt' : 'excerpts'}`);
    memo('Source memo', source.memo);
    source.codes.forEach(codeBlock);
  }
  if (report.uncoded.length) {
    heading('Codes without excerpts', HeadingLevel.HEADING_1);
    report.uncoded.forEach(codeBlock);
  }
  return new Document({
    creator: 'eQc', title: `${report.projectName} ${report.title}`,
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22, color: '000000' }, paragraph: { spacing: { line: 276, after: 120 } } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', run: { size: 36, bold: true, color: '000000' }, paragraph: { spacing: { after: 200 }, keepNext: true } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { size: 28, bold: true, color: '000000' }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { size: 24, bold: true, color: '000000' }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 1 } }
      ]
    },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
      footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: 'eQc · Page ', size: 18, color: '526475' }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '526475' })] })] }) }, children }]
  });
}

module.exports = { buildCodeReportDocx, safeFilename };
