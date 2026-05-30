# Sia Ledger

Ledger hardware wallet Sia bindings

## Package Install
```
npm i @siacentral/ledgerjs-sia
```

## Static Install
Static javascript builds are available on the releases page.

## Package Usage
```js
import Sia from '@siacentral/ledgerjs-sia';

/**
 * connect connects to the plugged in Ledger and returns the first Sia address
 * of the ledger wallet. connectWebHID / connectBLE launch the Sia app from the
 * dashboard if it isn't already open and return a ready instance.
 */
async function connect() {
	let sia;
	try {
		// supportedTransports reports which transports work in this environment;
		// offer the user a choice between USB (hid) and Bluetooth (ble).
		const transports = await Sia.supportedTransports(); // e.g. ['hid', 'ble']

		sia = transports.includes('hid')
			? await Sia.connectWebHID()
			: await Sia.connectBLE();

		const { address } = await sia.getAddress(0);
		console.log(address);
	} catch (ex) {
		// TODO: handle error
	} finally {
		// always close the transport when done.
		if (sia) sia.close();
	}
}

connect();
```

A transport may also be supplied directly via `new Sia(transport)` (e.g. a
Speculos transport for testing), or `Sia.open(createTransport)` to launch the
app using a custom transport factory.

## Static Usage
```html
<script type="text/javascript" src="/js/sia.js"></script>
<script type="text/javscript">
/**
 * connect connects to the plugged in Ledger using the WebHID transport
 * and returns the first Sia address of the ledger wallet.
 */
async function connect() {
	try {
		const sia = await Sia.connectWebHID(),
			{ address } = await sia.getAddress(0);

		console.log(address);
	} catch (ex) {
		// TODO: handle error
	}
}

connect();
</script>
```
