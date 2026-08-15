/**
 * Google Drive auto-backup. Lazy-loads googleapis so the server still boots
 * even when no service account has been configured yet.
 */
const path = require('path');
const fs = require('fs');
const db = require('./db');

let driveClient = null;
let lastFolderId = null;

// Resolve the service account from the DB first, then from the env var.
function loadServiceAccount() {
  const fromDb = db.getSetting('drive.serviceAccount');
  if (fromDb) return fromDb;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
  }
  return null;
}

async function getClient() {
  if (driveClient) return driveClient;
  const sa = loadServiceAccount();
  if (!sa) throw new Error('No Drive service account configured. Set GOOGLE_SERVICE_ACCOUNT_JSON or visit /drive-setup.');
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || db.getSetting('drive.folderId');
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
