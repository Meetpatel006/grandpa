# Mobile App CI/CD Setup

## Overview

This repository builds the Android app directly with Expo prebuild plus Gradle, then creates a GitHub Release when you push a version tag like `v1.0.0`.

## Trigger

The workflow runs on tag pushes matching:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Required GitHub Secrets

Add these repository secrets in Settings > Secrets and variables > Actions:

| Secret | Description |
| --- | --- |
| `EXPO_PUBLIC_CONVEX_URL` | Public Convex client URL used by the Expo app |
| `EXPO_PUBLIC_CONVEX_SITE_URL` | Convex site URL if your app expects it |
| `CONVEX_DEPLOYMENT` | Convex deployment name if your build depends on it |

## Build Flow

The workflow in [mobile-android.yml](/C:/Users/hites/Desktop/Coding/grandparents/.github/workflows/mobile-android.yml) does this:

1. Checks out the repo
2. Installs Java, Android SDK, and Bun
3. Runs `bun install --frozen-lockfile`
4. Runs `bunx expo prebuild --platform android --clean`
5. Builds the release APK with Gradle
6. Uploads the APK as an artifact
7. Creates a GitHub Release for the pushed tag and attaches the APK

## Important Notes

- This repo’s Expo app lives at the repository root, not `apps/mobile`.
- This workflow does not use EAS Build.
- Because the project uses native Android modules, `expo prebuild` is required before Gradle can compile the app.

## Troubleshooting

If the workflow fails:

1. Confirm the three Convex secrets are set.
2. Confirm the pushed tag starts with `v`.
3. Check whether `expo prebuild` generated Android successfully in CI.
4. Check Gradle logs for native Android compile or manifest issues.
