# QIRAT Telegram bridge on Cloudflare Workers Free

Bot: https://t.me/QiratMosulAlertsBot

The worker receives private messages from one configured Telegram user. Complete announcements publish directly to the existing Firestore announcements collection. When data is missing, the bot asks for it. Prayer names are used instead of exact clock times. "After Fajr" selects fajr; the bot never invents a clock time.

## Deploy

Deploy worker.mjs as an ES-module Cloudflare Worker named qirat-telegram-bot. It has no npm dependencies. wrangler.jsonc is provided for CLI deployments. No change to the existing GitHub Pages site or Firebase billing plan is required.

Add these values under Worker Settings → Variables and Secrets. Use Secret type for credentials:

- TELEGRAM_BOT_TOKEN: issued by BotFather for QiratMosulAlertsBot.
- TELEGRAM_WEBHOOK_SECRET: a random string at least 24 characters long, containing only letters, numbers, underscores and hyphens.
- FIREBASE_SERVICE_ACCOUNT_JSON: the full service-account JSON for project qirat-6f86e. Use a dedicated account with the Cloud Datastore User role on this project; do not grant project Owner. Its OAuth scope is restricted to datastore by the worker. The service account bypasses Firestore Security Rules, so keep its key secret and revoke it if exposed.
- TELEGRAM_ADMIN_ID: your numeric Telegram user ID, stored as text. This identifies the sender, never a forwarded message's original author.

Non-secret optional variables:

- FIREBASE_PROJECT_ID: qirat-6f86e (default).
- APP_URL: https://alialsaffarmosuluniversity.github.io/QIRAT/ (default).
- DEFAULT_CITY: الموصل (default).

To obtain your Telegram ID without a third-party bot, first configure only TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET, visit the worker's /setup page, enter the webhook secret, and activate. Send /start to the bot: it returns your own ID and will not publish yet. Add TELEGRAM_ADMIN_ID and FIREBASE_SERVICE_ACCOUNT_JSON, then activate /setup again. The setup page checks Firebase read access before activation of the configured bridge. The first /new tests storage writes without publishing an announcement.

The /setup page refuses to overwrite a different existing Telegram webhook. It sets max_connections to 1 and allowed_updates to message. It preserves pending Telegram updates; messages sent before setup may still be processed if Telegram retained them. Send /cancel before starting a new announcement when needed.

## Behavior

- Text or photo captions are supported; no OCR or audio transcription.
- Missing name is represented as unnamed only if the original post gives the deceased's gender. Otherwise the bot asks.
- Missing Gregorian date or prayer name is requested. Explicit "today/tomorrow" uses the Telegram message timestamp in Asia/Baghdad, not the server timezone. Hijri dates are not misread as Gregorian dates.
- Mosque, city, date, prayer, gender and a display name are required. Cemetery, district and map are optional. Mosque, district, cemetery and map are extracted when recognizable; no external text-to-AI service is used.
- /cancel clears pending fields; /new starts fresh; /status returns the pending question or last published link.
- UUID announcement IDs remain compatible with the website. ownerUid is telegram:<admin-id>; the website's verified Google administrator can delete these posts using the admin panel. Editing them through a different Google owner is intentionally unavailable.
- Duplicate webhook deliveries are ignored through atomic update markers. The same complete name/location/date/prayer/cemetery tuple is deduplicated as well; two distinct unnamed funerals with identical fields may be treated as the same event. Use an identifying name/detail or edit the source data if this occurs.
- Draft and processing data are stored in private _qiratTelegramSessions, _qiratTelegramUpdates and _qiratTelegramDuplicates collections. Current web security rules deny access to these collections. The worker does not store forwarded full-message text publicly.
- Publication and processing markers commit atomically. Telegram delivery of the confirmation is a separate API call; if it fails after publication, /status retrieves the saved link without republishing.
- Internal processing/dedup records do not expire automatically. Review retention and Firestore usage as the bot grows. Worker and Firestore free-tier quotas still apply; no unlimited usage is promised.

## Test

Run node test.mjs. Tests cover the supplied Arabic sample, missing prayer name, leap dates, unauthorized senders, webhook authentication, retries, content deduplication, cancellation, and database errors. Live Google access and publication must be checked after secrets are configured. No production funeral announcement is created by the test suite.

References: https://core.telegram.org/bots/api#setwebhook, https://developers.cloudflare.com/workers/configuration/secrets/, https://firebase.google.com/docs/firestore/use-rest-api.
