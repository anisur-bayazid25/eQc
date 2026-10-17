# eQc feedback service

Google Apps Script is the default zero-budget backend. No website, purchased domain, paid hosting or API key is needed.

Start with [APPS_SCRIPT_SETUP.md](APPS_SCRIPT_SETUP.md). Paste the complete [apps-script/Code.gs](apps-script/Code.gs) into your Google Apps Script project, authorize it, then deploy a public web app that executes as you. Provide its public `/exec` URL to connect eQc.

The backend caps sending at 50 attempts per rolling 24 hours, supports screenshot attachments and Reply-To, and prevents automatic duplicate sends. The deployed Google endpoint is configured and anonymous GET/POST checks passed. Actual inbox delivery still needs a report submitted from the restarted app. Tests and connection checks send no real email.

Sender name and reply email are now mandatory in the desktop form and backend validation. **Update the hosted script:** paste the latest `apps-script/Code.gs`, then use **Deploy → Manage deployments → Edit → New version → Deploy**. Keep the same URL. The old deployed version cannot enforce the new required-name rule until updated. These fields identify a report but do not verify the sender; existing rate limits remain in effect.

The older Cloudflare/Resend implementation is retained as an unconfigured [optional alternative](CLOUDFLARE_RESEND_OPTIONAL.md). It is not needed for this setup.
