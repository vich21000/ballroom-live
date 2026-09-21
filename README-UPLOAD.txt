BALLROOM GIFT + MENU + PLACE CARDS UPDATE

WHAT THIS ADDS
1) Admin: Gift redemption Yes/No per guest.
2) Tickets: Standard tickets remain 85 x 50 mm, 10/A4.
3) Gift Redemption tickets: main ticket stays exactly 85 x 50 mm plus a 14 mm tear-off VARX stub, 8/A4.
   - VARX logo left
   - GIFT REDEMPTION large
   - small seat number
   - dotted tear line + scissors
   - light/thin cutting borders
4) Public menu page: menu.html, dark warm background, white event logo, bilingual long-scroll mobile design.
5) Place Cards: placecards.html, A4 landscape, 3 guests/A4.
   - Front: large seat | full guest name
   - Back: DINNER MENU | QR to menu.html
   - Duplex/front-only/back-only print modes
6) Summary/CSV/Google Sheet includes Gift Redemption eligibility.

UPLOAD TO GITHUB ROOT
- common.js
- admin.html
- admin.js
- tickets.html
- tickets.js
- summary.html
- summary.js
- styles.css
- menu.html
- placecards.html
- placecards.js
- assets/varx-logo.png

The package also contains assets/color-logo.png and assets/white-logo.png for completeness. If your current logo files are already correct, you may keep them.

GOOGLE SHEET (OPTIONAL BUT RECOMMENDED)
Replace Apps Script Code.gs with apps-script/Code.gs, then Deploy > Manage deployments > Edit > New version > Deploy.
This adds the Gift Redemption column to the synced sheet.

DO NOT REPLACE
- firebase-config.js
- google-sheet-config.js
- access.js
- checkin files
- display files
Your existing working configuration and iPad Check-in remain unchanged.

PUBLIC MENU URL
https://vich21000.github.io/ballroom-live/menu.html

PLACE CARD URL
https://vich21000.github.io/ballroom-live/placecards.html?room=main-ballroom

PRINT NOTES
Tickets: A4 portrait.
Place cards: A4 landscape, 3 guests/sheet. Duplex printing normally uses Flip on short edge; test one sheet first because printer drivers vary.
