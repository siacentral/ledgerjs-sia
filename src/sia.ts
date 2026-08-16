import type Transport from "@ledgerhq/hw-transport";
import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import TransportWebBLE from '@ledgerhq/hw-transport-web-ble';
import { Buffer } from 'buffer';

const CLA = 0xe0;
// CLA_OS instructions are handled by the operating system from both the
// dashboard and inside apps
const CLA_OS = 0xb0;

const APP_NAME = 'Sia';
const DASHBOARD_NAME = 'BOLOS';

const INS_OPEN_APP = 0xd8;
const INS_GET_VERSION = 0x01;
const INS_GET_PUBLIC_KEY = 0x02;
const INS_SIGN_HASH = 0x04;
const INS_CALC_V2TXN_HASH = 0x10;

const INS_GET_APP_AND_VERSION = 0x01;
const INS_QUIT_APP = 0xa7;

const P1_FIRST = 0x00;
const P1_MORE = 0x80;

const P2_DISPLAY_ADDRESS = 0x00;
const P2_DISPLAY_PUBKEY = 0x01;
const P2_SIGN_HASH = 0x01;

function uint32ToBuffer(val: number): Buffer {
	const buf = Buffer.alloc(4);
	buf.writeUInt32LE(val, 0);
	return buf;
}

