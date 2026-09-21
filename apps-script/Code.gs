function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const rawSheetId = String(payload.sheetId || '').trim();
    const match = rawSheetId.match(/(?:\/spreadsheets\/d\/)?([a-zA-Z0-9_-]{20,})/);
    if (!match) throw new Error('Cannot detect Google Sheet ID.');
    const ss = SpreadsheetApp.openById(match[1]);
    const name = ('Ballroom ' + payload.roomId).slice(0, 99);
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.clearContents();
    const headers = ['Seat','Guest','Group','Group ID','Status','Confirmed','Checked In','Checked In At','Gift Redemption','Conditions','Notes'];
    const values = (payload.rows || []).map(s => [s.id,s.guestName,s.groupName,s.groupId,s.status,!!s.confirmed,!!s.checkedIn,s.checkedInAt ? new Date(s.checkedInAt) : '',s.souvenirEligible ? 'YES' : 'NO',s.conditions,s.notes]);
    sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');
    if (values.length) sh.getRange(2,1,values.length,headers.length).setValues(values);
    sh.setFrozenRows(1); sh.autoResizeColumns(1,headers.length);
    return ContentService.createTextOutput('Google Sheet synced successfully.');
  } catch (err) {
    return ContentService.createTextOutput('Sync failed: ' + err.message);
  }
}
function doGet(){ return ContentService.createTextOutput('Ballroom sync endpoint is active.'); }
