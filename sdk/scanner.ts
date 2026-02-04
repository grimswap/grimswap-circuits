import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import type { ScanParams, StealthPayment } from './types';
import { checkStealthAddress } from './stealthAddress';
import { ANNOUNCER_ABI, STEALTH_SCHEME_ID } from './constants';

type Address = `0x${string}`;
type Hex = `0x${string}`;

interface Log {
  topics: readonly (string | null)[];
  data: string;
  blockNumber: bigint | null;
  transactionHash: string | null;
}

/**
 * Scan ERC-5564 announcements to find payments sent to you
 *
 * @param params Scan parameters including viewing key
 * @returns Array of stealth payments that belong to you
 */
export async function scanAnnouncements(params: ScanParams): Promise<StealthPayment[]> {
  const {
    publicClient,
    viewingPrivateKey,
    spendingPublicKey,
    fromBlock = 0n,
    toBlock,
  } = params;

  // Get announcer address from chain config
  const chainId = await publicClient.getChainId();
  const announcerAddress = getAnnouncerAddress(chainId);

  // Fetch announcement events
  const logs = await publicClient.getLogs({
    address: announcerAddress,
    event: {
      type: 'event',
      name: 'Announcement',
      inputs: [
        { name: 'schemeId', type: 'uint256', indexed: true },
        { name: 'stealthAddress', type: 'address', indexed: true },
        { name: 'caller', type: 'address', indexed: true },
        { name: 'ephemeralPubKey', type: 'bytes', indexed: false },
        { name: 'metadata', type: 'bytes', indexed: false },
      ],
    },
    args: {
      schemeId: STEALTH_SCHEME_ID,
    },
    fromBlock,
    toBlock: toBlock ?? 'latest',
  });

  // Filter announcements that belong to us
  const payments: StealthPayment[] = [];

  for (const log of logs) {
    const payment = processAnnouncement(
      log as unknown as Log,
      viewingPrivateKey,
      spendingPublicKey
    );
    if (payment) {
      payments.push(payment);
    }
  }

  return payments;
}

/**
 * Process a single announcement log to check if it's ours
 */
function processAnnouncement(
  log: Log,
  viewingPrivateKey: Hex,
  spendingPublicKey: Hex
): StealthPayment | null {
  try {
    // Extract data from log
    const stealthAddress = log.topics[2] as Address; // indexed
    const ephemeralPubKey = extractEphemeralPubKey(log.data as Hex);
    const metadata = extractMetadata(log.data as Hex);

    // Parse metadata: viewTag (1 byte) || token (20 bytes) || amount (32 bytes)
    const { viewTag, token, amount } = parseMetadata(metadata);

    // Check if this announcement is for us
    const isOurs = checkStealthAddress(
      ephemeralPubKey,
      viewingPrivateKey,
      spendingPublicKey,
      stealthAddress,
      viewTag
    );

    if (!isOurs) {
      return null;
    }

    return {
      stealthAddress,
      ephemeralPubKey,
      viewTag,
      token,
      amount,
      blockNumber: log.blockNumber ?? 0n,
      txHash: log.transactionHash as Hex,
    };
  } catch {
    return null;
  }
}

/**
 * Extract ephemeral public key from log data
 */
function extractEphemeralPubKey(data: Hex): Hex {
  // ABI decode: first dynamic bytes field
  const dataBytes = hexToBytes(data.slice(2));

  // Skip offset for first bytes (32 bytes) and offset for second bytes (32 bytes)
  // Then read length of first bytes (32 bytes)
  const offset1 = Number(BigInt(`0x${bytesToHex(dataBytes.slice(0, 32))}`));
  const length1 = Number(BigInt(`0x${bytesToHex(dataBytes.slice(offset1, offset1 + 32))}`));
  const ephemeralPubKey = dataBytes.slice(offset1 + 32, offset1 + 32 + length1);

  return `0x${bytesToHex(ephemeralPubKey)}` as Hex;
}

/**
 * Extract metadata from log data
 */
function extractMetadata(data: Hex): Hex {
  const dataBytes = hexToBytes(data.slice(2));

  // Second dynamic bytes field
  const offset2 = Number(BigInt(`0x${bytesToHex(dataBytes.slice(32, 64))}`));
  const length2 = Number(BigInt(`0x${bytesToHex(dataBytes.slice(offset2, offset2 + 32))}`));
  const metadata = dataBytes.slice(offset2 + 32, offset2 + 32 + length2);

  return `0x${bytesToHex(metadata)}` as Hex;
}

/**
 * Parse metadata bytes: viewTag (1) || token (20) || amount (32)
 */
function parseMetadata(metadata: Hex): {
  viewTag: number;
  token: Address;
  amount: bigint;
} {
  const metaBytes = hexToBytes(metadata.slice(2));

  if (metaBytes.length < 53) {
    // Minimum: 1 + 20 + 32 = 53 bytes
    return {
      viewTag: metaBytes[0] ?? 0,
      token: '0x0000000000000000000000000000000000000000' as Address,
      amount: 0n,
    };
  }

  const viewTag = metaBytes[0];
  const token = `0x${bytesToHex(metaBytes.slice(1, 21))}` as Address;
  const amount = BigInt(`0x${bytesToHex(metaBytes.slice(21, 53))}`);

  return { viewTag, token, amount };
}

/**
 * Get announcer address for a chain
 */
function getAnnouncerAddress(chainId: number): Address {
  const addresses: Record<number, Address> = {
    1301: '0x42013A72753F6EC28e27582D4cDb8425b44fd311', // Unichain Sepolia
  };

  const address = addresses[chainId];
  if (!address) {
    throw new Error(`No announcer address for chain ${chainId}`);
  }

  return address;
}

/**
 * Continuously scan for new payments
 */
export async function watchAnnouncements(
  params: ScanParams,
  onPayment: (payment: StealthPayment) => void,
  pollInterval = 5000
): Promise<() => void> {
  let lastBlock = params.fromBlock ?? 0n;
  let isRunning = true;

  const poll = async () => {
    while (isRunning) {
      try {
        const payments = await scanAnnouncements({
          ...params,
          fromBlock: lastBlock,
        });

        for (const payment of payments) {
          if (payment.blockNumber > lastBlock) {
            lastBlock = payment.blockNumber;
          }
          onPayment(payment);
        }

        // Move past processed blocks
        lastBlock = lastBlock + 1n;
      } catch (error) {
        console.error('Error scanning announcements:', error);
      }

      await sleep(pollInterval);
    }
  };

  // Start polling
  poll();

  // Return stop function
  return () => {
    isRunning = false;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export { ANNOUNCER_ABI };