function bytesToHex(bytes: Uint8Array): string {
	return bytes.reduce((v, b) => v + ('0' + b.toString(16)).slice(-2), '');
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

type TransportFactory = () => Promise<Transport>;

interface VerifyResponse {
	address: string;
	publicKey: string;
}

interface AppAndVersion {
	name: string;
	version: string;
}

/**
 * Sia
 *
 * @example
 * import Sia from '@siacentral/ledgerjs-sia';
 * const sia = new Sia(transport)
 */
export default class Sia {
	transport: Transport;

	constructor(transport: Transport, scrambleKey = 'Sia') {
		this.transport = transport;
		transport.decorateAppAPIMethods(this, [
			'signV2Transaction',
			'getPublicKey',
			'getAddress',
			'signHash',
		], scrambleKey);
	}

	/**
	 * open connects a transport, ensures the Sia app is running, and returns a
	 * ready Sia instance. If another app is in the foreground it is quit to the
	 * dashboard, and the Sia app is launched from the dashboard; the device
	 * disconnects and reconnects when an app opens or quits, so the transport
	 * is recreated via the provided factory until the app is ready.
	 * @param createTransport {TransportFactory} creates a transport, e.g. () => TransportWebHID.create()
	 * @param scrambleKey {string} the scramble key for the Sia app
	 * @returns {Sia} a Sia instance bound to a transport with the Sia app open
	 */
	static async open(createTransport: TransportFactory, scrambleKey = 'Sia') : Promise<Sia> {
		let sia = new Sia(await createTransport(), scrambleKey);

		// the dashboard also answers the app-level version APDU, so
		// getVersion() succeeding does not mean the Sia app is in the
		// foreground; check with getAppAndVersion instead. The worst case
		// takes three passes: quit another app to the dashboard, launch the
		// Sia app, then confirm it is in the foreground.
		for (let i = 0; i < 3; i++) {
			const app = await sia.getAppAndVersion().then(({ name }) => name).catch(() => null);

			if (app === APP_NAME)
				return sia;

			try {
				if (app === null || app === DASHBOARD_NAME)
					await sia.openApp(); // the user confirms the launch on-device
				else
					await sia.quitApp();
			} catch (ex) {
				// a status response means the device is still connected and
				// refused, e.g. the user declined the launch; anything else is
				// the expected disconnect as the app opens or quits
				if (typeof (ex as { statusCode?: unknown } | null)?.statusCode === 'number') {
					await sia.close().catch(() => undefined);
					throw new Error('opening the Sia app was declined on the device', { cause: ex });
				}
			}

			await sia.close().catch(() => undefined);
			sia = await Sia.reconnect(createTransport, scrambleKey);
		}

		await sia.close().catch(() => undefined);
		throw new Error('Sia app did not become ready');
	}

	/**
	 * reconnect recreates the transport after the device disconnects to open
	 * or quit an app.
	 */
	private static async reconnect(createTransport: TransportFactory, scrambleKey: string) : Promise<Sia> {
		for (let i = 0; i < 10; i++) {
			await delay(500);

			try {
				return new Sia(await createTransport(), scrambleKey);
			} catch {
				// the device has not reconnected yet
			}
		}

		throw new Error('Ledger did not reconnect');
	}

	/**
	 * connectWebHID connects to a Ledger over WebHID (USB), launching the Sia
	 * app from the dashboard if it isn't already open, and returns a ready Sia
	 * instance.
	 * @param scrambleKey {string} the scramble key for the Sia app
	 * @returns {Sia} a Sia instance with the Sia app open
	 */
	static async connectWebHID(scrambleKey = 'Sia') : Promise<Sia> {
		return Sia.open(() => TransportWebHID.create(), scrambleKey);
	}

	/**
	 * connectBLE connects to a Ledger over Web Bluetooth, launching the Sia app
	 * from the dashboard if it isn't already open, and returns a ready Sia
	 * instance.
	 * @param scrambleKey {string} the scramble key for the Sia app
	 * @returns {Sia} a Sia instance with the Sia app open
	 */
	static async connectBLE(scrambleKey = 'Sia') : Promise<Sia> {
		return Sia.open(() => TransportWebBLE.create(), scrambleKey);
	}

	/**
	 * supportedTransports returns the transport methods available in the current
	 * environment. Web Bluetooth is excluded on Brave, which does not reliably
	 * support it.
	 * @returns {Array<'hid' | 'ble'>} the supported transport methods
	 */
	static async supportedTransports() : Promise<Array<'hid' | 'ble'>> {
		const nav = navigator as unknown as { brave?: { isBrave: () => Promise<boolean> } };

		const support = await Promise.all([
			TransportWebHID.isSupported().then(supported => supported ? 'hid' as const : null),
			TransportWebBLE.isSupported().then(async supported => supported && !(nav.brave && await nav.brave.isBrave()) ? 'ble' as const : null)
		]);

		return support.filter((t): t is 'hid' | 'ble' => t !== null);
	}

	/**
	 * exchangeTxnHash sends an encoded transaction to the device in 255-byte
	 * chunks and returns the response with the trailing status word stripped.
	 */
	private async exchangeTxnHash(ins: number, encodedTxn: Buffer, p2: number, sigIndex: number, keyIndex: number, changeIndex: number) : Promise<Buffer> {
		if (encodedTxn.length === 0)
			throw new Error('empty transaction');

		const buf = Buffer.alloc(encodedTxn.length + 10);
		buf.writeUInt32LE(keyIndex, 0);
		buf.writeUInt16LE(sigIndex, 4);
		buf.writeUInt32LE(changeIndex, 6);
		buf.set(encodedTxn, 10);

		let resp: Buffer = Buffer.alloc(0);
		for (let i = 0; i < buf.length; i += 255) {
			resp = await this.transport.send(CLA,
				ins,
				i === 0 ? P1_FIRST : P1_MORE,
				p2,
				Buffer.from(buf.subarray(i, i + 255)));
		}

		// the status code is appended as the last 2 bytes of the response, but
		// the transport already handles invalid codes.
		return Buffer.from(resp.subarray(0, resp.length - 2));
	}

	/**
	 * openApp launches the Sia app from the device's dashboard. The device
	 * disconnects and reconnects when the app opens, so the transport must be
	 * re-created before issuing further commands.
	 */
	async openApp() : Promise<void> {
		await this.transport.send(CLA, INS_OPEN_APP, 0x00, 0x00, Buffer.from(APP_NAME, 'ascii'));
	}

	/**
	 * quitApp exits the app in the foreground and returns to the dashboard.
	 * The device disconnects and reconnects when the app quits, so the
	 * transport must be re-created before issuing further commands.
	 */
	async quitApp() : Promise<void> {
		await this.transport.send(CLA_OS, INS_QUIT_APP, 0x00, 0x00, Buffer.alloc(0));
	}

	/**
	 * getAppAndVersion returns the name and version of the app in the
	 * foreground, or the dashboard name ("BOLOS") and operating system version
	 * if no app is open. It is answered by the operating system rather than
	 * the app, unlike getVersion, which the dashboard also answers.
	 * @returns {AppAndVersion} the foreground app name and version
	 */
	async getAppAndVersion() : Promise<AppAndVersion> {
		const resp = await this.transport.send(CLA_OS, INS_GET_APP_AND_VERSION, 0x00, 0x00, Buffer.alloc(0));

		// format byte, then length-prefixed name and version
		const nameLength = resp[1];
		const versionLength = resp[2 + nameLength];

		return {
			name: resp.subarray(2, 2 + nameLength).toString('ascii'),
			version: resp.subarray(3 + nameLength, 3 + nameLength + versionLength).toString('ascii')
		};
	}

	/**
	 * getVersion returns the version of the Sia app
	 *
	 * @returns {string} the current version of the Sia app.
	 */
	async getVersion() : Promise<string> {
		const resp = await this.transport.send(CLA, INS_GET_VERSION, 0x00, 0x00, Buffer.alloc(0));

		return `v${resp[0]}.${resp[1]}.${resp[2]}`;
	}

	/**
	 * getPublicKey returns the public key and standard Sia address for
	 * the provided public key index. The user will be asked to verify the
	 * public key on the display. A standard address is defined as an address
	 * having 1 public key, requiring 1 signature, and no timelock.
	 * @param index {number} the index of the public key
	 * @returns {VerifyResponse} the public key and standard address
	 */
	async getPublicKey(index: number) : Promise<VerifyResponse> {
		const resp = await this.transport.send(CLA, INS_GET_PUBLIC_KEY, 0x00, P2_DISPLAY_PUBKEY, uint32ToBuffer(index));

		// the status code is appended as the last 2 bytes of the response, but
		// the transport already handles invalid codes.
		return {
			publicKey: `ed25519:${bytesToHex(resp.subarray(0, 32))}`,
			address: resp.subarray(32, resp.length - 2).toString()
		};
	}

	/**
	 * getAddress returns the public key and standard Sia address for
	 * the provided public key index. The user will be asked to verify the
	 * address on the display. A standard address is defined as an address
	 * having 1 public key, requiring 1 signature, and no timelock.
	 * @param index {number} the index of the public key
	 * @returns {VerifyResponse} the public key and standard address
	 */
	async getAddress(index: number) : Promise<VerifyResponse> {
		const resp = await this.transport.send(CLA, INS_GET_PUBLIC_KEY, 0x00, P2_DISPLAY_ADDRESS, uint32ToBuffer(index));

		// the status code is appended as the last 2 bytes of the response, but
		// the transport already handles invalid codes.
		return {
			publicKey: `ed25519:${bytesToHex(resp.subarray(0, 32))}`,
			address: resp.subarray(32, resp.length - 2).toString()
		};
	}

	/**
	 * signV2Transaction signs the v2 transaction with the provided key
	 * @param encodedTxn {Buffer} a sia encoded (V2TransactionSemantics) v2 transaction
	 * @param sigIndex {number} the index of the signature to sign
	 * @param keyIndex {number} the index of the key to sign with
	 * @param changeIndex {number} the index of the key used for the change output
	 * @returns {string} the hex encoded signature
	 */
	async signV2Transaction(encodedTxn: Buffer, sigIndex: number, keyIndex: number, changeIndex: number) : Promise<string> {
		const resp = await this.exchangeTxnHash(INS_CALC_V2TXN_HASH, encodedTxn, P2_SIGN_HASH, sigIndex, keyIndex, changeIndex);

		return bytesToHex(resp);
	}

	/**
	 * signHash signs a 32-byte hash with the private key at the provided index
	 * @param sigHash {Buffer} the 32-byte hash to sign
	 * @param keyIndex {number} the index of the key to sign with
	 * @returns {string} the hex encoded signature
	 */
	async signHash(sigHash: Buffer, keyIndex: number) : Promise<string> {
		const buf = Buffer.alloc(sigHash.length + 4);

		buf.writeUInt32LE(keyIndex, 0);
		buf.set(sigHash, 4);

		const resp = await this.transport.send(CLA, INS_SIGN_HASH, 0x00, 0x00, buf);

		return bytesToHex(resp.subarray(0, resp.length - 2));
	}

	close() : Promise<void> {
		return this.transport.close();
	}
}
