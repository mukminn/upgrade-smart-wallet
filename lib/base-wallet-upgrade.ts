/**
 * Base Wallet Upgrade - Official Method
 * Based on: https://help.coinbase.com/en/base/getting-started/upgrade-wallet
 * 
 * This uses the official Base wallet upgrade method via provider.request
 */

export interface BaseWalletUpgradeParams {
  walletAddress: string;
  provider: any; // EIP-1193 provider
}

export interface BaseWalletUpgradeResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Get wallet version using official Base method
 */
export async function getBaseWalletVersion(
  provider: any,
  walletAddress: string
): Promise<string | null> {
  try {
    if (!provider || !provider.request) {
      throw new Error('Provider does not support request method');
    }

    const version = await provider.request({
      method: 'wallet_getVersion',
      params: [walletAddress],
    });

    return version;
  } catch (error: any) {
    console.error('Error getting wallet version:', error);
    return null;
  }
}

/**
 * Upgrade Base wallet using official method
 * This is the correct way to upgrade Base-sponsored smart wallets
 */
export async function upgradeBaseWallet(
  params: BaseWalletUpgradeParams
): Promise<BaseWalletUpgradeResult> {
  try {
    const { walletAddress, provider } = params;

    if (!provider || !provider.request) {
      return {
        success: false,
        error: 'Provider does not support request method. Please use a Base-compatible wallet.',
      };
    }

    // Use official Base wallet_upgrade method
    // This method is sponsored by Base and handles the upgrade automatically
    const result = await provider.request({
      method: 'wallet_upgrade',
      params: [walletAddress],
    });

    // The result should contain transaction hash
    if (result && result.txHash) {
      return {
        success: true,
        txHash: result.txHash,
      };
    }

    // If result is just a transaction hash string
    if (typeof result === 'string' && result.startsWith('0x')) {
      return {
        success: true,
        txHash: result,
      };
    }

    return {
      success: true,
      txHash: result,
    };
  } catch (error: any) {
    console.error('Base wallet upgrade error:', error);
    return {
      success: false,
      error: error.message || 'Failed to upgrade wallet. Please ensure you are using a Base-sponsored smart wallet.',
    };
  }
}

/**
 * Check if wallet supports Base upgrade methods
 */
export async function supportsBaseUpgrade(provider: any): Promise<boolean> {
  try {
    if (!provider || !provider.request) {
      return false;
    }

    // Check if provider supports wallet_upgrade method
    const methods = await provider.request({
      method: 'wallet_getCapabilities',
    });

    return methods?.wallet_upgrade === true || provider.isBaseWallet === true;
  } catch {
    // If wallet_getCapabilities fails, try to detect Base wallet
    return provider.isBaseWallet === true || provider.isCoinbaseWallet === true;
  }
}
