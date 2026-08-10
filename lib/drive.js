/**
 * Google Drive auto-backup. Lazy-loads googleapis so the server still boots
 * even when no service account has been configured yet.
 */
const path = require('path');
const fs = require('fs');
const db = require('./db');

let driveClient = null;
let lastFolderId = null;

async function getClient() {
  if (driveClient) return driveClient;
  const sa = db.getSetting('drive.serviceAccount');
  if (!sa) throw new Error('No Drive service account configured. Visit /drive-setup.');
  const folderId = db.getSetting('drive.folderId') || process.env.GOOGLE_DRIVE_FOLDER_ID;
  lastFolderId = folderId;

  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({
    credentials: sa,
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

async function backupNow() {
  const d = await getClient();
  const filePath = path.join(__dirname, '..', 'data', 'db.json');
  if (!fs.existsSync(filePath)) throw new Error('db.json not found');
  const day = new Date().toISOString().slice(0, 10);
  const name = `stigma-db-${day}.json`;
  const parents = lastFolderId ? [lastFolderId] : [];

  // Try to find an existing file for today and update it, else create.
  const list = await d.files.list({
    q: `name='${name}'${parents.length ? ` and '${parents[0]}' in parents` : ''} and trashed=false`,
    fields: 'files(id,name)'
  });
  const media = { mimeType: 'application/json', body: fs.createReadStream(filePath) };

  if (list.data.files?.[0]) {
    const id = list.data.files[0].id;
    await d.files.update({ fileId: id, media });
    return { action: 'updated', id, name };
  }
  const created = await d.files.create({
    requestBody: { name, parents: parents.length ? parents : undefined },
    media
  });
  return { action: 'created', id: created.data.id, name };
}

module.exports = { backupNow };
