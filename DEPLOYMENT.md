# Deployment

How zero-state is versioned, released, and published to the [Chrome Web Store](https://chromewebstore.google.com/detail/zero-state/diloncejoolaamlldicgmhimamhecipj).

**In short:** bump the version with `npm version`, get that commit onto `master`, then push a `vX.Y.Z` tag pointing at it. The tag push runs `.github/workflows/release.yml`, which tests and packages the extension, submits it to the Chrome Web Store for review, and creates the GitHub release with the same zip attached. **Pushing a `v*` tag is what publishes. Nothing else does.**

## Versions

- The version lives in two files: `package.json` and `manifest.json`. The one in `manifest.json` is what Chrome uses: for updates, for the Web Store, for the "Version" line on the settings page, and for `appVersion` in console exports. The app reads it at runtime with `chrome.runtime.getManifest().version`, so nothing else needs updating.
- Don't edit either file's version by hand. `npm version <patch|minor|major>` updates `package.json` and `package-lock.json`, then the `version` script in `package.json` (`scripts/version.mjs sync`) copies the new version into `manifest.json`.
- Chrome only accepts **one to four dot-separated numbers** (0–65535, no leading zeros, not all zero), so pre-release versions such as `2.1.0-beta.0` aren't allowed. `scripts/version.mjs` rejects them. If `npm version` stops with that error, npm has already edited `package.json` and `package-lock.json`: undo with `git checkout -- package.json package-lock.json`.
- The Web Store refuses an upload unless its version is **higher than the last one uploaded**.
- Choosing the bump: **patch** for fixes only, **minor** for new features (which may include fixes), **major** for changes to stored data or other big breaks.
- Tags are `v` plus the version (`v2.1.0`), on the `master` commit that contains the bump. Earlier releases: `v0.0.4`, `v2.0.0`.

## Releasing

Both flows end the same way: a tag pushed on a commit that's already on `master`. Never tag a commit on a PR branch. Squash and rebase merges give the commit a new hash, so the tag would point outside `master`'s history, and it would publish before the PR was reviewed. The workflow refuses such tags anyway.

### Flow A: bump in the PR (the default when work goes through a PR)

1. On the PR branch, bump without committing or tagging, then commit:
   ```sh
   npm version minor --no-git-tag-version
   git commit -am "Bump version to 2.1.0"
   git push
   ```
2. Merge the PR (any merge method).
3. Tag `master` and push the tag:
   ```sh
   git checkout master && git pull
   git tag -a v2.1.0 -m v2.1.0
   git push origin v2.1.0
   ```

### Flow B: bump directly on `master`

For a release that doesn't need a PR, such as a bump on its own after several merged PRs:

```sh
git checkout master && git pull
npm version minor -m "Bump version to %s"   # commits and creates the tag
git push --follow-tags                       # pushes the commit and the tag together
```

### What the release workflow does

| Job | What it does |
|---|---|
| **Verify and package** | Checks that the tag matches both version files (`scripts/version.mjs check`) and that the tagged commit is on `master`. Runs typecheck, unit tests, and end-to-end tests, then builds minified, runs `npm run pkg`, and zips `pkg/` as `zero-state-X.Y.Z.zip`. |
| **Submit to the Chrome Web Store** | Gets a short-lived Google token through Workload Identity Federation, uploads the zip, and submits it for review (`scripts/publish-chrome-web-store.mjs`). **Skipped** until the one-time setup below is done. |
| **Create the GitHub release** | Creates the release with the zip attached and auto-generated notes. Runs when the store submission succeeded or was skipped, not when it failed. |

Follow a run in the Actions tab or with `gh run watch`. A submission still goes through Chrome Web Store review: the job finishes with the item in `PENDING_REVIEW`, and the new version goes live once review passes. Review progress is shown in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

### When something fails

- **Verify and package failed** (tests, or the tag check): nothing was published. Fix it on `master`, then delete the tag and tag again. Reusing the number is fine because nothing was uploaded:
  ```sh
  git push origin :refs/tags/v2.1.0 && git tag -d v2.1.0
  ```
- **Submit to the Chrome Web Store failed:** the GitHub release wasn't created. Read the job log; the script prints the API's error.
  - For problems before the upload (authentication, setup), fix the cause and use **Re-run failed jobs**.
  - If the store rejected the version (not higher than the last upload), bump again and release the new version.
  - If the upload succeeded but the submission failed, the package is already in the dashboard. Submit it there rather than re-running, since the store may refuse a second upload of the same version. Then re-run the remaining job.
- **Create the GitHub release failed:** the store submission already happened. Use **Re-run failed jobs**, which reruns only this job.
- Once the store has a version, don't delete or move its tag.

## Chrome Web Store setup (one-time)

The workflow publishes through the [Chrome Web Store API v2](https://developer.chrome.com/docs/webstore/using-api), authenticated as a Google Cloud service account. GitHub Actions gets that account's token through Workload Identity Federation, so no long-lived key is stored anywhere. The older v1.1 API, with an OAuth client ID, secret, and refresh token, [stopped being supported on 15 Oct 2026](https://developer.chrome.com/blog/cws-api-v2), so guides and actions built on it no longer work.

Prerequisite: 2-step verification on the Google account that owns the developer account (the API refuses to publish without it).

1. **Google Cloud project and APIs.** Create or pick a project, then:
   ```sh
   PROJECT_ID=your-project-id
   PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
   gcloud services enable chromewebstore.googleapis.com iam.googleapis.com \
     iamcredentials.googleapis.com sts.googleapis.com --project="$PROJECT_ID"
   ```
2. **Service account** (it needs no IAM roles). A publisher can link only one, so it publishes all of that publisher's extensions; name it for the publisher, not for one extension:
   ```sh
   gcloud iam service-accounts create web-store-publisher --project="$PROJECT_ID"
   ```
3. **Link it to the Web Store.** In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), open **Account** and add `web-store-publisher@$PROJECT_ID.iam.gserviceaccount.com`. A publisher can link only one service account. While you're there, copy your **publisher ID** from **Publisher > Settings**. It's also the UUID in the dashboard's URL. It isn't the extension ID.
4. **Workload Identity pool and provider.** The condition limits tokens to tag pushes in this repository:
   ```sh
   gcloud iam workload-identity-pools create github \
     --project="$PROJECT_ID" --location=global --display-name="GitHub Actions"
   gcloud iam workload-identity-pools providers create-oidc zero-state \
     --project="$PROJECT_ID" --location=global --workload-identity-pool=github \
     --display-name="nmai/zero-state releases" \
     --issuer-uri="https://token.actions.githubusercontent.com" \
     --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
     --attribute-condition="assertion.repository == 'nmai/zero-state' && assertion.ref.startsWith('refs/tags/v')"
   ```
5. **Let the repository use the service account:**
   ```sh
   gcloud iam service-accounts add-iam-policy-binding \
     "web-store-publisher@$PROJECT_ID.iam.gserviceaccount.com" --project="$PROJECT_ID" \
     --role=roles/iam.workloadIdentityUser \
     --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/nmai/zero-state"
   ```
6. **Repository variables.** None of these values are secret: access is controlled by step 4's condition. Set `CWS_PUBLISHER_ID` last, because it switches the store job on.
   ```sh
   gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --body "$(gcloud iam workload-identity-pools providers describe zero-state \
     --project="$PROJECT_ID" --location=global --workload-identity-pool=github --format='value(name)')"
   gh variable set GCP_SERVICE_ACCOUNT --body "web-store-publisher@$PROJECT_ID.iam.gserviceaccount.com"
   gh variable set CWS_PUBLISHER_ID --body "<publisher ID from step 3>"
   ```

This has been done: the project is `chrome-extensions` in Google Cloud, and `gh variable list` shows the provider and service account the workflow uses. Another extension's repository would reuse the same project, service account, and `github` pool, with its own provider (step 4) and binding (step 5).

IAM changes can take a few minutes to apply. There's no dry run: the next release is the first real test. If it fails during authentication, nothing has been uploaded, so fix the setup and re-run the failed job.

If you'd rather not use Workload Identity Federation, the simpler alternative is a JSON key for the service account stored as a GitHub secret. In the workflow's auth step, pass `credentials_json: ${{ secrets.GCP_SA_KEY }}` instead of the two `vars.GCP_*` inputs. Google [advises against long-lived keys](https://developer.chrome.com/docs/webstore/service-accounts), and the key would need rotating.

## Manual release (fallback)

This is for when the workflow is broken or GitHub Actions is down. If only the store setup is missing, you don't need it: the normal flow still creates the GitHub release, and you upload its zip by hand.

1. Disable the workflow, so the tag push below can't trigger a second publish later:
   ```sh
   gh workflow disable release.yml
   ```
2. From an up-to-date `master` that contains the bump, test, build, and zip:
   ```sh
   npm ci && npm run typecheck && npm test && npm run test:e2e
   npm run build-min && npm run pkg
   (cd pkg && zip -r ../zero-state-2.1.0.zip .)
   # Windows: Compress-Archive -Path pkg\* -DestinationPath zero-state-2.1.0.zip
   ```
3. Upload the zip in the Developer Dashboard (**Package** > **Upload new package**), then submit it for review.
4. Tag `master` and create the GitHub release with the same zip:
   ```sh
   git tag -a v2.1.0 -m v2.1.0 && git push origin v2.1.0
   gh release create v2.1.0 zero-state-2.1.0.zip --title v2.1.0 --generate-notes --verify-tag
   ```
5. Re-enable the workflow with `gh workflow enable release.yml`.

## Test builds (not releases)

- For a build to load by hand, run `npm run build && npm run pkg`, then load `pkg/` unpacked from `chrome://extensions`. You can also load the repo root after a build.
- The settings page shows the last release's version, because the version only changes at release time.
- An unpacked copy has its own extension ID, and so its own storage. It starts with the welcome data and can't touch the store version's data.
- Some Android Chromium browsers fail to load an unpacked folder opened through Android's file picker, with "Default locale is defined but default data couldn't be loaded." Remove `default_locale` from the copy's `manifest.json` and delete its `_locales/` folder. The extension doesn't use localization.

## Screenshot tests in CI

The workflow runs the end-to-end suite with `--ignore-snapshots`. Screenshot baselines depend on the fonts of the machine that made them: the Linux ones come from Ubuntu 24.04 (arm64) with Roboto as the default sans-serif, and GitHub's runners render differently. The visual specs still run, so a page that fails to render is still caught, but pixels aren't compared. Run `npm run test:e2e` locally before tagging to check visuals.

## Future: release on merge

A third flow worth considering if releases become frequent, or if forgetting to push the tag becomes a problem: make **merging the version bump the release**, with no manual tag.

- **How it would work:** a workflow on pushes to `master` compares `manifest.json`'s version with the latest `v*` tag. When the manifest's is higher, it creates the tag and runs the same package, store, and release jobs. The simplest way is to turn `release.yml` into a reusable workflow (`workflow_call`) that takes the tag as an input.
- **Catch:** a tag pushed with the default `GITHUB_TOKEN` doesn't trigger other workflows. Either do the release in the same run, as above, or push the tag with a GitHub App or personal access token.
- **Trade-offs:**
  - Every merged bump publishes immediately. There's no pause to check `master` before tagging, and no easy way to merge a bump but hold the release.
  - It also means more workflow logic to maintain.
  - The tag-push flow above keeps the person pushing the tag as the final, deliberate step.
