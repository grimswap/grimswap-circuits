/**
 * GrimSwap ZK SDK - Stealth Address Claiming
 *
 * Sweep tokens from a stealth address using the derived private key.
 * Works via raw JSON-RPC calls — no ethers/viem dependency required.
 * Browser + Node.js compatible.
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes, concatBytes } from "@noble/hashes/utils";
import { deriveStealthPrivateKey } from "./stealthAddress";
import { UNICHAIN_SEPOLIA } from "./constants";

type Hex = `0x${string}`;
type Address = `0x${string}`;

/** Parameters for claiming tokens from a stealth address */
export interface ClaimParams {
  /** Your spending private key */
  spendingPrivateKey: Hex;
  /** Your viewing private key */
  viewingPrivateKey: Hex;
  /** Ephemeral public key from the stealth address generation */
  ephemeralPubKey: Hex;
  /** ERC20 token contract address to sweep */
  tokenAddress: Address;
  /** Destination address to send tokens to */
  toAddress: Address;
  /** Amount to transfer (if omitted, sweeps full balance) */
  amount?: bigint;
  /** RPC URL (defaults to Unichain Sepolia) */
  rpcUrl?: string;
  /** Chain ID (defaults to 1301 for Unichain Sepolia) */
  chainId?: number;
}

/** Result of a claim operation */
export interface ClaimResult {
  success: boolean;
  txHash?: string;
  stealthAddress?: string;
  amount?: string;
  error?: string;
}

// ERC20 function selectors
const ERC20_BALANCE_OF = "0x70a08231"; // balanceOf(address)
const ERC20_TRANSFER = "0xa9059cbb"; // transfer(address,uint256)

/**
 * Claim/sweep ERC20 tokens from a stealth address
 *
 * Derives the stealth private key, checks the token balance,
 * signs and submits a transfer transaction via JSON-RPC.
 *
 * The stealth address must have ETH for gas (the relayer funds this
 * automatically after a successful private swap).
 *
 * @example
 * ```typescript
 * import { claimStealthTokens } from "@grimswap/circuits";
 *
 * const result = await claimStealthTokens({
 *   spendingPrivateKey: keys.spendingPrivateKey,
 *   viewingPrivateKey: keys.viewingPrivateKey,
 *   ephemeralPubKey: stealth.ephemeralPubKey,
 *   tokenAddress: "0xOutputToken...",
 *   toAddress: "0xMyWallet...",
 * });
 *
 * console.log(result.txHash);
 * ```
 */
export async function claimStealthTokens(
  params: ClaimParams
): Promise<ClaimResult> {
  const {
    spendingPrivateKey,
    viewingPrivateKey,
    ephemeralPubKey,
    tokenAddress,
    toAddress,
    rpcUrl,
    chainId,
  } = params;

  const url = rpcUrl || UNICHAIN_SEPOLIA.rpcUrl;
  const chain = chainId || UNICHAIN_SEPOLIA.chainId;

  try {
    // 1. Derive stealth private key
    const stealthPrivateKey = deriveStealthPrivateKey(
      viewingPrivateKey,
      spendingPrivateKey,
      ephemeralPubKey
    );

    // 2. Get stealth address from private key
    const stealthAddress = privateKeyToAddress(stealthPrivateKey);

    // 3. Check token balance
    const balance = await getERC20Balance(url, tokenAddress, stealthAddress);

    if (balance === 0n) {
      return {
        success: false,
        stealthAddress,
        error: "No token balance at stealth address",
      };
    }

    const transferAmount = params.amount ?? balance;

    if (transferAmount > balance) {
      return {
        success: false,
        stealthAddress,
        amount: balance.toString(),
        error: `Insufficient balance: have ${balance}, want ${transferAmount}`,
      };
    }

    // 4. Build ERC20 transfer calldata
    const calldata = encodeERC20Transfer(toAddress, transferAmount);

    // 5. Get nonce and gas price
    const [nonce, gasPrice] = await Promise.all([
      getNonce(url, stealthAddress),
      getGasPrice(url),
    ]);

    // 6. Estimate gas
    const gasLimit = await estimateGas(
      url,
      stealthAddress,
      tokenAddress,
      calldata
    );

    // 7. Sign and send transaction
    const txHash = await signAndSend(
      url,
      stealthPrivateKey,
      tokenAddress,
      calldata,
      nonce,
      gasPrice,
      gasLimit,
      chain
    );

    return {
      success: true,
      txHash,
      stealthAddress,
      amount: transferAmount.toString(),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

/**
 * Get the stealth address and its token balance without claiming
 *
 * Useful for showing the user what's available before claiming.
 */
export async function getStealthBalance(
  spendingPrivateKey: Hex,
  viewingPrivateKey: Hex,
  ephemeralPubKey: Hex,
  tokenAddress: Address,
  rpcUrl?: string
): Promise<{ stealthAddress: string; balance: bigint }> {
  const url = rpcUrl || UNICHAIN_SEPOLIA.rpcUrl;

  const stealthPrivateKey = deriveStealthPrivateKey(
    viewingPrivateKey,
    spendingPrivateKey,
    ephemeralPubKey
  );

  const stealthAddress = privateKeyToAddress(stealthPrivateKey);
  const balance = await getERC20Balance(url, tokenAddress, stealthAddress);

  return { stealthAddress, balance };
}

/**
 * Get ETH balance of stealth address (to check if gas is available)
 */
export async function getStealthEthBalance(
  spendingPrivateKey: Hex,
  viewingPrivateKey: Hex,
  ephemeralPubKey: Hex,
  rpcUrl?: string
): Promise<{ stealthAddress: string; balance: bigint }> {
  const url = rpcUrl || UNICHAIN_SEPOLIA.rpcUrl;

  const stealthPrivateKey = deriveStealthPrivateKey(
    viewingPrivateKey,
    spendingPrivateKey,
    ephemeralPubKey
  );

  const stealthAddress = privateKeyToAddress(stealthPrivateKey);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [stealthAddress, "latest"],
    }),
  });

  const json = (await response.json()) as { result?: string; error?: any };
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);

  return {
    stealthAddress,
    balance: BigInt(json.result || "0x0"),
  };
}

