// Your Fresh Start -- weekly backup to Google Drive.
// Lives in a Google Apps Script project in the owner's Google account (not in
// the website). Once a week it asks the website for a full copy of the data
// and saves it as a file in a Drive folder called "YFS Backups", keeping the
// newest 12 copies. Setup steps are in the chat/README; contains no secrets.

const SITE = 'https://yfs-kpi-tracker-build.vercel.app';
const FOLDER_NAME = 'YFS Backups';
const KEEP = 12;

// Run this ONCE. It makes a long random password, stores it in this script,
// and shows it so you can paste the same value into Vercel as BACKUP_TOKEN.
function setupToken() {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('BACKUP_TOKEN', token);
  Logger.log('Copy this value into Vercel as BACKUP_TOKEN:\n\n' + token);
}

// This is the one that runs every week.
function weeklyBackup() {
  const token = PropertiesService.getScriptProperties().getProperty('BACKUP_TOKEN');
  if (!token) throw new Error('Run setupToken first.');

  const res = UrlFetchApp.fetch(SITE + '/api/backup', {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Backup failed: the website answered ' + res.getResponseCode());
  }
  const body = res.getContentText();
  const data = JSON.parse(body);
  if (!data.tables || !data.tables.daily_entries || data.tables.daily_entries.length === 0) {
    throw new Error('The backup looked empty, so it was NOT saved.');
  }

  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
  const stamp = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd');
  folder.createFile('YFS-backup-' + stamp + '.json', body, MimeType.PLAIN_TEXT);

  // Keep only the newest KEEP backups (older ones go to the Drive trash, where
  // they can still be recovered for 30 days).
  const files = [];
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (/^YFS-backup-.*\.json$/.test(f.getName())) files.push(f);
  }
  files.sort(function (a, b) { return b.getName().localeCompare(a.getName()); });
  files.slice(KEEP).forEach(function (f) { f.setTrashed(true); });
}
