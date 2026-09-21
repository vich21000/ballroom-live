Ballroom Admin + Gift Ticket + Place Card Fix V3

Upload/replace these files in the GitHub repository root:
- admin.js
- admin.html
- tickets.js
- tickets.html
- placecards.js
- placecards.html
- styles.css

Do not replace firebase-config.js, google-sheet-config.js, access.js, checkin files, display files, menu.html, or assets.

Fixes:
- Admin edit/save now works even when Plan Lock is active: entering PIN 1800 unlocks editing.
- Saving a guest automatically creates a guest QR token and marks the seat confirmed/reserved so check-in and ticket printing work immediately.
- Gift Redemption Yes/No persists when changed.
- Ticket page defaults to Assigned guests so Gift Redemption tickets no longer disappear because of an old confirmed flag.
- Place Card back left: smaller DINNER MENU, event logo, English + Thai buffet invitation.
- Place Card back right: QR + SCAN TO VIEW MENU.
