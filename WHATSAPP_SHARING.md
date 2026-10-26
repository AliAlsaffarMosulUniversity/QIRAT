# WhatsApp sharing pilot
Status: 2026-10-27. Manual sharing only; automatic publishing is disabled.

Official reference: https://developers.facebook.com/documentation/business-messaging/whatsapp/groups
Meta returned HTTP 429 during implementation. QIRAT account eligibility and support for the supplied existing group have NOT been verified. Do not claim that all group APIs are unavailable: an official Groups API exists with eligibility restrictions, which must be checked against current official documentation before integration. An invitation link is not a Cloud API group_id or proof of account eligibility.

## Available UI
Administrator-only “إرسال إلى المجموعات” opens a preview of the exact fixed test message. No announcement data is included.
The administrator must acknowledge selecting only the owned test group before opening WhatsApp via wa.me/?text= or the device Web Share API. A separate invitation link displays the test group, without attaching a message.
Clipboard copying remains available. Cancellation is handled without claiming delivery. Opening a link or resolving Web Share does not prove a recipient or delivery.

The optional local browser preference shows this preview after successful creation of a new announcement by the administrator. It never opens WhatsApp automatically. Edits and imports do not trigger it. QIRAT currently publishes directly with status published; there is no separate approval workflow.

## Pilot boundary
No list of the other 23 groups, bulk loop, WhatsApp network sender, credentials, or unofficial automation is included.
The browser cannot constrain recipients inside WhatsApp. The user must select only the supplied owned test group and review its name before pressing Send in WhatsApp.
No actual message or share dialog was opened during verification.

## Owner acceptance check
Log in as administrator; inspect the fixed Arabic test text. Acknowledge the single-group restriction, open WhatsApp, select only the owned test group, and review before sending. Do not select the other 23 groups.
Cancel once and verify no delivery claim. Enable the local prompt and verify it appears after successful new publication, never failed saves or edits.

## Future automatic delivery
Keep disabled until current official API support, OBA/account eligibility, supported Cloud API number, and the intended group_id are verified. Do not infer API access from ownership or convert invite tokens to group IDs.
A future integration needs server-side approval events and authorization, secrets stored only on the server, an explicitly authorized single test destination, idempotency, delivery status records and verified webhooks. Never use WhatsApp Web/session automation or ask for login codes.

Run: node tests/whatsapp-sharing.cjs
