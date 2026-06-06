/* Google Sheets reader (read-only) via ADC.
 * The runtime service account needs no IAM role for Sheets — instead, SHARE the
 * spreadsheet (Viewer) with the SA's email address. Locally, `gcloud auth
 * application-default login` provides the credentials.
 */
import { google } from 'googleapis';

// Read a range and return an array of row objects keyed by the header row.
export async function readSheetObjects(spreadsheetId, range) {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h).trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i] !== undefined ? r[i] : ''; });
    return obj;
  });
}
