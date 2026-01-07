import { ethers } from 'ethers';

// BaseApp Smart Wallet Factory addresses per chain
// These are the official BaseApp Smart Wallet factory contracts
export const BASEAPP_FACTORY_ADDRESSES: Record<number, string> = {
  1: '0x000000006551c19487814612e58FE06813775758', // Ethereum Mainnet
  8453: '0x000000006551c19487814612e58FE06813775758', // Base
  10: '0x000000006551c19487814612e58FE06813775758', // Optimism
  42161: '0x000000006551c19487814612e58FE06813775758', // Arbitrum
  137: '0x000000006551c19487814612e58FE06813775758', // Polygon
  56: '0x000000006551c19487814612e58FE06813775758', // BNB Chain
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
 * Get the latest BaseApp Smart Wallet implementation address
 */
export async function getLatestBaseAppImplementation(
  provider: ethers.BrowserProvider,
  chainId: number
): Promise<string | null> {
  try {
    const factoryAddress = BASEAPP_FACTORY_ADDRESSES[chainId];
    if (!factoryAddress) {
      throw new Error(`BaseApp factory not available for chain ${chainId}`);
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
    console.error('Error getting latest BaseApp implementation:', error);
    return null;
  }
}

/**
 * Check if a wallet address is a BaseApp Smart Wallet
 */
export async function isBaseAppSmartWallet(
  provider: ethers.BrowserProvider,
  walletAddress: string
): Promise<boolean> {
  try {
    const walletContract = new ethers.Contract(
      walletAddress,
      BASEAPP_SMART_WALLET_ABI,
      provider
    );

    // Try to call implementation() to check if it's a BaseApp wallet
    await walletContract.implementation();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current implementation of a BaseApp Smart Wallet
 */
export async function getBaseAppWalletImplementation(
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
    console.error('Error getting BaseApp wallet implementation:', error);
    return null;
  }
}

/**
 * Automatically upgrade BaseApp Smart Wallet to latest implementation
 */
export async function upgradeBaseAppSmartWallet(
  params: BaseAppUpgradeParams
): Promise<BaseAppUpgradeResult> {
  try {
    const { walletAddress, chainId, provider } = params;

    // Get latest implementation from factory
    const latestImpl = await getLatestBaseAppImplementation(provider, chainId);
    if (!latestImpl) {
      return {
        success: false,
        error: 'Could not fetch latest BaseApp implementation',
      };
    }

    // Get current implementation
    const currentImpl = await getBaseAppWalletImplementation(provider, walletAddress);
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
    console.error('BaseApp upgrade error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}
