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
import TransportWebHID from '@ledgerhq/hw-transport-webhid';

/**
 * connect connects to the plugged in Ledger using the WebHID transport
 * and returns the first Sia address of the ledger wallet.
 */
async function connect() {
	let sia;
	try {
		const transport = await TransportWebHID.create();
		sia = new Sia(transport);
		
		const address = await sia.getAddress(0);
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
		const transport = await TransportWebHID.create(),
			sia = new Sia(transport),
			address = await sia.getAddress(0);

		console.log(address);
	} catch (ex) {
		// TODO: handle error
	}
}

connect();
</script>
```
