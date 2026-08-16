---
default: patch
---

# Fixed `Sia.open` returning while the dashboard or another app is in the foreground.

The dashboard also answers the app-level version APDU, so `getVersion()` succeeding does not mean the Sia app is open. `Sia.open` now checks the foreground app with the new `getAppAndVersion`, quits any other running app to the dashboard with the new `quitApp`, and launches the Sia app before returning. Declining the launch on-device now fails immediately instead of polling until timeout.
