import { ethers } from 'ethers';

// Coinbase Smart Wallet Factory addresses per chain
// Official addresses from: https://github.com/coinbase/smart-wallet
// Deployed via Safe Singleton Factory - same address across 248 chains
export const COINBASE_SMART_WALLET_FACTORY_ADDRESSES: Record<number, string> = {
  1: '0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842', // Ethereum Mainnet - v1.1
  8453: '0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842', // Base - v1.1
  10: '0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842', // Optimism - v1.1
  42161: '0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842', // Arbitrum - v1.1
  137: '0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842', // Polygon - v1.1
  56: '0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842', // BNB Chain - v1.1
};

// Legacy v1.0 factory (for reference)
export const COINBASE_SMART_WALLET_FACTORY_V1 = '0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a';

// Coinbase Smart Wallet ABI (from https://github.com/coinbase/smart-wallet)
// ERC-4337 compliant smart contract wallet
export const COINBASE_SMART_WALLET_ABI = [
  // UUPSUpgradeable functions
  'function upgradeTo(address newImplementation) external',
  'function upgradeToAndCall(address newImplementation, bytes memory data) external payable',
  'function implementation() external view returns (address)',
  // MultiOwnable functions
  'function ownerCount() external view returns (uint256)',
  'function ownerAtIndex(uint256 index) external view returns (bytes)',
  // EntryPoint functions
  'function executeWithoutChainIdValidation(bytes calldata data) external payable',
];

// Coinbase Smart Wallet Factory ABI
export const COINBASE_FACTORY_ABI = [
  'function getAddress(bytes memory initCode, uint256 salt) external view returns (address)',
  'function deploy(bytes memory initCode, uint256 salt) external returns (address)',
  'function implementation() external view returns (address)',
];

export interface BaseAppUpgradeParams {
  walletAddress: string;
  chainId: number;
  provider: ethers.BrowserProvider;
}

export interface BaseAppUpgradeResult {
  success: boolean;
  txHash?: string;
  newImplementation?: string;
  error?: string;
}

/**
 * Get the latest Coinbase Smart Wallet implementation address
 * Based on: https://github.com/coinbase/smart-wallet
 */
export async function getLatestCoinbaseSmartWalletImplementation(
  provider: ethers.BrowserProvider,
  chainId: number
): Promise<string | null> {
  try {
    const factoryAddress = COINBASE_SMART_WALLET_FACTORY_ADDRESSES[chainId];
    if (!factoryAddress) {
      throw new Error(`Coinbase Smart Wallet factory not available for chain ${chainId}`);
    }

    const factoryContract = new ethers.Contract(
      factoryAddress,
      COINBASE_FACTORY_ABI,
      provider
    );

    // Get implementation from factory
    let latestImpl: string | null = null;
    
    try {
      latestImpl = await factoryContract.implementation();
    } catch (error) {
      console.error('Error getting implementation from factory:', error);
      // Factory might not have implementation() method, try alternative approach
      // For now, we'll use the factory address itself or query from a deployed wallet
      return null;
    }

    return latestImpl;
  } catch (error: any) {
    console.error('Error getting latest Coinbase Smart Wallet implementation:', error);
    return null;
  }
}

/**
 * Check if a wallet address is a Coinbase Smart Wallet
 * Based on: https://github.com/coinbase/smart-wallet
 */
export async function isCoinbaseSmartWallet(
  provider: ethers.BrowserProvider,
  walletAddress: string,
  chainId: number
): Promise<boolean> {
  try {
    // Check if wallet has implementation() function (UUPSUpgradeable)
    const walletContract = new ethers.Contract(
      walletAddress,
      COINBASE_SMART_WALLET_ABI,
      provider
    );

    // Try to get implementation - Coinbase Smart Wallet uses UUPS pattern
    const implementation = await walletContract.implementation();
    
    // Check if wallet has ownerCount (MultiOwnable feature)
    try {
      await walletContract.ownerCount();
      return !!implementation;
    } catch {
      // If ownerCount fails, it might still be a Coinbase wallet
      return !!implementation;
    }
  } catch {
    return false;
  }
}

/**
 * Get current implementation of a Coinbase Smart Wallet
 */
export async function getCoinbaseSmartWalletImplementation(
  provider: ethers.BrowserProvider,
  walletAddress: string
): Promise<string | null> {
  try {
    const walletContract = new ethers.Contract(
      walletAddress,
      COINBASE_SMART_WALLET_ABI,
      provider
    );

    const implementation = await walletContract.implementation();
    return implementation;
  } catch (error: any) {
    console.error('Error getting Coinbase Smart Wallet implementation:', error);
    return null;
  }
}

/**
 * Automatically upgrade Coinbase Smart Wallet to latest implementation
 * Uses upgradeToAndCall as recommended in Coinbase Smart Wallet documentation
 * Based on: https://github.com/coinbase/smart-wallet
 */
export async function upgradeCoinbaseSmartWallet(
  params: BaseAppUpgradeParams
): Promise<BaseAppUpgradeResult> {
  try {
    const { walletAddress, chainId, provider } = params;

    // Get latest implementation from factory
    const latestImpl = await getLatestCoinbaseSmartWalletImplementation(provider, chainId);
    if (!latestImpl) {
      return {
        success: false,
        error: 'Could not fetch latest Coinbase Smart Wallet implementation from factory',
      };
    }

    // Get current implementation
    const currentImpl = await getCoinbaseSmartWalletImplementation(provider, walletAddress);
    if (!currentImpl) {
      return {
        success: false,
        error: 'Could not get current wallet implementation. Please ensure this is a Coinbase Smart Wallet.',
      };
    }

    // Check if upgrade is needed
    if (currentImpl.toLowerCase() === latestImpl.toLowerCase()) {
      return {
        success: true,
        newImplementation: latestImpl,
        error: 'Wallet is already on the latest implementation',
      };
    }

    // Perform upgrade using upgradeToAndCall (recommended by Coinbase)
    // This allows for initialization data if needed
    const signer = await provider.getSigner();
    const walletContract = new ethers.Contract(
      walletAddress,
      COINBASE_SMART_WALLET_ABI,
      signer
    );

    // Use upgradeToAndCall with empty data (can be extended for initialization)
    const tx = await walletContract.upgradeToAndCall(latestImpl, '0x');
    const txHash = tx.hash;
    
    // Wait for confirmation
    await tx.wait();

    return {
      success: true,
      txHash,
      newImplementation: latestImpl,
    };
  } catch (error: any) {
    console.error('Coinbase Smart Wallet upgrade error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

// Legacy function names for backward compatibility
export const BASE_SPONSORED_FACTORY_ADDRESSES = COINBASE_SMART_WALLET_FACTORY_ADDRESSES;
export const getLatestBaseSponsoredImplementation = getLatestCoinbaseSmartWalletImplementation;
export const isBaseSponsoredSmartWallet = isCoinbaseSmartWallet;
export const getBaseSponsoredWalletImplementation = getCoinbaseSmartWalletImplementation;
export const upgradeBaseSponsoredSmartWallet = upgradeCoinbaseSmartWallet;
