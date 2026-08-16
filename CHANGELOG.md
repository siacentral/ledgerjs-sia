# Changelog
## 2.0.2 (2026-08-16)

### Fixes

#### Fixed `Sia.open` returning while the dashboard or another app is in the foreground.

The dashboard also answers the app-level version APDU, so `getVersion()` succeeding does not mean the Sia app is open. `Sia.open` now checks the foreground app with the new `getAppAndVersion`, quits any other running app to the dashboard with the new `quitApp`, and launches the Sia app before returning. Declining the launch on-device now fails immediately instead of polling until timeout.

## 2.0.1 (2026-05-30)

### Fixes

- Fix OIDC publish

## 2.0.0 (2026-05-30)

### Breaking Changes

- Renamed `blindSign` to `signHash`.
- Renamed `verifyPublicKey` to `getPublicKey` and `verifyStandardAddress` to `getAddress`.

#### Removed v1 transaction signing.

`signTransaction` and the deprecated `signTransactionV044` have been removed. Use `signV2Transaction` instead.

### Features

- Added `Sia.open` and `openApp` to launch the Sia app from the device dashboard.
- Added `Sia.connectWebHID`, `Sia.connectBLE`, and `Sia.supportedTransports` for connecting to a Ledger and choosing a transport.

### Fixes

- Fixed `signV2Transaction` including the trailing APDU status word in the returned signature.
- Updated `@ledgerhq/hw-transport` packages and other dependencies.
