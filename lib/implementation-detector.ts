import { ethers } from 'ethers';

/**
 * Comprehensive implementation address detector
 * Tries multiple methods to find implementation address for upgradeable contracts
 */

export interface ImplementationDetectionResult {
  implementation: string | null;
  method: string;
  isUpgradeable: boolean;
}

// EIP-1967 Storage Slots
const EIP1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const EIP1967_BEACON_SLOT = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
const EIP1967_ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';

// Common upgradeable contract ABIs
const UUPS_ABI = [
  'function implementation() external view returns (address)',
  'function upgradeTo(address newImplementation) external',
  'function upgradeToAndCall(address newImplementation, bytes memory data) external payable',
];

const PROXY_ABI = [
  'function implementation() external view returns (address)',
];

const TRANSPARENT_PROXY_ABI = [
  'function implementation() external view returns (address)',
  'function admin() external view returns (address)',
];

/**
 * Check if address is a contract (has code)
 */
export async function isContract(
  provider: ethers.BrowserProvider,
  address: string
): Promise<boolean> {
  try {
    const code = await provider.getCode(address);
    return code !== '0x' && code !== '0x0';
  } catch {
    return false;
  }
}

/**
 * Get implementation from storage slot (EIP-1967)
 */
export async function getImplementationFromStorageSlot(
  publicClient: any,
  address: string,
  slot: string
): Promise<string | null> {
  try {
    const storage = await publicClient.getStorageAt({
      address: address as `0x${string}`,
      slot: slot as `0x${string}`,
    });

    if (storage && storage !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const impl = '0x' + storage.slice(-40);
      // Validate it's a valid address
      if (ethers.isAddress(impl)) {
        return impl;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get implementation by calling contract function
 */
export async function getImplementationFromFunction(
  provider: ethers.BrowserProvider,
  address: string,
  abi: string[]
): Promise<string | null> {
  try {
    const contract = new ethers.Contract(address, abi, provider);
    const implementation = await contract.implementation();
    if (implementation && ethers.isAddress(implementation)) {
      return implementation;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Comprehensive implementation detection
 * Tries multiple methods to find implementation address
 */
export async function detectImplementation(
  provider: ethers.BrowserProvider,
  publicClient: any,
  address: string
): Promise<ImplementationDetectionResult> {
  // First check if it's a contract
  const isContractAddress = await isContract(provider, address);
  if (!isContractAddress) {
    return {
      implementation: null,
      method: 'not_a_contract',
      isUpgradeable: false,
    };
  }

  // Method 1: Try UUPS implementation() function
  try {
    const impl = await getImplementationFromFunction(provider, address, UUPS_ABI);
    if (impl) {
      return {
        implementation: impl,
        method: 'uups_implementation_function',
        isUpgradeable: true,
      };
    }
  } catch {
    // Continue to next method
  }

  // Method 2: Try Proxy implementation() function
  try {
    const impl = await getImplementationFromFunction(provider, address, PROXY_ABI);
    if (impl) {
      return {
        implementation: impl,
        method: 'proxy_implementation_function',
        isUpgradeable: true,
      };
    }
  } catch {
    // Continue to next method
  }

  // Method 3: Try EIP-1967 implementation storage slot
  try {
    const impl = await getImplementationFromStorageSlot(publicClient, address, EIP1967_IMPLEMENTATION_SLOT);
    if (impl) {
      return {
        implementation: impl,
        method: 'eip1967_storage_slot',
        isUpgradeable: true,
      };
    }
  } catch {
    // Continue to next method
  }

  // Method 4: Try EIP-1967 beacon slot
  try {
    const impl = await getImplementationFromStorageSlot(publicClient, address, EIP1967_BEACON_SLOT);
    if (impl) {
      return {
        implementation: impl,
        method: 'eip1967_beacon_slot',
        isUpgradeable: true,
      };
    }
  } catch {
    // Continue
  }

  // Method 5: Try Transparent Proxy ABI
  try {
    const impl = await getImplementationFromFunction(provider, address, TRANSPARENT_PROXY_ABI);
    if (impl) {
      return {
        implementation: impl,
        method: 'transparent_proxy_function',
        isUpgradeable: true,
      };
    }
  } catch {
    // Continue
  }

  // All methods failed
  return {
    implementation: null,
    method: 'not_detected',
    isUpgradeable: false,
  };
}
