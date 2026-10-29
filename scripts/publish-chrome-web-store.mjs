// Uploads a packaged extension to the Chrome Web Store and submits it for review, using
// the Chrome Web Store API v2 (https://developer.chrome.com/docs/webstore/using-api).
// Run by the release workflow; see DEPLOYMENT.md.
//
//   node scripts/publish-chrome-web-store.mjs <zip> <expected-version>
//
// Environment:
//   CWS_ACCESS_TOKEN   OAuth access token with the https://www.googleapis.com/auth/chromewebstore scope
//   CWS_PUBLISHER_ID   from the developer dashboard
//   CWS_EXTENSION_ID   the item's ID (the last part of its store URL)
import { appendFileSync, readFileSync } from 'node:fs';

const API = 'https://chromewebstore.googleapis.com';
const POLL_INTERVAL_MS = 10_000;
const POLL_ATTEMPTS = 30;

const [zipPath, expectedVersion] = process.argv.slice(2);
const { CWS_ACCESS_TOKEN: token, CWS_PUBLISHER_ID: publisherId, CWS_EXTENSION_ID: extensionId } = process.env;

if (!zipPath || !expectedVersion) throw new Error('usage: publish-chrome-web-store.mjs <zip> <expected-version>');
for (const [name, value] of Object.entries({ CWS_ACCESS_TOKEN: token, CWS_PUBLISHER_ID: publisherId, CWS_EXTENSION_ID: extensionId })) {
  if (!value) throw new Error(`${name} is not set`);
}

const item = `publishers/${publisherId}/items/${extensionId}`;

async function call(method, url, body) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, body });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${url} failed with HTTP ${response.status}:\n${text}`);
  return text ? JSON.parse(text) : {};
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// The guide calls the in-progress state UPLOAD_IN_PROGRESS; the UploadState reference calls it IN_PROGRESS
const isInProgress = state => state === 'IN_PROGRESS' || state === 'UPLOAD_IN_PROGRESS';

console.log(`Uploading ${zipPath} to ${item}`);
const upload = await call('POST', `${API}/upload/v2/${item}:upload`, readFileSync(zipPath));
let uploadState = upload.uploadState;
for (let attempt = 1; isInProgress(uploadState); attempt++) {
  if (attempt > POLL_ATTEMPTS) throw new Error(`The upload was still processing after ${POLL_ATTEMPTS} checks`);
  console.log('Upload is processing; checking again shortly');
  await sleep(POLL_INTERVAL_MS);
  uploadState = (await call('GET', `${API}/v2/${item}:fetchStatus`)).lastAsyncUploadState;
}
if (uploadState !== 'SUCCEEDED') throw new Error(`The upload ended in state ${uploadState}:\n${JSON.stringify(upload, null, 2)}`);
if (upload.crxVersion && upload.crxVersion !== expectedVersion) {
  throw new Error(`The store read version ${upload.crxVersion} from the package, but this release is ${expectedVersion}`);
}
console.log(`Upload succeeded (version ${upload.crxVersion ?? expectedVersion})`);

const published = await call('POST', `${API}/v2/${item}:publish`);
for (const warning of published.warningInfo?.warnings ?? []) {
  console.log(`::warning::Chrome Web Store: ${warning.reason}: ${warning.description}`);
}
if (published.state === 'REJECTED' || published.state === 'CANCELLED') {
  throw new Error(`The submission ended in state ${published.state}`);
}

const summary = `Submitted version ${expectedVersion} to the Chrome Web Store: state ${published.state}`
  + (published.state === 'PENDING_REVIEW' ? ' (it goes live once review passes)' : '');
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
