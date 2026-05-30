# Changelog
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
