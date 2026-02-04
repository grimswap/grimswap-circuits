import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes, concatBytes } from '@noble/hashes/utils';
import type { StealthKeys, GeneratedStealthAddress } from './types';
import { META_ADDRESS_LENGTH } from './constants';

type Address = `0x${string}`;
type Hex = `0x${string}`;

/**
 * Generate a new set of stealth keys for receiving private payments
 * @returns StealthKeys containing spending and viewing key pairs plus meta-address
 */
export function generateStealthKeys(): StealthKeys {
  // Generate spending key pair
  const spendingPrivateKey = secp256k1.utils.randomPrivateKey();
  const spendingPublicKey = secp256k1.getPublicKey(spendingPrivateKey, true); // compressed

  // Generate viewing key pair
  const viewingPrivateKey = secp256k1.utils.randomPrivateKey();
  const viewingPublicKey = secp256k1.getPublicKey(viewingPrivateKey, true); // compressed

  // Create meta-address: spending public key || viewing public key
  const stealthMetaAddress = concatBytes(spendingPublicKey, viewingPublicKey);

  return {
    spendingPrivateKey: `0x${bytesToHex(spendingPrivateKey)}` as Hex,
    spendingPublicKey: `0x${bytesToHex(spendingPublicKey)}` as Hex,
    viewingPrivateKey: `0x${bytesToHex(viewingPrivateKey)}` as Hex,
    viewingPublicKey: `0x${bytesToHex(viewingPublicKey)}` as Hex,
    stealthMetaAddress: `0x${bytesToHex(stealthMetaAddress)}` as Hex,
  };
}

/**
 * Generate a one-time stealth address for a recipient
 * @param stealthMetaAddress Recipient's stealth meta-address (66 bytes)
 * @returns Generated stealth address, ephemeral public key, and view tag
 */
export function generateStealthAddress(stealthMetaAddress: Hex): GeneratedStealthAddress {
  const metaBytes = hexToBytes(stealthMetaAddress.slice(2));

  if (metaBytes.length !== META_ADDRESS_LENGTH) {
    throw new Error(`Invalid meta-address length: ${metaBytes.length}, expected ${META_ADDRESS_LENGTH}`);
  }

  // Extract spending and viewing public keys
  const spendingPubKey = metaBytes.slice(0, 33);
  const viewingPubKey = metaBytes.slice(33, 66);

  // Generate ephemeral key pair
  const ephemeralPrivateKey = secp256k1.utils.randomPrivateKey();
  const ephemeralPublicKey = secp256k1.getPublicKey(ephemeralPrivateKey, true);

  // Compute shared secret: S = ephemeralPrivate * viewingPubKey
  const sharedSecretPoint = secp256k1.getSharedSecret(ephemeralPrivateKey, viewingPubKey);
  const sharedSecret = keccak_256(sharedSecretPoint);

  // Compute stealth public key: P' = spendingPubKey + hash(S) * G
  const sharedSecretScalar = BigInt(`0x${bytesToHex(sharedSecret)}`) % secp256k1.CURVE.n;
  const sharedSecretPoint2 = secp256k1.ProjectivePoint.BASE.multiply(sharedSecretScalar);

  // Add spending public key point
  const spendingPoint = secp256k1.ProjectivePoint.fromHex(spendingPubKey);
  const stealthPoint = spendingPoint.add(sharedSecretPoint2);
  const stealthPubKey = stealthPoint.toRawBytes(true);

  // Derive stealth address from public key
  const stealthAddress = publicKeyToAddress(stealthPubKey);

  // View tag: first byte of hash(sharedSecret)
  const viewTagHash = keccak_256(sharedSecret);
  const viewTag = viewTagHash[0];

  return {
    stealthAddress,
    ephemeralPubKey: `0x${bytesToHex(ephemeralPublicKey)}` as Hex,
    viewTag,
  };
}

/**
 * Check if a stealth address belongs to you (using your viewing key)
 * @param ephemeralPubKey Ephemeral public key from announcement
 * @param viewingPrivateKey Your viewing private key
 * @param spendingPublicKey Your spending public key
 * @param announcedAddress The stealth address from announcement
 * @param viewTag Optional view tag for fast filtering
 * @returns true if the stealth address belongs to you
 */
