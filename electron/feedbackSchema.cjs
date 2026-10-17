// Shared by the desktop bridge and the hosted service. Never accepts project data.
const RECIPIENT = 'anisur.rahman.bayazid@gmail.com';
const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024;
const DEVICE_FIELDS = ['App version','Operating system','Architecture','Memory','Display','Scale factor','Electron','Chromium'];
function validateFeedback(input) {
  if (!input || typeof input !== 'object' || input.schemaVersion !== 1) throw Error('This report format is not supported.');
  const text = (key, max, required = false) => {
    if (input[key] !== undefined && typeof input[key] !== 'string') throw Error(`Invalid ${key}.`);
    const value = (input[key] || '').trim();
    if ((required && !value) || value.length > max) throw Error(`Please check ${key}.`);
    return value;
  };
  const id = text('id', 36, true);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw Error('Invalid report identifier.');
  if (!['bug','feature','other'].includes(input.kind)) throw Error('Choose a report type.');
  const senderName = text('senderName',120,true);
  if (/[\r\n\x00-\x1f\x7f]/.test(senderName)) throw Error('Please enter your name on one line.');
  const replyTo = text('replyTo',254,true), subject = text('subject',160,true);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(replyTo) || /[\r\n]/.test(subject)) throw Error('Please check your email address and subject.');
  const result = {schemaVersion:1,id,kind:input.kind,senderName,replyTo,subject,description:text('description',12000,true),steps:text('steps',6000),expected:text('expected',4000)};
  if (input.device !== undefined) {
    if (!input.device || typeof input.device !== 'object' || Array.isArray(input.device)) throw Error('Invalid device information.');
    result.device = {};
    for (const key of DEVICE_FIELDS) if (input.device[key] !== undefined) {
      if (typeof input.device[key] !== 'string' || input.device[key].length > 200) throw Error('Invalid device information.');
      result.device[key] = input.device[key];
    }
  }
  if (input.screenshot !== undefined) {
    const base64 = input.screenshot?.base64;
    if (typeof base64 !== 'string' || base64.length > 4 * Math.ceil(MAX_SCREENSHOT_BYTES / 3) || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 || !base64.startsWith('iVBORw0KGgo')) throw Error('Choose a PNG screenshot no larger than 3 MB.');
    const head = atob(base64.slice(0,44));
    const integer = offset => Array.from(head.slice(offset,offset+4)).reduce((value,char)=>value*256+char.charCodeAt(0),0);
    const width = integer(16), height = integer(20);
    if (head.slice(12,16) !== 'IHDR' || !width || !height || width > 4096 || height > 4096 || width*height > 8000000) throw Error('Screenshot dimensions are too large or invalid.');
    result.screenshot = {name:'screenshot.png',base64};
  }
  return result;
}
function feedbackText(report) {
  return [
    'eQc feedback', `Report ID: ${report.id}`, `Type: ${report.kind}`, `Sender name: ${report.senderName}`, `Reply to: ${report.replyTo}`, `Subject: ${report.subject}`,
    '', 'Description', report.description,
    ...(report.steps ? ['', 'Steps to reproduce', report.steps] : []),
    ...(report.expected ? ['', 'Expected behaviour', report.expected] : []),
    ...(report.device ? ['', 'Device information', ...Object.entries(report.device).map(([key,value])=>`${key}: ${value}`)] : []),
    '', report.screenshot ? 'Screenshot: screenshot.png (attached)' : 'No screenshot attached.'
  ].join('\n');
}
module.exports = {RECIPIENT,MAX_SCREENSHOT_BYTES,DEVICE_FIELDS,validateFeedback,feedbackText};
