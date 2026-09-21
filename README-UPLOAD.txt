BALLROOM ADMIN - SAVE GUARD 5.1

UPLOAD ONLY TWO FILES TO THE EXISTING GITHUB REPOSITORY ROOT:
  admin.html
  admin.js

This is a focused Admin patch, not a full website replacement.
Do not upload this README or test report as JavaScript files.
Do not change firebase-config.js, google-sheet-config.js, common.js,
access.js, styles.css, database rules, or the Check-in/Display/Tickets pages.
The existing common.js must be the gift/plan-safety version from the recent updates.
It already exports runTransaction and the other imported Firebase helpers.

BEFORE UPLOADING
1. Export the current ballroom JSON backup.
2. Download/save a copy of your current admin.html and admin.js.
3. Close older Admin tabs on every editing device, retaining any unsaved text first.
4. Upload BOTH replacement files together and commit.
5. Wait until GitHub Pages reports a successful deployment.
6. Open Admin with a hard refresh. Confirm the Selected seat panel says:
   SAVE GUARD 5.1
   (not an older version, and not a label that stays at "loading").

NEW SAVE WORKFLOW
1. Select a seat and type the complete guest details.
2. Choose Gift redemption Yes or No.
3. Click Save Guest Details or Confirm & QR.
4. Wait for the green message "Saved to Firebase".
5. Select another seat, return, and check the details.

Gift redemption no longer sends its own automatic save. This avoids the old
pending gift-save response overwriting newer typing in the form.
New typing entered during an in-progress save remains a DRAFT. Click Save again
when the first save has finished. The status will explicitly tell you this.

DRAFT PROTECTION
- Each seat has its own draft. Switching seats does not erase the previous draft.
- Drafts are copied to this browser's local storage when available.
- Reopening Admin can recover those drafts on the same browser/origin.
- Unsaved local drafts are NOT a server backup and do not sync between devices.
- Private mode, clearing browser storage or device loss can remove local drafts.
- Download drafts is an additional local recovery export. It is NOT a complete
  room backup and must not be imported using Import Backup.
- Discard local draft reloads the saved values only after confirmation.
- A blank guest name will not silently erase an existing reservation through Save.
  Use Clear reservation intentionally instead.

CONFLICTS AND ERRORS
- Writes use a per-seat transaction with applyLocally:false.
- The latest server check-in state and unrelated seat fields are preserved.
- Same-field concurrent edits are rejected rather than silently overwritten.
- Permission/connection errors keep the draft and show NOT SAVED.
- An old page or another writer can still change data later. This patch cannot
  control old code running on someone else's device. Close outdated Admin tabs.
- Client-side PIN protection remains unchanged. This patch does not upgrade
  the database's access-control security or weaken its rules.

UNCHANGED
The seating layout, row count, PIN flow, QR payload format, check-in screens,
printed ticket/place-card designs, menu page and Google Sheet settings are not
replaced. No automatic reset, cleanup, re-numbering or layout migration is run
when opening an existing room in this Admin patch.

VALIDATION
The previous V4 overwrite was reproduced, and the new code passed the 18
browser regression checks listed in TEST-RESULTS.txt. Tests used a simulated
Firebase adapter, not your production database. The live GitHub files could
not be retrieved during this session, and no production writes were made.

FIRST LIVE TEST
Use a spare seat in H, enter a test name + Gift Yes, click Save and wait for
Saved to Firebase. Switch to another seat and return. Then verify the same
seat on Summary / Tickets. Remove only the test guest when finished.
If something fails, capture the version label, selected seat ID and the exact
status message. No password or Firebase private key is needed for diagnosis.
