/**
 * GrimSwap Constants
 * Chain configurations, contract addresses, and ABIs
 */

type Address = `0x${string}`;

// ============ Contract Addresses ============

export interface GrimAddresses {
  grimSwapZK: Address;
  grimPool: Address;
  grimSwapRouter: Address;
  groth16Verifier: Address;
  stealthRegistry: Address;
  announcer: Address;
  poolManager: Address;
}

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  addresses: GrimAddresses;
}

// ============ Unichain Sepolia (Testnet) ============

export const UNICHAIN_SEPOLIA_ADDRESSES: GrimAddresses = {
  grimSwapZK: '0x3bee7D1A5914d1ccD34D2a2d00C359D0746400C4', // NEW: fee=3000, tickSpacing=60
  grimPool: '0xEAB5E7B4e715A22E8c114B7476eeC15770B582bb',
  grimSwapRouter: '0xC13a6a504da21aD23c748f08d3E991621D42DA4F',
  groth16Verifier: '0xF7D14b744935cE34a210D7513471a8E6d6e696a0',
  stealthRegistry: '0xA9e4ED4183b3B3cC364cF82dA7982D5ABE956307',
  announcer: '0x42013A72753F6EC28e27582D4cDb8425b44fd311',
  poolManager: '0x00B036B58a818B1BC34d502D3fE730Db729e62AC',
};

export const UNICHAIN_SEPOLIA: ChainConfig = {
  chainId: 1301,
  name: 'Unichain Sepolia',
  rpcUrl: 'https://sepolia.unichain.org',
  explorerUrl: 'https://unichain-sepolia.blockscout.com',
  addresses: UNICHAIN_SEPOLIA_ADDRESSES,
};

// ============ Unichain Mainnet ============

export const UNICHAIN_MAINNET_ADDRESSES: GrimAddresses = {
  grimSwapZK: '0x0000000000000000000000000000000000000000', // TODO: Deploy
  grimPool: '0x0000000000000000000000000000000000000000', // TODO: Deploy
  grimSwapRouter: '0x0000000000000000000000000000000000000000', // TODO: Deploy
  groth16Verifier: '0x0000000000000000000000000000000000000000', // TODO: Deploy
  stealthRegistry: '0x0000000000000000000000000000000000000000', // TODO: Deploy
  announcer: '0x0000000000000000000000000000000000000000', // TODO: Deploy
  poolManager: '0x1F98400000000000000000000000000000000004',
};

export const UNICHAIN_MAINNET: ChainConfig = {
  chainId: 130,
  name: 'Unichain',
  rpcUrl: 'https://mainnet.unichain.org',
  explorerUrl: 'https://uniscan.xyz',
  addresses: UNICHAIN_MAINNET_ADDRESSES,
};

// ============ Chain Registry ============

export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  [UNICHAIN_SEPOLIA.chainId]: UNICHAIN_SEPOLIA,
  [UNICHAIN_MAINNET.chainId]: UNICHAIN_MAINNET,
};

export function getChainConfig(chainId: number): ChainConfig {
  const config = SUPPORTED_CHAINS[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return config;
}

// ============ ERC-5564 Constants ============

/** Stealth address scheme ID for secp256k1 */
export const STEALTH_SCHEME_ID = 1n;

/** Meta-address length: 33 bytes spending + 33 bytes viewing */
export const META_ADDRESS_LENGTH = 66;

// ============ Contract ABIs ============

export const STEALTH_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'registerStealthMetaAddress',
    inputs: [{ name: 'stealthMetaAddress', type: 'bytes' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getStealthMetaAddress',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'StealthMetaAddressRegistered',
    inputs: [
      { name: 'registrant', type: 'address', indexed: true },
      { name: 'stealthMetaAddress', type: 'bytes', indexed: false },
    ],
  },
] as const;

export const ANNOUNCER_ABI = [
  {
    type: 'function',
    name: 'announce',
    inputs: [
      { name: 'schemeId', type: 'uint256' },
      { name: 'stealthAddress', type: 'address' },
      { name: 'ephemeralPubKey', type: 'bytes' },
      { name: 'metadata', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
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
] as const;

export const GRIM_POOL_ABI = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'isKnownRoot',
    inputs: [{ name: 'root', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isSpent',
    inputs: [{ name: 'nullifierHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLastRoot',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'addKnownRoot',
    inputs: [{ name: 'root', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getDepositCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'releaseForSwap',
    inputs: [
      { name: 'nullifierHash', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Deposit',
    inputs: [
      { name: 'commitment', type: 'bytes32', indexed: true },
      { name: 'leafIndex', type: 'uint32', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const GRIM_SWAP_ZK_ABI = [
  {
    type: 'function',
    name: 'totalPrivateSwaps',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalPrivateVolume',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'PrivateSwapExecuted',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true },
      { name: 'nullifierHash', type: 'bytes32', indexed: true },
      { name: 'stealthAddress', type: 'address', indexed: true },
      { name: 'amountOut', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const GROTH16_VERIFIER_ABI = [
  {
    type: 'function',
    name: 'verifyProof',
    inputs: [
      { name: '_pA', type: 'uint256[2]' },
      { name: '_pB', type: 'uint256[2][2]' },
      { name: '_pC', type: 'uint256[2]' },
      { name: '_pubSignals', type: 'uint256[8]' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

export const GRIM_SWAP_ROUTER_ABI = [
  {
    type: 'function',
    name: 'executePrivateSwap',
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'zeroForOne', type: 'bool' },
          { name: 'amountSpecified', type: 'int256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
      { name: 'nullifierHash', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
      { name: 'relayer', type: 'address' },
      { name: 'relayerFee', type: 'uint256' },
      { name: 'pA', type: 'uint256[2]' },
      { name: 'pB', type: 'uint256[2][2]' },
      { name: 'pC', type: 'uint256[2]' },
      { name: 'pubSignals', type: 'uint256[8]' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;

export const RELAYER_DEFAULT_URL = 'https://services.grimswap.com';
