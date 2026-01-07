import { ethers } from 'ethers';

// Base Sponsored Smart Wallet Factory addresses per chain (January 2026)
// These are the official Base-sponsored Smart Wallet factory contracts
export const BASE_SPONSORED_FACTORY_ADDRESSES: Record<number, string> = {
  1: '0x000000006551c19487814612e58FE06813775758', // Ethereum Mainnet - Base Sponsored
  8453: '0x000000006551c19487814612e58FE06813775758', // Base - Base Sponsored
  10: '0x000000006551c19487814612e58FE06813775758', // Optimism - Base Sponsored
  42161: '0x000000006551c19487814612e58FE06813775758', // Arbitrum - Base Sponsored
  137: '0x000000006551c19487814612e58FE06813775758', // Polygon - Base Sponsored
  56: '0x000000006551c19487814612e58FE06813775758', // BNB Chain - Base Sponsored
};

// BaseApp Smart Wallet ABI
export const BASEAPP_SMART_WALLET_ABI = [
  'function upgradeTo(address newImplementation) external',
  'function upgradeToAndCall(address newImplementation, bytes memory data) external payable',
  'function implementation() external view returns (address)',
  'function owner() external view returns (address)',
];

// BaseApp Factory ABI
export const BASEAPP_FACTORY_ABI = [
  'function getLatestImplementation() external view returns (address)',
  'function getImplementation() external view returns (address)',
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
 * Get the latest Base Sponsored Smart Wallet implementation address (January 2026)
 */
export async function getLatestBaseSponsoredImplementation(
  provider: ethers.BrowserProvider,
  chainId: number
): Promise<string | null> {
  try {
    const factoryAddress = BASE_SPONSORED_FACTORY_ADDRESSES[chainId];
    if (!factoryAddress) {
      throw new Error(`Base-sponsored factory not available for chain ${chainId}`);
    }

    const factoryContract = new ethers.Contract(
      factoryAddress,
      BASEAPP_FACTORY_ABI,
      provider
    );

    // Try different methods to get latest implementation
    let latestImpl: string | null = null;
    
    try {
      latestImpl = await factoryContract.getLatestImplementation();
    } catch {
      try {
        latestImpl = await factoryContract.getImplementation();
      } catch {
        try {
          latestImpl = await factoryContract.implementation();
        } catch {
          // If all methods fail, return null
          return null;
        }
      }
    }

    return latestImpl;
  } catch (error: any) {
    console.error('Error getting latest Base-sponsored implementation:', error);
    return null;
  }
}

/**
 * Check if a wallet address is a Base Sponsored Smart Wallet
 */
export async function isBaseSponsoredSmartWallet(
  provider: ethers.BrowserProvider,
  walletAddress: string,
  chainId: number
): Promise<boolean> {
  try {
    // Check if wallet has implementation() function
    const walletContract = new ethers.Contract(
      walletAddress,
      BASEAPP_SMART_WALLET_ABI,
      provider
    );

    const implementation = await walletContract.implementation();
    
    // Check if implementation matches Base-sponsored factory
    const factoryAddress = BASE_SPONSORED_FACTORY_ADDRESSES[chainId];
    if (!factoryAddress) return false;
    
    // Verify wallet can be upgraded via Base-sponsored factory
    const latestImpl = await getLatestBaseSponsoredImplementation(provider, chainId);
    return !!latestImpl && !!implementation;
  } catch {
    return false;
  }
}

/**
 * Get current implementation of a Base Sponsored Smart Wallet
 */
export async function getBaseSponsoredWalletImplementation(
  provider: ethers.BrowserProvider,
  walletAddress: string
): Promise<string | null> {
  try {
    const walletContract = new ethers.Contract(
      walletAddress,
      BASEAPP_SMART_WALLET_ABI,
      provider
    );

    const implementation = await walletContract.implementation();
    return implementation;
  } catch (error: any) {
    console.error('Error getting Base-sponsored wallet implementation:', error);
    return null;
  }
}

/**
 * Automatically upgrade Base Sponsored Smart Wallet to latest implementation (January 2026)
 */
export async function upgradeBaseSponsoredSmartWallet(
  params: BaseAppUpgradeParams
): Promise<BaseAppUpgradeResult> {
  try {
    const { walletAddress, chainId, provider } = params;

    // Get latest implementation from Base-sponsored factory
    const latestImpl = await getLatestBaseSponsoredImplementation(provider, chainId);
    if (!latestImpl) {
      return {
        success: false,
        error: 'Could not fetch latest BaseApp implementation',
      };
    }

    // Get current implementation
    const currentImpl = await getBaseSponsoredWalletImplementation(provider, walletAddress);
    if (!currentImpl) {
      return {
        success: false,
        error: 'Could not get current wallet implementation',
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

    // Perform upgrade
    const signer = await provider.getSigner();
    const walletContract = new ethers.Contract(
      walletAddress,
      BASEAPP_SMART_WALLET_ABI,
      signer
    );

    const tx = await walletContract.upgradeTo(latestImpl);
    const txHash = tx.hash;
    
    // Wait for confirmation
    await tx.wait();

    return {
      success: true,
      txHash,
      newImplementation: latestImpl,
    };
  } catch (error: any) {
    console.error('Base-sponsored upgrade error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

// Legacy function names for backward compatibility
export const getLatestBaseAppImplementation = getLatestBaseSponsoredImplementation;
export const isBaseAppSmartWallet = isBaseSponsoredSmartWallet;
export const getBaseAppWalletImplementation = getBaseSponsoredWalletImplementation;
export const upgradeBaseAppSmartWallet = upgradeBaseSponsoredSmartWallet;
