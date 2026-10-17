# Optional alternative — Cloudflare and Resend

The default backend is now Google Apps Script. This older alternative is retained for reference and is not activated.

# eQc feedback service

The app-side form and service are implemented. **Live delivery is not activated:** no hosting account, email-service key or deployed URL is configured in this checkout. Until activation, the form clearly disables Send and still offers a ZIP download. No real email is sent by the tests.

## Delivery flow

The user opens Feedback in the toolbar, Help → Report a problem / Suggest a feature, or Ctrl+Shift+B (Cmd+Shift+B on macOS). The eQc window is captured before the form opens. Users can retake, replace or remove the screenshot, edit their profile-supplied reply email, review or exclude device information, and send only when ready.

The desktop main process validates the report and POSTs it to a fixed HTTPS service URL. The Cloudflare Worker validates it again and calls Resend with a server-side key. The recipient is fixed in `electron/feedbackSchema.cjs` to `anisur.rahman.bayazid@gmail.com`; clients cannot change it. The reporter's address becomes Reply-To. The From address belongs to the developer's verified sender domain, not the reporter.

Only the typed report, chosen screenshot and selected device fields are submitted. Project files, transcripts, source/project names, profile names/photos, usernames, local paths and logs are not collected by this feature. A chosen screenshot can contain visible research text; the form explicitly provides preview and removal. Closing the dialog retains the draft in memory until sent or the app exits. It is not written into a project, LAN session or backup.

## Activate the service

Use a Cloudflare account and a Resend account. For production delivery, set up a sender using a domain you control and verify it with Resend. The receiving inbox remains the Gmail address above. Use a current supported Node.js runtime for Wrangler (Node 24 was used for the deployment dry run).

1. Open a terminal in `services/feedback` and authenticate your Cloudflare account:

   ```powershell
   npx --yes wrangler@4 login
   ```

2. Create a sending API key in Resend. Enter it at the secret prompt; do not paste it in chat or commit it:

   ```powershell
   npx --yes wrangler@4 secret put RESEND_API_KEY
   ```

3. Store the verified sender address using the next secret prompt, for example `eQc Reports <reports@YOUR_VERIFIED_DOMAIN>`:

   ```powershell
   npx --yes wrangler@4 secret put FEEDBACK_FROM
   ```

4. Deploy the Worker:

   ```powershell
   npx --yes wrangler@4 deploy
   ```

5. Check the deployed `/health` endpoint. It must return HTTP 200 with `ready: true`. This confirms service configuration, not inbox delivery. The `/reports` endpoint accepts desktop POSTs; it is not an online form.

6. From the repository root, configure the **public URL**, rebuild and restart eQc:

   ```powershell
   node services/feedback/configure-desktop.cjs https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/reports
   npm run build
   ```

   The helper changes only `electron/feedbackConfig.cjs`. The URL is public and can ship in the app; the Resend key must stay in Cloudflare secrets. For development, `EQC_FEEDBACK_ENDPOINT` can override the public endpoint when starting Electron. Changing it requires restarting Electron.

7. Send a report from eQc with your own screenshot, confirm that it reaches the receiving inbox and that replying targets the reporter. The form says “accepted for email delivery” only after Resend accepts the request; it does not claim final inbox placement. After this live check, package the desktop app normally so users receive the configured endpoint.

## Limits and operations

- One PNG screenshot is sent, at most 3 MB. Picked PNG/JPEG files are limited to 10 MB and converted/resized locally; the main process captures only the eQc window, not the desktop.
- The Worker limits total request size and rejects browser origins, invalid fields and unsupported methods. It is a public desktop endpoint; an embedded secret would not authenticate a distributed app.
- Cloudflare's rate limiter applies five requests per minute per hashed IP/reply address, plus a five-email-per-minute service key. Its counters are approximate and local to Cloudflare locations, not a global daily budget. Configure provider quotas/alerts and monitor the Resend dashboard before a public release. IP addresses are used transiently for rate limiting, not inserted into emails. Worker observability is disabled in this configuration; Cloudflare and Resend still have their own infrastructure/data handling policies.
- Reports have stable IDs during retries. Resend idempotency reduces duplicate emails when an acknowledgement is lost; keys expire after 24 hours. Editing a report gives it a new ID.
- The service never returns provider errors or keys to the app. A successful provider response is required before acknowledging a report. Failed reports stay in memory for retry or ZIP download; there is no automatic background submission.
- A saved ZIP contains only `report.txt` and the selected `screenshot.png`, if any. It is saved only where the user chooses.

## Verification

```powershell
node --test tests/feedback.cjs tests/shortcuts.cjs
node tests/feedback-browser.cjs
```

Run these from the repository root. The browser check uses the existing Playwright setup and mocks email delivery. To validate the Worker bundle without deploying, run `npx --yes wrangler@4 deploy --dry-run --outdir ../../release/feedback-worker-qa` from this directory.

Official references: [Cloudflare rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email), [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction), and [Electron window capture](https://www.electronjs.org/docs/latest/api/web-contents#contentscapturepagerect-opts).
