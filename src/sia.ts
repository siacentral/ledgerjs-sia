import type Transport from "@ledgerhq/hw-transport";
import { Buffer } from 'buffer';
import { encode } from '@stablelib/base64';

function uint32ToBuffer(val: number): Buffer {
	const buf = Buffer.alloc(4);
	buf.writeUInt32LE(val, 0);
	return buf;
}

interface VerifyResponse {
	address: string;
	publicKey: string;
}

/**
 * Sia
 *
 * @example
 * import Sia from '@siacentral/ledgerjs-sia';
 * const sia = new Sia(transport)
 */
export default class Sia {
	v2: bool;
	transport: Transport;

	constructor(transport: Transport, scrambleKey = 'Sia', v2 = false) {
		this.v2 = v2;
		this.transport = transport;
		transport.decorateAppAPIMethods(this, [
			'signTransactionV044',
			'signTransaction',
			'signV2Transaction',
			'verifyPublicKey',
			'verifyStandardAddress'
		], scrambleKey);
	}

	/**
	 * getVersion returns the version of the Sia app
	 *
	 * @returns {string} the current version of the Sia app.
	 */
	async getVersion() : Promise<string> {
		const resp = await this.transport.send(0xe0, 0x01, 0x00, 0x00, Buffer.alloc(0));

		return `v${resp[0]}.${resp[1]}.${resp[2]}`;
	}

	/**
	 * verifyPublicKey returns the public key and standard Sia address for 
	 * the provided public key index. The user will be asked to verify the 
	 * public key on the display. A standard address is defined as an address 
	 * having 1 public key, requiring 1 signature, and no timelock.
	 * @param index {number} the index of the public key
	 * @returns {VerifyResponse} the public key and standard address
	 */
	async verifyPublicKey(index: number) : Promise<VerifyResponse> {
		const resp = await this.transport.send(0xe0, 0x02, 0x00, 0x01, uint32ToBuffer(index));

		// the status code is appended as the last 2 bytes of the response, but
		// the transport already handles invalid codes.
		return {
			publicKey: `ed25519:${resp.slice(0, 32).reduce((v, b) => v + ('0' + b.toString(16)).slice(-2), '')}`,
			address: resp.slice(32, resp.length-2).toString()
		};
	}

	/**
	 * verifyStandardAddress returns the public key and standard Sia address for 
	 * the provided public key index. The user will be asked to verify the 
	 * address on the display. A standard address is defined as an address 
	 * having 1 public key, requiring 1 signature, and no timelock.
	 * @param index {number} the index of the public key
	 * @returns {VerifyResponse} the public key and standard address
	 */
	async verifyStandardAddress(index: number) : Promise<VerifyResponse> {
		const resp = await this.transport.send(0xe0, 0x02, 0x00, 0x00, uint32ToBuffer(index));

		// the status code is appended as the last 2 bytes of the response, but
		// the transport already handles invalid codes.
		return {
			publicKey: `ed25519:${resp.slice(0, 32).reduce((v, b) => v + ('0' + b.toString(16)).slice(-2), '')}`,
			address: resp.slice(32, resp.length-2).toString()
		};
	}

	/**
	 * signTransactionV044 signs the transaction with the provided key
	 * @deprecated deprecated in v0.4.5
	 * @param encodedTxn {Buffer} a sia encoded transaction
	 * @param sigIndex {number} the index of the signature to sign
	 * @param keyIndex {number} the index of the key to sign with
	 * @returns {string} the base64 encoded signature
	 */
	async signTransactionV044(encodedTxn: Buffer, sigIndex: number, keyIndex: number) : Promise<string> {
		const buf = Buffer.alloc(encodedTxn.length + 6);
		let resp = Buffer.alloc(0);

		if (encodedTxn.length === 0)
			throw new Error('empty transaction');

		buf.writeUInt32LE(keyIndex, 0);
		buf.writeUInt16LE(sigIndex, 4);
		buf.set(encodedTxn, 6);

		for (let i = 0; i < buf.length; i += 255) {
			// INS_GET_TXN_HASH = 0x08
			resp = await this.transport.send(0xe0,
				0x08,
				i === 0 ? 0x00 : 0x80,
				0x01,
				Buffer.from(buf.subarray(i, i + 255)));
		}

		console.log(resp);
		console.log(resp.length);

		return encode(resp.slice(0, resp.length -2));
	}

	/**
	 * signTransaction signs the transaction with the provided key
	 * @param encodedTxn {Buffer} a sia encoded transaction
	 * @param sigIndex {number} the index of the signature to sign
	 * @param keyIndex {number} the index of the key to sign with
	 * @param changeIndex {number} the index of the key used for the change output
	 * @returns {string} the base64 encoded signature
	 */
	async signTransaction(encodedTxn: Buffer, sigIndex: number, keyIndex: number, changeIndex: number) : Promise<string> {
		const buf = Buffer.alloc(encodedTxn.length + 10);
		let resp = Buffer.alloc(0);

		if (encodedTxn.length === 0)
			throw new Error('empty transaction');

		buf.writeUInt32LE(keyIndex, 0);
		buf.writeUInt16LE(sigIndex, 4);
		buf.writeUInt32LE(changeIndex, 6);
		buf.set(encodedTxn, 10);

		for (let i = 0; i < buf.length; i += 255) {
			// INS_GET_TXN_HASH = 0x08
			resp = await this.transport.send(0xe0,
				0x08,
				i === 0 ? 0x00 : 0x80,
				0x01,
				Buffer.from(buf.subarray(i, i + 255)));
		}

		return encode(resp);
	}

	/**
	 * signV2Transaction signs the v2 transaction with the provided key
	 * @param encodedTxn {Buffer} a sia encoded (V2TransactionSemantics) v2 transaction
	 * @param sigIndex {number} the index of the signature to sign
	 * @param keyIndex {number} the index of the key to sign with
	 * @param changeIndex {number} the index of the key used for the change output
	 * @returns {string} the base64 encoded signature
	 */
	async signV2Transaction(encodedTxn: Buffer, sigIndex: number, keyIndex: number, changeIndex: number) : Promise<string> {
		if (!this.v2) {
			throw new Error("v2 signing not enabled");
		}

		const buf = Buffer.alloc(encodedTxn.length + 10);
		let resp = Buffer.alloc(0);

		if (encodedTxn.length === 0)
			throw new Error('empty transaction');

		buf.writeUInt32LE(keyIndex, 0);
		buf.writeUInt16LE(sigIndex, 4);
		buf.writeUInt32LE(changeIndex, 6);
		buf.set(encodedTxn, 10);

		for (let i = 0; i < buf.length; i += 255) {
			// INS_GET_V2TXN_HASH = 0x10
			resp = await this.transport.send(0xe0,
				0x10,
				i === 0 ? 0x00 : 0x80,
				0x01,
				Buffer.from(buf.subarray(i, i + 255)));
		}

		return encode(resp);
	}

	close() : Promise<void> {
		return this.transport.close();
	}
}
