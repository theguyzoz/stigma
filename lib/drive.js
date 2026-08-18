/**
 * Google Drive auto-backup.
 *
 * Service accounts have NO storage quota of their own. Files must be uploaded
 * into a folder that belongs to a Shared Drive (Team Drive) or a regular
 * folder that a real user owns and has shared with the service account.
 *
 * Setup:
 *   1. Create a folder in your Google Drive (or a Shared Drive).
 *   2. Share it with the service account email (Editor permission).
 *      For Shared Drives: add the service account as a member.
 *   3. Copy the folder ID from the URL and set GOOGLE_DRIVE_FOLDER_ID.
 *
 * The backup call uses supportsAllDrives:true so it works for both
 * regular shared folders and Shared Drives without any extra config.
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const db   = require('./db');

let driveClient  = null;
let cachedFolder = null; // { id, isSharedDrive }

function loadServiceAccount() {
  const fromDb = db.getSetting('drive.serviceAccount');
  if (fromDb) return fromDb;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try { return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON); }
    catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.'); }
  }
  return null;
}

function getFolderId() {
  return process.env.GOOGLE_DRIVE_FOLDER_ID || db.getSetting('drive.folderId') || null;
}

async function getClient() {
  if (driveClient) return driveClient;
  const sa = loadServiceAccount();
  if (!sa) throw new Error('No Drive service account configured. Visit /drive-setup.');
  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({
    credentials: sa,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

/**
 * Detect whether a folder ID belongs to a Shared Drive.
 * Returns { id, isSharedDrive }.
 */
async function resolveFolder(d, folderId) {
  if (cachedFolder && cachedFolder.id === folderId) return cachedFolder;
  try {
    const meta = await d.files.get({
      fileId: folderId,
      fields: 'id,driveId,teamDriveId',
      supportsAllDrives: true
    });
    const isSharedDrive = !!(meta.data.driveId || meta.data.teamDriveId);
    cachedFolder = { id: folderId, isSharedDrive, driveId: meta.data.driveId || meta.data.teamDriveId || null };
    return cachedFolder;
  } catch (e) {
    // Can't read folder metadata — treat as regular shared folder
    cachedFolder = { id: folderId, isSharedDrive: false, driveId: null };
    return cachedFolder;
  }
}

async function backupNow() {
  const folderId = getFolderId();
  if (!folderId) {
    throw new Error(
      'GOOGLE_DRIVE_FOLDER_ID is not set.\n\n' +
      'Create a folder in Google Drive, share it with your service account email (Editor), ' +
      'then set GOOGLE_DRIVE_FOLDER_ID to the folder ID from the URL.\n\n' +
      'If using a Shared Drive, add the service account as a Shared Drive member.'
    );
  }

  const d      = await getClient();
  const folder = await resolveFolder(d, folderId);
  const day    = new Date().toISOString().slice(0, 10);
  const name   = `stigma-db-${day}.json`;

  const filePath = path.join(__dirname, '..', 'data', 'db.json');
  if (!fs.existsSync(filePath)) throw new Error('db.json not found — nothing to back up yet.');

  // Common params that make the API work for both Shared Drives and regular folders
  const driveParams = {
    supportsAllDrives: true,
    ...(folder.isSharedDrive && folder.driveId ? {
      driveId: folder.driveId,
      includeItemsFromAllDrives: true,
      corpora: 'drive'
    } : {})
  };

  // Find existing file for today in the folder
  let q = `name='${name}' and '${folderId}' in parents and trashed=false`;
  const list = await d.files.list({
    q,
    fields: 'files(id,name)',
    ...driveParams
  });

  const media = {
    mimeType: 'application/json',
    body: fs.createReadStream(filePath)
  };

  if (list.data.files?.[0]) {
    // Update existing
    const fileId = list.data.files[0].id;
    await d.files.update({ fileId, media, supportsAllDrives: true });
    return { action: 'updated', id: fileId, name };
  }

  // Create new
  const created = await d.files.create({
    requestBody: {
      name,
      parents: [folderId],
      ...(folder.isSharedDrive && folder.driveId ? { driveId: folder.driveId } : {})
    },
    media,
    supportsAllDrives: true
  });
  return { action: 'created', id: created.data.id, name };
}

function resetClient() {
  driveClient  = null;
  cachedFolder = null;
}

module.exports = { backupNow, resetClient };
