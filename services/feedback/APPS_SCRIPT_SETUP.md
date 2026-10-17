# Google Apps Script setup for eQc feedback

This is the default zero-budget backend. It uses your existing Google account and a Google-hosted URL. No website, purchased domain, Cloudflare/Resend account, API key or Gmail password is needed in eQc.

**Status:** the owner's Google deployment is configured. Anonymous health and invalid-report POST checks passed, including Google's response redirect, and the desktop build succeeded. No email was sent by those checks. Restart eQc and submit a report to verify actual inbox delivery. The setup steps below also cover future deployments.

**Required-name update:** replace the deployed source with the latest generated `Code.gs` and deploy a **New version** of the existing deployment. The URL stays the same. The updated health JSON includes `requiredFields: ["senderName", "replyTo"]`; the older hosted version does not enforce sender name.

## Your one-time setup

1. Sign in to [Google Apps Script](https://script.google.com/) with the account that will send reports, ideally `anisur.rahman.bayazid@gmail.com`.
2. Choose **New project**, name it **eQc Feedback**, and open its `Code.gs`.
3. Replace its contents with the entire [apps-script/Code.gs](apps-script/Code.gs) from this repository and save. Paste this single generated file, not `backend.gs` separately.
4. Select **authorizeFeedback** from the function dropdown and click **Run**. Review and approve your own script's email-sending permission. This checks the remaining quota and sends no email. It does not request permission to read your inbox or Drive.
5. Choose **Deploy → New deployment → Web app**, then set **Execute as: Me** and **Who has access: Anyone**.
6. Deploy and copy the public **Web app URL**, such as `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`. Use `/exec`, not `/dev`, the editor URL or a redirected `googleusercontent.com` URL.
7. Give that public URL to the app maintainer to connect eQc. No password or authorization token needs to be shared. If account policy does not offer **Anyone**, tell the maintainer; choosing a signed-in-only option will not work for anonymous desktop reports.

Users do not need Google accounts to submit reports through this deployment. It executes under the deploying owner's authorization. Sender name and email are mandatory, prefilled from the profile when present and editable before sending. Reports go only to `anisur.rahman.bayazid@gmail.com`; the reporter's address becomes Reply-To and their name appears in the message body. These are supplied contact details, not verified identity; rate limits still apply.

## Connect eQc

From the repository root:

```powershell
node services/feedback/configure-desktop.cjs https://script.google.com/macros/s/DEPLOYMENT_ID/exec
npm run build
```

Restart Electron after configuring the URL. Packaging includes the public URL from `electron/feedbackConfig.cjs`; that file contains no credentials. Development can override the URL with `EQC_FEEDBACK_ENDPOINT`.

Opening the public URL should return JSON identifying `eQc feedback`, `google-apps-script`, schema version 1 and the daily cap. This checks connectivity, not remaining Google quota or actual inbox delivery. Send a real report from eQc when ready to verify delivery and reply-to behaviour.

Google redirects ContentService responses to a one-time `script.googleusercontent.com` URL. The desktop follows this one allowed response redirect with a GET. It never reposts the report, follows a login page or follows unrelated hosts. A login page is a failure, never a successful submission.

## Limits and data handling

- The script reserves at most **50 sending attempts per rolling 24 hours**, five per minute globally and three per hour for one reply address. It also checks Google's remaining quota. Consumer accounts currently have an Apps Script allowance of 100 email recipients/day shared with other scripts; the lower app cap leaves headroom. Hitting a limit does not purchase extra capacity: the form keeps the draft and offers its ZIP download.
- One optional PNG screenshot is accepted, at most 3 MB. eQc converts/resizes selected PNG/JPEG files locally. Only the selected image is attached.
- Only reviewed report fields (including mandatory sender name/email) and selected device/screenshot data are submitted. Project files/names, transcripts, other profile fields/photos, local paths and logs are not collected. A screenshot can contain visible research text, which users preview and can remove.
- Script Properties hold only counters, timestamps, hashed reply addresses and report IDs/content hashes. The deduplication window is 48 hours; expired entries are pruned when the next valid report is processed. Report bodies and screenshots are not saved in Properties or Drive. Email is retained in the receiving inbox and handled by Google's services normally.
- ScriptLock serializes quota reservation, duplicate checks and sending. A confirmed retry returns its original acknowledgement without another email. An interrupted/failed send remains uncertain and cannot be resent automatically, because it may already have reached MailApp. This conservative choice avoids duplicate mail at the cost of occasional manual follow-up.
- The endpoint is public. Fixed-recipient checks and persistent caps limit mail abuse, but public requests can still exhaust the free allowance. There is no embedded secret, automatic background sending, or end-user account access.
- MailApp returning successfully means the call was accepted, not proof of inbox placement. The app does not display raw server errors or mistake Google sign-in HTML for success.

## Update the deployment

After editing the shared schema or controller, run:

```powershell
node services/feedback/apps-script/build.cjs
```

Paste the regenerated `Code.gs` into the existing Apps Script project. Choose **Deploy → Manage deployments → Edit → New version → Deploy** to update the existing deployment and retain its URL. Saving source alone does not update a versioned `/exec` deployment.

## Verification

```powershell
node --test tests/feedback.cjs tests/feedback-apps-script.cjs tests/shortcuts.cjs
node tests/feedback-browser.cjs
```

Tests simulate Google services and HTTP redirects; they send no real email. Live authorization, public access and inbox delivery require your deployment.

Official references: [web-app deployment](https://developers.google.com/apps-script/guides/web), [ContentService redirects](https://developers.google.com/apps-script/guides/content#redirects), [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app), [quotas](https://developers.google.com/apps-script/guides/services/quotas), and [LockService](https://developers.google.com/apps-script/reference/lock/lock-service).