// ============ Internal helpers ============

function privateKeyToAddress(privateKey: Hex): string {
  const privBytes = hexToBytes(privateKey.slice(2));
  const pubKey = secp256k1.getPublicKey(privBytes, false); // uncompressed
  const pubKeyNoPrefix = pubKey.slice(1); // remove 0x04 prefix
  const hash = keccak_256(pubKeyNoPrefix);
  const addr = bytesToHex(hash.slice(-20));
  return `0x${addr}`;
}

function encodeERC20Transfer(to: Address, amount: bigint): string {
  const toParam = to.slice(2).toLowerCase().padStart(64, "0");
  const amountParam = amount.toString(16).padStart(64, "0");
  return `${ERC20_TRANSFER}${toParam}${amountParam}`;
}

async function getERC20Balance(
  rpcUrl: string,
  tokenAddress: string,
  account: string
): Promise<bigint> {
  const addrParam = account.slice(2).toLowerCase().padStart(64, "0");
  const data = `${ERC20_BALANCE_OF}${addrParam}`;

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: tokenAddress, data }, "latest"],
    }),
  });

  const json = (await response.json()) as { result?: string; error?: any };
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);

  return BigInt(json.result || "0x0");
}

async function getNonce(rpcUrl: string, address: string): Promise<number> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionCount",
      params: [address, "latest"],
    }),
  });

  const json = (await response.json()) as { result?: string; error?: any };
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);

  return parseInt(json.result || "0x0", 16);
}

async function getGasPrice(rpcUrl: string): Promise<bigint> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_gasPrice",
      params: [],
    }),
  });

  const json = (await response.json()) as { result?: string; error?: any };
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);

  return BigInt(json.result || "0x0");
}

async function estimateGas(
  rpcUrl: string,
  from: string,
  to: string,
  data: string
): Promise<bigint> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_estimateGas",
      params: [{ from, to, data }],
    }),
  });

  const json = (await response.json()) as { result?: string; error?: any };
  if (json.error) {
    // Fallback gas limit for ERC20 transfer
    return 65000n;
  }

  // Add 20% buffer
  const estimated = BigInt(json.result || "0x0");
  return (estimated * 120n) / 100n;
}

