# Messenger manual sharing

Administrator-only composer with the two owner-supplied m.me/ch links, labelled using the verified invitation titles. A native link click copies the current message and opens only that conversation. The administrator pastes and confirms sending inside Messenger, then repeats for the other conversation. No API sending, recipient enumeration, automatic joining, delivery claim or background message is implemented.

Session-only draft storage is scoped to the signed-in administrator UID. Clipboard failures select the textarea and show manual-copy instructions. Empty drafts and non-admin clicks do not navigate. Opening a link is not tracked as sent. Both links may show join or login screens depending on the user's Messenger session.

Verification uses mocked clipboard/navigation only: node tests/messenger-sharing.cjs. No actual messages are sent.
