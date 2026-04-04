# iOS Release Week Plan

> Updated: 2026-04-03
> Goal: get YOAKE from "no iOS native project" to "TestFlight-ready workstream"

## Assumptions

- The current repo still has no `ios/` directory.
- Shared React Native / Firebase logic is already partially prepared.
- This plan separates work into:
  - `Codex`: work I can implement in the repo
  - `Owner`: work that requires Apple / App Store Connect / Xcode account access

## Critical path

1. Restore or generate the iOS native project
2. Enable Apple capabilities and identifiers
3. Implement HealthKit and iOS purchase handling
4. Wire App Store server-side verification
5. Validate push notifications and restore flow on TestFlight

If step 1 does not happen, every later iOS task stays blocked.

## This week

### Day 1: Unblock the native project

`Owner`
- Restore or generate the missing `ios/` project
- Open the app in Xcode and confirm it builds locally
- Decide the final iOS bundle identifier
- Confirm the Apple Developer team and signing target to use

`Codex`
- Once `ios/` exists in the repo, align React Native config, plist keys, entitlements, and build settings
- Review required native dependencies for:
  - Firebase
  - Messaging
  - Notifee
  - `react-native-iap`
  - HealthKit integration path

`Definition of done`
- `ios/` is committed
- Xcode workspace opens
- A local debug build at least starts on simulator or device

### Day 2: Apple-side capabilities

`Owner`
- Create the App ID in Apple Developer
- Enable capabilities:
  - In-App Purchase
  - Push Notifications
  - HealthKit
  - Background Modes if needed for notifications
- Create APNs auth key or confirm an existing one
- Create the App Store Connect app record

`Codex`
- Add iOS entitlements and `Info.plist` usage strings
- Prepare environment placeholders for:
  - App Store App ID
  - bundle id
  - APNs / Firebase linkage assumptions

`Definition of done`
- Apple-side app record exists
- Required capabilities are visible in the target
- We know the final identifiers to wire into config

### Day 3: HealthKit path

`Owner`
- Confirm which HealthKit sleep data types YOAKE is allowed to read
- Test Health permissions prompt on a real device

`Codex`
- Implement an iOS sleep import service parallel to Android Health Connect
- Branch onboarding / settings behavior so iOS references HealthKit, not Health Connect
- Keep manual logging as fallback if HealthKit is unavailable

`Definition of done`
- iOS can request HealthKit permission
- Manual logging still works
- Health import path is callable in app code

### Day 4: Purchases and restore

`Owner`
- Create App Store subscription products in App Store Connect
- Configure trial, price, localization, screenshots, and review metadata
- Share product ids and confirm subscription group structure

`Codex`
- Wire iOS product fetching / purchase initiation in app flow
- Add App Store verification path in Cloud Functions
- Normalize iOS subscription state into the same Firestore shape as Android
- Hook restore purchases into server verification

`Definition of done`
- A TestFlight-capable build can fetch products
- Purchase result can be verified server-side
- Restore can refresh entitlement correctly

### Day 5: Notifications and App Store metadata

`Owner`
- Upload APNs key to Firebase
- Complete App Store Connect metadata:
  - app description
  - keywords
  - screenshots
  - privacy answers
  - age rating
  - subscription review information
- Prepare privacy policy / terms URLs if not already final

`Codex`
- Verify iOS FCM token registration flow
- Check notification routing and deep links
- Set `STORE_LINKS.APP_STORE_ID` after the app record is confirmed

`Definition of done`
- iOS push token is available
- App Store review links can open correctly
- Store submission metadata is no longer blocked

### Day 6-7: TestFlight hardening

`Owner`
- Run real-device TestFlight checks:
  - onboarding
  - manual log
  - HealthKit import
  - buy
  - restore
  - push notifications
  - entitlement expiry / cancellation behavior if testable

`Codex`
- Fix bugs found in TestFlight
- Tighten iOS-specific copy or edge-case handling
- Patch parity gaps with Android entitlement rules

`Definition of done`
- TestFlight build completes the full happy path
- Remaining issues are polish, not release blockers

## Codex backlog

These are the items I can take immediately once `ios/` is committed:

1. Add iOS capability-related plist / entitlement wiring
2. Build HealthKit service abstraction and platform branching
3. Add App Store verification endpoints in `functions/src/index.ts`
4. Normalize restore flow and premium expiry handling
5. Wire App Store review link using `STORE_LINKS.APP_STORE_ID`
6. Audit iOS-specific onboarding / settings copy

## Owner backlog

These are the items only you can complete:

1. Restore or generate the `ios/` native project
2. Apple Developer identifiers, signing, and capabilities
3. App Store Connect app creation
4. Subscription products and trial configuration
5. APNs key setup
6. TestFlight install and real-device verification
7. Final App Store metadata and submission

## First thing to do next

The single next action is:

- `Owner`: commit the missing `ios/` directory or restore it into this repo

As soon as that lands, I can take the next block of work without waiting on more planning.
