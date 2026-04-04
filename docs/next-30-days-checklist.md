# Next 30 Days Checklist

> Updated: 2026-04-03
> Scope: implementation, store setup, and console tasks that move YOAKE closer to `月5万`

## App work

- [ ] Verify the new review prompt appears after a weekly report, streak milestone, and clear score improvement.
- [ ] Verify the Home catch-up banner appears only when yesterday is missing.
- [ ] Test the new manual "Rate YOAKE" row on Android.
- [ ] Fill `STORE_LINKS.APP_STORE_ID` before the first iOS beta that asks for reviews.

## iOS work

- [ ] Restore the missing `ios/` native project.
- [ ] Add HealthKit entitlements and usage descriptions.
- [ ] Implement App Store purchase verification in Cloud Functions.
- [ ] Implement iOS restore purchase parity.
- [ ] Confirm APNs + FCM push delivery on a real device.

## Store work

- [ ] Upload three first-screenshot variants based on `docs/growth-experiments.md`.
- [ ] Create Google Play custom store listings for the three positioning angles.
- [ ] Create App Store custom product pages for the same three angles.
- [ ] Rewrite short description / subtitle to match the winning angle.
- [ ] Keep paywall screenshots consistent with the in-app copy users see after install.

## Console and analytics work

- [ ] Confirm Google Play subscription products match `yoake_monthly_480` and `yoake_yearly_2800`.
- [ ] Verify purchase validation logs on Cloud Functions after test purchases.
- [ ] Add crash monitoring before public launch.
- [ ] Track these weekly:
  - installs
  - store CVR
  - trial starts
  - install to paid
  - review rating
