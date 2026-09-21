BALLROOM ONLINE — BUG FIX + CHECK-IN CAMERA + PORTRAIT PLACE CARDS V2

Upload/replace these files in the ROOT of the existing GitHub repository:

common.js
admin.js
admin.html
tickets.js
tickets.html
summary.js
summary.html
styles.css
checkin.js
checkin.html
checkin-ipad.css
placecards.js
placecards.html

DO NOT replace:
firebase-config.js
google-sheet-config.js
access.js
menu.html
assets/

FIXES
1. Admin guest/gift data
- Seat edits use targeted Firebase updates instead of replacing the complete seat record.
- Gift redemption saves immediately when Yes/No is changed.
- Legacy gift values (true / yes / giftRedemption) are recognized.
- Confirm & QR keeps the gift setting and guest details.

2. Ticket gift group
- Gift ticket filter recognizes current and legacy gift values.
- Guest name, seat and QR remain on the main ticket.
- Existing Standard 10/A4 and Gift Redemption 8/A4 formats are retained.

3. Check-in
- Front and Back buttons added.
- Actual camera device selector added after Safari camera permission is granted.
- Smaller live camera box.
- Large wedding logo remains centered.
- Manual seat check stays on the left; live camera stays on the right.
- Compatible with iPad Safari and desktop/notebook webcams.

4. Place Cards
- A4 PORTRAIT.
- 3 folded cards per sheet, stacked vertically.
- Front left: large seat number only.
- Front right: full guest name only, plus small wedding logo at bottom center.
- Back left: DINNER MENU only.
- Back right: menu QR only.
- No SEAT / GUEST / FULL NAME helper text.
- Safe print dimensions leave a little spare printable area to reduce blank-page errors.

AFTER UPLOAD
1. Commit changes.
2. Wait for GitHub Pages to deploy.
3. Desktop: Ctrl + Shift + R.
4. iPad Safari: close the old tab and reopen the page once to avoid cached JS/CSS.

For Place Cards, test one duplex sheet first. With portrait printing, start with Flip on long edge. Printer behavior can vary, so confirm front/back orientation before the full run.
