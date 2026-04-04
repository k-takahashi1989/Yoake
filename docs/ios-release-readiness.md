# iOS Release Readiness

> Updated: 2026-04-03
> Scope: blockers that remain after the shared React Native / Firebase purchase flow cleanup

## Current status

- A baseline `ios/` native project now exists in the repo.
- Shared JS-side purchase messaging is cleaned up.
- Onboarding no longer assumes Health Connect on iOS builds.
- Sleep data access is now wrapped behind `src/services/healthData.ts`, so HealthKit can be added without touching every screen again.
- The purchase validation endpoint now accepts iOS purchase fields (`platform`, `transactionId`, `environmentIOS`) and includes an App Store verification path.
- The iOS project is only scaffolded; CocoaPods / Xcode verification is still pending.
- App Store verification still needs real Apple secrets before it can run in production.
- Execution order and ownership split are tracked in `docs/ios-release-week-plan.md`.

## Remaining blockers

### 1. Generate and commit the iOS native project

- Run `npx react-native@latest init` equivalent for the existing app structure or restore the missing `ios/` directory.
- Commit:
  - `ios/Podfile`
  - Xcode project / workspace
  - entitlements file
  - `Info.plist`

### 2. Add HealthKit capability

- Enable HealthKit in the Xcode target.
- Add usage descriptions to `Info.plist`.
- Replace the current iOS stub behind `src/services/healthData.ts` with a real HealthKit reader.
- Update onboarding / settings copy once HealthKit is actually wired.

### 3. Add App Store subscription verification

- Set Firebase Function secrets:
  - `APP_STORE_ISSUER_ID`
  - `APP_STORE_KEY_ID`
  - `APP_STORE_PRIVATE_KEY`
- Confirm the App Store Server API path works against Sandbox / TestFlight.
- Write the same Firestore subscription shape used on Android:
  - `status`
  - `trialStartAt`
  - `trialEndAt`
  - `currentPeriodEndAt`
  - `trialUsed`
  - root `users/{uid}.isPremium`
- After App Store Connect creates the production app record, set `STORE_LINKS.APP_STORE_ID`
  in `src/constants/index.ts` so review prompts and the manual "Rate YOAKE" link can work.

### 4. Restore flow parity

- Hook iOS restore purchases to App Store verification, not just local refresh.
- Confirm upgrade / cancel / grace-period behavior matches Android-side entitlement rules.

### 5. Push notification parity

- Configure APNs for the iOS app id.
- Confirm FCM token registration on iOS.
- Verify weekly report notifications and bedtime reminders on real devices.

## Definition of done

- A TestFlight build can:
  - sign in
  - finish onboarding
  - import or manually log sleep
  - buy a subscription
  - restore a subscription
  - reflect entitlement expiry correctly
  - receive push notifications
