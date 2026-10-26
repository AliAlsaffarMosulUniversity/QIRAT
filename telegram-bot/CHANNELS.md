# Telegram channel publishing

The application administrator can now open **لوحة المدير → قنوات Telegram**. The existing bot still accepts announcements into QIRAT; channel publication is a separate, explicit administrator action. WhatsApp and Messenger are deferred.

## Saved channel and direct text/photo composer

The administrator can also use the **إرسال إلى Telegram** shortcut. Connected channels are retained on the server. The publishing default is stored in `_qiratTelegramSettings/publishing` and is used across devices and sign-ins. The first connected channel becomes the default; for channels connected before this feature, the UI selects the first saved enabled channel automatically. **حفظ هذه القناة كافتراضية** persists a different selection. Adding a new channel is under collapsed settings, so an existing channel ID never needs to be re-entered to publish.

The direct composer sends the administrator's complete text and optional image straight to the selected Telegram channel. It does not invent structured funeral details or create a separate funeral entry on the public QIRAT list. The explicit submit button sends once and saves the resulting message ID. Browser image uploads accept JPEG/PNG/WebP up to 15 MiB, resize to at most 1600 pixels on the long edge and encode JPEG. The server checks actual file signatures, restricts the outgoing image to 5 MiB, authenticates the administrator before reading the upload, and caps the entire multipart body at 6 MiB. Uploaded image bytes are passed to Telegram rather than stored in Firestore; the ledger stores Telegram's file ID.

Telegram's photo caption limit is 1024 characters; text-only messages allow 4096. The composer shows a character counter. **تعديل الرسالة** loads the saved text into the editor. **حفظ تعديل الرسالة** edits that same message using editMessageCaption for photo captions, editMessageMedia when replacing an existing photo, or editMessageText for text-only messages. A text-only post cannot be converted into a photo post through this editor. Deletion uses a two-click confirmation within the application instead of a native browser popup.

## Deployment

1. Deploy the complete `telegram-bot` directory using its `wrangler.jsonc` (`npx wrangler deploy` from that directory). `worker.mjs` now imports `channels.mjs`; pasting only worker.mjs into an inline editor is insufficient.
2. Retain the existing secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `TELEGRAM_ADMIN_ID`. The configured bot must be @QiratMosulAlertsBot. The service account must belong to the existing Firebase project. Never put these secrets in browser code, Git, URLs or messages.
3. Run the existing `/setup` activation again so Telegram delivers `message` and `my_chat_member` updates. Existing pending updates are preserved. Discovery never activates a channel or sends to it.
4. Publish the updated static application files (`index.html`, `firebase.js`, `telegram-channels.js`, `sw.js`) through the repository's existing site deployment. No Firestore rules change is needed: channel collections are private and the worker uses its service account.
5. Sign in using the same verified Google administrator as the existing Firestore rules. The worker independently checks that account through Firebase; a visible browser button alone is never authorization.

## Connect a private channel

Add the bot as administrator with post, edit and delete permissions. The Telegram user configured in TELEGRAM_ADMIN_ID must be the channel's creator or an administrator. Forward a channel post to the bot from that user. The bot records `forward_origin.chat.id` as a candidate. If forwarding is disabled, a new membership/permission update after webhook activation can also discover the channel. An actual numeric channel ID can also be entered directly.

An invitation link such as `https://t.me/+…` cannot be used as `chat_id`. Its invite token is not stored. No attempt is made to join a private channel using a bot invite URL. Choose the candidate in the application and click **التحقق وربط القناة**. The worker checks getMe, getChat and both the configured user's and bot's getChatMember status before connecting, and repeats permission checks before each Telegram mutation.

Each channel can be enabled or disabled independently. Disabling blocks new messages; existing saved messages can still be edited or deleted after permission checks. This release deliberately uses administrator-selected channel actions; it does not automatically broadcast every new funeral announcement.

## Safe live test

Select only the user's authorized private test channel. Click **نشر رسالة الاختبار في هذه القناة**. The exact first message is:

> اختبار تقني لنظام قيراط – ليس إعلان وفاة حقيقياً

After the ledger shows a saved `message_id`, use **تعديل الاختبار**, then **حذف الرسالة من Telegram**. The edit keeps the disclaimer and adds a technical-test line. Record the resulting channel ID, message ID and states, without credentials. Automated tests use fakes and do not perform this live test.

## Data and failure behavior

- `_qiratTelegramCandidates/{chat_id}` stores discovery hints only.
- `_qiratTelegramChannels/{chat_id}` stores numeric chat_id, title, enabled and last successful connection/verification time. Permission checks also happen immediately before every message mutation.
- `_qiratTelegramChannels/{chat_id}/deliveries/{delivery_id}` stores chat_id, message_id, action, state, timestamps, text and whether the message is a test. Real announcement IDs double as delivery IDs, preventing repeated publication of the same announcement to the same channel. Tests use separate UUIDs.
- `pending` is committed with an optimistic concurrency precondition **before** Telegram is called. Successful Telegram results are persisted as `sent` or `deleted`. A timeout or failure to save the response leaves `pending`; do not automatically resend. Check the actual channel manually. This cannot provide an atomic transaction across Firestore and Telegram, whose sendMessage endpoint has no idempotency key. Automated reconciliation is not included in this release.
- Editing reads the current saved QIRAT announcement, never arbitrary HTML from the browser. Deleting targets only a positive message_id previously saved for that channel and delivery. Test/real actions cannot be mixed. A deleted publication is retained as a tombstone and is not republished automatically.
- Changing/removing an announcement in QIRAT does **not** automatically edit/delete its channel message. Use the delivery controls separately. Deletion of a saved channel message still works after its QIRAT announcement is removed.
- Telegram errors are replaced by fixed codes. Bot tokens, service account contents and Firebase identity tokens are not returned or logged. A failed or revoked permission check prevents sending.
- Channel and delivery listing currently reads at most 1,000 records per collection and fails closed above that limit. Add pagination/retention before exceeding it. Public Firestore rules continue to deny access to the private ledger.

## Verification

From repository root:

```
node telegram-bot/channels.test.mjs
node telegram-bot/test.mjs
node telegram-bot/visitors.test.mjs
node tests/visitors-ui.cjs
```

The new tests cover numeric IDs/invite rejection, channel discovery, verified administrator access, origin rejection, multiple channels, owner/bot permissions, stored message IDs, publish/edit/delete, duplicate and concurrency protection, ambiguous network results, failed ledger persistence and secret-safe responses. They do not certify deployed Cloudflare secrets or live Telegram permissions.

Official references: [Telegram Bot API](https://core.telegram.org/bots/api) and [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
