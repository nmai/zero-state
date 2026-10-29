// Keeps manifest.json's version (the one Chrome and the Web Store use) in step with
// package.json's, and checks that both agree with a release tag. See DEPLOYMENT.md.
//
//   node scripts/version.mjs sync         copy package.json's version into manifest.json
//                                         (runs automatically during `npm version`)
//   node scripts/version.mjs check [tag]  fail unless both files hold the same valid version
//                                         and the tag, when given, is v<version>
import { readFileSync, writeFileSync } from 'node:fs';

const [command, tag] = process.argv.slice(2);

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

// https://developer.chrome.com/docs/extensions/reference/manifest/version
function assertChromeVersion(version) {
  const parts = version.split('.');
  const valid = parts.length <= 4
    && parts.every(part => /^(0|[1-9][0-9]{0,4})$/.test(part) && Number(part) <= 65535)
    && parts.some(part => part !== '0');
  if (!valid) {
    fail(`"${version}" isn't a valid Chrome extension version. Use one to four dot-separated `
      + 'numbers (0-65535, no leading zeros, not all zero), such as 2.1.0. Pre-release suffixes '
      + 'like -beta.0 aren\'t allowed.');
  }
}

const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
const manifestText = readFileSync('manifest.json', 'utf8');
const manifestVersion = JSON.parse(manifestText).version;

if (command === 'sync') {
  assertChromeVersion(packageVersion);
  // Replace the value in place so the rest of the file keeps its formatting
  const updated = manifestText.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${packageVersion}"`);
  if (JSON.parse(updated).version !== packageVersion) fail('could not update the version in manifest.json');
  writeFileSync('manifest.json', updated);
  console.log(`manifest.json version: ${manifestVersion} -> ${packageVersion}`);
} else if (command === 'check') {
  if (packageVersion !== manifestVersion) {
    fail(`package.json (${packageVersion}) and manifest.json (${manifestVersion}) disagree. `
      + 'Bump versions with `npm version`, which keeps them in step.');
  }
  assertChromeVersion(manifestVersion);
  if (tag !== undefined && tag !== `v${manifestVersion}`) {
    fail(`tag ${tag} doesn't match the version in manifest.json (${manifestVersion}); expected v${manifestVersion}`);
  }
  console.log(`version ${manifestVersion} OK${tag ? ` (tag ${tag})` : ''}`);
} else {
  fail('usage: node scripts/version.mjs sync | check [tag]');
}