async function signAndSend(
  rpcUrl: string,
  privateKey: Hex,
  to: string,
  data: string,
  nonce: number,
  gasPrice: bigint,
  gasLimit: bigint,
  chainId: number
): Promise<string> {
  // Build legacy transaction (Type 0) for maximum compatibility
  const tx = encodeLegacyTransaction(
    nonce,
    gasPrice,
    gasLimit,
    to,
    0n, // value = 0 (ERC20 transfer)
    data,
    chainId
  );

  // Sign with EIP-155
  const privBytes = hexToBytes(privateKey.slice(2));
  const txHash = keccak_256(tx);
  const signature = secp256k1.sign(txHash, privBytes);

  // Encode signed transaction
  const v = BigInt(chainId) * 2n + 35n + BigInt(signature.recovery);
  const r = signature.r;
  const s = signature.s;

  const signedTx = encodeLegacyTransactionSigned(
    nonce,
    gasPrice,
    gasLimit,
    to,
    0n,
    data,
    v,
    r,
    s
  );

  // Send raw transaction
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_sendRawTransaction",
      params: [`0x${bytesToHex(signedTx)}`],
    }),
  });

  const json = (await response.json()) as { result?: string; error?: any };
  if (json.error) throw new Error(`Send tx failed: ${json.error.message}`);

  return json.result!;
}

// ============ RLP Encoding ============

function rlpEncode(input: Uint8Array | Uint8Array[]): Uint8Array {
  if (!Array.isArray(input) && input instanceof Uint8Array) {
    if (input.length === 1 && input[0] < 0x80) {
      return new Uint8Array(input);
    }
    if (input.length <= 55) {
      const prefix = new Uint8Array([0x80 + input.length]);
      const result = new Uint8Array(prefix.length + input.length);
      result.set(prefix);
      result.set(input, prefix.length);
      return result;
    }
    const lenBytes = bigintToBytes(BigInt(input.length));
    const prefix = new Uint8Array([0xb7 + lenBytes.length]);
    const result = new Uint8Array(prefix.length + lenBytes.length + input.length);
    result.set(prefix);
    result.set(lenBytes, prefix.length);
    result.set(input, prefix.length + lenBytes.length);
    return result;
  }

  // Array
  const items = input as Uint8Array[];
  const parts: Uint8Array[] = [];
  let totalLen = 0;
  for (const item of items) {
    const encoded = rlpEncode(item);
    parts.push(encoded);
    totalLen += encoded.length;
  }

  let payload = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) {
    payload.set(part, offset);
    offset += part.length;
  }

  if (payload.length <= 55) {
    const prefix = new Uint8Array([0xc0 + payload.length]);
    const result = new Uint8Array(prefix.length + payload.length);
    result.set(prefix);
    result.set(payload, prefix.length);
    return result;
  }

  const lenBytes = bigintToBytes(BigInt(payload.length));
  const prefix = new Uint8Array([0xf7 + lenBytes.length]);
  const result = new Uint8Array(prefix.length + lenBytes.length + payload.length);
  result.set(prefix);
  result.set(lenBytes, prefix.length);
  result.set(payload, prefix.length + lenBytes.length);
  return result;
}

function bigintToBytes(value: bigint): Uint8Array {
  if (value === 0n) return new Uint8Array(0);
  const hex = value.toString(16);
  const padded = hex.length % 2 ? "0" + hex : hex;
  return hexToBytes(padded);
}

function numberToBytes(value: number): Uint8Array {
  return bigintToBytes(BigInt(value));
}

function encodeLegacyTransaction(
  nonce: number,
  gasPrice: bigint,
  gasLimit: bigint,
  to: string,
  value: bigint,
  data: string,
  chainId: number
): Uint8Array {
  // EIP-155: [nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0]
  return rlpEncode([
    numberToBytes(nonce),
    bigintToBytes(gasPrice),
    bigintToBytes(gasLimit),
    hexToBytes(to.slice(2)),
    bigintToBytes(value),
    hexToBytes(data.slice(2)),
    numberToBytes(chainId),
    new Uint8Array(0),
    new Uint8Array(0),
  ]);
}

function encodeLegacyTransactionSigned(
  nonce: number,
  gasPrice: bigint,
  gasLimit: bigint,
  to: string,
  value: bigint,
  data: string,
  v: bigint,
  r: bigint,
  s: bigint
): Uint8Array {
  return rlpEncode([
    numberToBytes(nonce),
    bigintToBytes(gasPrice),
    bigintToBytes(gasLimit),
    hexToBytes(to.slice(2)),
    bigintToBytes(value),
    hexToBytes(data.slice(2)),
    bigintToBytes(v),
    bigintToBytes(r),
    bigintToBytes(s),
  ]);
}
