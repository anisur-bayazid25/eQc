// Run once with the deployed public URL, then rebuild the desktop app.
const fs=require('node:fs'),path=require('node:path');
const {feedbackEndpoint}=require('../../electron/feedback.cjs');
const endpoint=feedbackEndpoint(process.argv[2]);
if(!endpoint || (new URL(endpoint).hostname!=='script.google.com' && new URL(endpoint).pathname!=='/reports'))throw Error('Provide the public Apps Script /exec URL (or an existing HTTPS /reports service).');
fs.writeFileSync(path.resolve(__dirname,'../../electron/feedbackConfig.cjs'),`// Public service URL only. Never put passwords or tokens here.\nmodule.exports = { endpoint: ${JSON.stringify(endpoint)} };\n`);
console.log('Public feedback endpoint configured. Rebuild and restart eQc.');
