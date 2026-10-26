# WhatsApp manual composer
The administrator opens a WhatsApp icon, edits one message field, and clicks one WhatsApp icon. The technical test text is prefilled; it can be edited. There are no sharing modes, acknowledgement checkboxes or automatic publication settings.

The official wa.me/?text= link opens WhatsApp with the encoded text. The user must select only the owned test group and press Send inside WhatsApp. The invitation URL supplied by the owner cannot select that recipient or send to it directly. No other 23 groups are configured. The UI does not claim delivery.

Automatic WhatsApp sending remains unimplemented. The previous post-publication reminder was removed at the owner's request to simplify the UI. No credentials or unofficial automation are used.

Official API reference: https://developers.facebook.com/documentation/business-messaging/whatsapp/groups
QIRAT account eligibility and API access to the existing group remain unverified. Meta returned HTTP 429 in the earlier verification attempt; do not infer API support from an invite link or ownership.

Validation: node tests/whatsapp-sharing.cjs
No real messages are sent in tests.
