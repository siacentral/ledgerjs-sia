import type Transport from "@ledgerhq/hw-transport";
import { decode } from '@stablelib/utf8';
import { Buffer } from 'buffer';
import { encode } from '@stablelib/base64';

function uint32ToBuffer(val: number): Buffer {
	const buf = Buffer.alloc(4);
	buf.writeUInt32LE(val, 0);
	return buf;
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
			'getPublicKey',
			'getStandardAddress',
			'signTransactionV044',
			'signTransaction'
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
	 * getStandardAddress returns the standard Sia address for the provided 
	 * public key index. A standard address is defined as an address having 
	 * 1 public key, requiring 1 signature, and no timelock.
	 * @param index {number} the index of the public key
	 * @returns {string} the hex encoded Sia unlock hash
	 */
	async getStandardAddress(index: number) : Promise<string> {
		const resp = await this.transport.send(0xe0, 0x02, 0x00, 0x00, uint32ToBuffer(index));

		return decode(resp.slice(32));
	}

	/**
	 * getPublicKey returns the public key at the provided index
	 * 
	 * @param index {number} the index of the public key to get.
	 * @returns {string} the hex encoded public key.
	 */
	async getPublicKey(index: number) : Promise<string> {
		const resp = await this.transport.send(0xe0, 0x02, 0x00, 0x01, uint32ToBuffer(index));

		return `ed25519:${resp.slice(0, 32).reduce((v, b) => v + ('0' + b.toString(16)).slice(-2), '')}`;
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
			resp = await this.transport.send(0xe0,
				0x08,
				i === 0 ? 0x00 : 0x80,
				0x01,
				Buffer.from(buf.subarray(i, i + 255)));
		}

		return encode(resp);
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
			resp = await this.transport.send(0xe0,
				0x08,
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