export function checkStealthAddress(
  ephemeralPubKey: Hex,
  viewingPrivateKey: Hex,
  spendingPublicKey: Hex,
  announcedAddress: Address,
  viewTag?: number
): boolean {
  try {
    const ephemeralBytes = hexToBytes(ephemeralPubKey.slice(2));
    const viewingPrivBytes = hexToBytes(viewingPrivateKey.slice(2));
    const spendingPubBytes = hexToBytes(spendingPublicKey.slice(2));

    // Compute shared secret: S = viewingPrivate * ephemeralPubKey
    const sharedSecretPoint = secp256k1.getSharedSecret(viewingPrivBytes, ephemeralBytes);
    const sharedSecret = keccak_256(sharedSecretPoint);

    // Fast check with view tag if provided
    if (viewTag !== undefined) {
      const viewTagHash = keccak_256(sharedSecret);
      if (viewTagHash[0] !== viewTag) {
        return false;
      }
    }

    // Compute expected stealth public key
    const sharedSecretScalar = BigInt(`0x${bytesToHex(sharedSecret)}`) % secp256k1.CURVE.n;
    const sharedSecretPoint2 = secp256k1.ProjectivePoint.BASE.multiply(sharedSecretScalar);

    const spendingPoint = secp256k1.ProjectivePoint.fromHex(spendingPubBytes);
    const expectedStealthPoint = spendingPoint.add(sharedSecretPoint2);
    const expectedStealthPubKey = expectedStealthPoint.toRawBytes(true);

    // Derive expected address
    const expectedAddress = publicKeyToAddress(expectedStealthPubKey);

    return expectedAddress.toLowerCase() === announcedAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Derive the private key for a stealth address you own
 * @param viewingPrivateKey Your viewing private key
 * @param spendingPrivateKey Your spending private key
 * @param ephemeralPubKey Ephemeral public key from announcement
 * @returns Private key for the stealth address
 */
export function deriveStealthPrivateKey(
  viewingPrivateKey: Hex,
  spendingPrivateKey: Hex,
  ephemeralPubKey: Hex
): Hex {
  const viewingPrivBytes = hexToBytes(viewingPrivateKey.slice(2));
  const spendingPrivBytes = hexToBytes(spendingPrivateKey.slice(2));
  const ephemeralBytes = hexToBytes(ephemeralPubKey.slice(2));

  // Compute shared secret: S = viewingPrivate * ephemeralPubKey
  const sharedSecretPoint = secp256k1.getSharedSecret(viewingPrivBytes, ephemeralBytes);
  const sharedSecret = keccak_256(sharedSecretPoint);

  // Stealth private key: spendingPrivate + hash(S)
  const spendingScalar = BigInt(`0x${bytesToHex(spendingPrivBytes)}`);
  const sharedSecretScalar = BigInt(`0x${bytesToHex(sharedSecret)}`);

  const stealthPrivateScalar = (spendingScalar + sharedSecretScalar) % secp256k1.CURVE.n;

  // Convert to 32-byte hex
  const stealthPrivateKey = stealthPrivateScalar.toString(16).padStart(64, '0');

  return `0x${stealthPrivateKey}` as Hex;
}

/**
 * Convert a compressed public key to an Ethereum address
 */
function publicKeyToAddress(publicKey: Uint8Array): Address {
  // Get uncompressed public key (without prefix)
  const point = secp256k1.ProjectivePoint.fromHex(publicKey);
  const uncompressed = point.toRawBytes(false).slice(1); // Remove 0x04 prefix

  // Keccak256 hash and take last 20 bytes
  const hash = keccak_256(uncompressed);
  const addressBytes = hash.slice(-20);

  return `0x${bytesToHex(addressBytes)}` as Address;
}

/**
 * Parse a stealth meta-address into its components
 */
export function parseMetaAddress(metaAddress: Hex): {
  spendingPublicKey: Hex;
  viewingPublicKey: Hex;
} {
  const metaBytes = hexToBytes(metaAddress.slice(2));

  if (metaBytes.length !== META_ADDRESS_LENGTH) {
    throw new Error(`Invalid meta-address length: ${metaBytes.length}`);
  }

  return {
    spendingPublicKey: `0x${bytesToHex(metaBytes.slice(0, 33))}` as Hex,
    viewingPublicKey: `0x${bytesToHex(metaBytes.slice(33, 66))}` as Hex,
  };
}

/**
 * Create a stealth meta-address from spending and viewing public keys
 */
export function createMetaAddress(spendingPublicKey: Hex, viewingPublicKey: Hex): Hex {
  const spending = hexToBytes(spendingPublicKey.slice(2));
  const viewing = hexToBytes(viewingPublicKey.slice(2));

  if (spending.length !== 33 || viewing.length !== 33) {
    throw new Error('Public keys must be 33 bytes (compressed)');
  }

  return `0x${bytesToHex(concatBytes(spending, viewing))}` as Hex;
}
