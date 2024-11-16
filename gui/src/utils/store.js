import { Store } from '@tauri-apps/plugin-store';
import { documentDir } from "@tauri-apps/api/path";
let store = null;
const SALT = new TextEncoder().encode("ztmFixedSalt123");
const IV = new Uint8Array(12);

const initStore = async () => {
	store = await Store.load('store.json');
};

const getItem = (key) => {
	return store.get(key);
}

const setItem = async (key, value) => {
	await store.set(key, { value });
	await store.save();
}

async function encryptPEM(pemString, password) {
    const encoder = new TextEncoder();
		const keyMaterial = await crypto.subtle.importKey(
				"raw",
				encoder.encode(password),
				"PBKDF2",
				false,
				["deriveKey"]
		);

		const key = await crypto.subtle.deriveKey(
				{
						name: "PBKDF2",
						salt: SALT,
						iterations: 100, 
						hash: "SHA-256"
				},
				keyMaterial,
				{ name: "AES-GCM", length: 256 },
				false,
				["encrypt"]
		);

		const encrypted = await crypto.subtle.encrypt(
				{ name: "AES-GCM", iv: IV },
				key,
				encoder.encode(pemString)
		);

		return Array.from(new Uint8Array(encrypted));
}
async function decryptPEM(encryptedData, password) {
    const decoder = new TextDecoder();
		const keyMaterial = await crypto.subtle.importKey(
				"raw",
				new TextEncoder().encode(password),
				"PBKDF2",
				false,
				["deriveKey"]
		);

		const key = await crypto.subtle.deriveKey(
				{
						name: "PBKDF2",
						salt: SALT,
						iterations: 100,
						hash: "SHA-256"
				},
				keyMaterial,
				{ name: "AES-GCM", length: 256 },
				false,
				["decrypt"]
		);

		const decrypted = await crypto.subtle.decrypt(
				{ name: "AES-GCM", iv: IV },
				key,
				new Uint8Array(encryptedData)
		);

		return decoder.decode(decrypted);
}
export {
	initStore, getItem, setItem, encryptPEM, decryptPEM
}