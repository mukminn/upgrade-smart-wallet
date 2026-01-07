'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { upgradeSmartWallet, getImplementationAddress } from '@/lib/wallet-upgrade';
import { 
  upgradeBaseSponsoredSmartWallet, 
  getLatestBaseSponsoredImplementation,
  getBaseSponsoredWalletImplementation,
  isBaseSponsoredSmartWallet 
} from '@/lib/baseapp-upgrade';
import {
  upgradeBaseWallet,
  getBaseWalletVersion,
  supportsBaseUpgrade
} from '@/lib/base-wallet-upgrade';
import {
  detectImplementation,
  isContract
} from '@/lib/implementation-detector';
import { getChainById } from '@/lib/chains';
import { ArrowUpCircle, Loader2, CheckCircle, XCircle, Info, Zap } from 'lucide-react';

interface UpgradeInterfaceProps {
  chainId: number;
}

export function UpgradeInterface({ chainId }: UpgradeInterfaceProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });
  
  const [walletAddress, setWalletAddress] = useState('');
  const [newImplementation, setNewImplementation] = useState('');
  const [currentImplementation, setCurrentImplementation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isBaseSponsoredWallet, setIsBaseSponsoredWallet] = useState(false);
  const [latestBaseSponsoredImpl, setLatestBaseSponsoredImpl] = useState<string | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [checkingWallet, setCheckingWallet] = useState(false);
  const [upgradedChains, setUpgradedChains] = useState<Set<number>>(new Set());
  const [upgradeStatus, setUpgradeStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    txHash?: string;
  }>({ type: null, message: '' });

  const chain = getChainById(chainId);

  // Auto-detect connected wallet and check if upgrade is needed
  useEffect(() => {
    const checkConnectedWallet = async () => {
      if (!isConnected || !address || !publicClient) {
        setWalletAddress('');
        setIsBaseSponsoredWallet(false);
        setLatestBaseSponsoredImpl(null);
        setCurrentImplementation(null);
        setNeedsUpgrade(false);
        setShowUpgradeDialog(false);
        return;
      }

      // Auto-use connected wallet address
      setWalletAddress(address);
      setCheckingWallet(true);

      try {
        if (typeof window !== 'undefined' && window.ethereum) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          
          // Check if it's a Base Sponsored wallet
          const isBaseSponsored = await isBaseSponsoredSmartWallet(provider, address, chainId);
          setIsBaseSponsoredWallet(isBaseSponsored);

          if (isBaseSponsored) {
            // Get latest Base-sponsored implementation
            const latest = await getLatestBaseSponsoredImplementation(provider, chainId);
            setLatestBaseSponsoredImpl(latest);
            
            // Always try to get current implementation for Base-sponsored wallets
            let current: string | null = null;
            try {
              // Try Coinbase Smart Wallet method first
              current = await getBaseSponsoredWalletImplementation(provider, address);
            } catch {
              // Fallback to storage slot method
              try {
                const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
                const storage = await publicClient.getStorageAt({
                  address: address as `0x${string}`,
                  slot: IMPLEMENTATION_SLOT as `0x${string}`,
                });
                if (storage && storage !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                  current = '0x' + storage.slice(-40);
                }
              } catch {
                // If both methods fail, current stays null
              }
            }
            
            // Set implementation if found
            if (current) {
              setCurrentImplementation(current);
              // Mark chain as having implementation (even if not upgraded yet)
              setUpgradedChains(prev => new Set([...prev, chainId]));
            }
            
            // Check if upgrade is needed
            if (latest && current) {
              if (latest.toLowerCase() !== current.toLowerCase()) {
                setNeedsUpgrade(true);
                setNewImplementation(latest);
              } else {
                setNeedsUpgrade(false);
              }
            } else if (latest && !current) {
              // Have latest but no current - upgrade available
              setNeedsUpgrade(true);
              setNewImplementation(latest);
            }
          } else {
            // Not a Base-sponsored wallet - try comprehensive detection
            try {
              const detectionResult = await detectImplementation(provider, publicClient, address);
              
              if (detectionResult.implementation) {
                setCurrentImplementation(detectionResult.implementation);
                setUpgradedChains(prev => new Set([...prev, chainId]));
              } else {
                setCurrentImplementation(null);
              }
            } catch (error) {
              console.error('Error detecting implementation:', error);
              setCurrentImplementation(null);
            }
            setIsBaseSponsoredWallet(false);
          }
        }
      } catch (error) {
        console.error('Error checking connected wallet:', error);
        setIsBaseSponsoredWallet(false);
      } finally {
        setCheckingWallet(false);
      }
    };

    checkConnectedWallet();
  }, [isConnected, address, chainId, publicClient]);

  const handleGetImplementation = async () => {
    if (!walletAddress || !publicClient) return;

    setLoading(true);
    setUpgradeStatus({ type: null, message: '' });

    try {
      // Use viem to get storage slot
      const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
      
      const storage = await publicClient.getStorageAt({
        address: walletAddress as `0x${string}`,
        slot: IMPLEMENTATION_SLOT as `0x${string}`,
      });

      if (storage && storage !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        const impl = '0x' + storage.slice(-40);
        setCurrentImplementation(impl);
        setUpgradeStatus({
          type: 'success',
          message: `Current implementation: ${impl}`,
        });
      } else {
        setCurrentImplementation(null);
        setUpgradeStatus({
          type: 'error',
          message: 'Could not find implementation address. This may not be an upgradeable contract.',
        });
      }
    } catch (error: any) {
      setUpgradeStatus({
        type: 'error',
        message: error.message || 'Failed to get implementation address',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAutoUpgrade = async () => {
    if (!walletAddress || !isBaseSponsoredWallet) {
      setUpgradeStatus({
        type: 'error',
        message: 'Please connect a Base Sponsored Smart Wallet',
      });
      return;
    }

    setLoading(true);
    setUpgradeStatus({ type: null, message: '' });

    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        // First, try official Base wallet_upgrade method
        const supportsBase = await supportsBaseUpgrade(window.ethereum);
        
        if (supportsBase) {
          // Use official Base method (recommended)
          const result = await upgradeBaseWallet({
            walletAddress,
            provider: window.ethereum,
          });

          if (result.success && result.txHash) {
            // Mark this chain as upgraded
            setUpgradedChains(prev => new Set([...prev, chainId]));
            
            // Get updated implementation
            const provider = new ethers.BrowserProvider(window.ethereum);
            const current = await getBaseSponsoredWalletImplementation(provider, walletAddress);
            if (current) {
              setCurrentImplementation(current);
            }
            
            setUpgradeStatus({
              type: 'success',
              message: `Base Sponsored Smart Wallet upgraded successfully on ${chain?.name}!`,
              txHash: result.txHash,
            });
            setNeedsUpgrade(false);
          } else {
            setUpgradeStatus({
              type: 'error',
              message: result.error || 'Upgrade failed',
            });
          }
        } else {
          // Fallback to direct contract upgrade if official method not available
          const provider = new ethers.BrowserProvider(window.ethereum);
          const result = await upgradeBaseSponsoredSmartWallet({
            walletAddress,
            chainId,
            provider,
          });

          if (result.success && result.txHash) {
            setUpgradedChains(prev => new Set([...prev, chainId]));
            
            if (result.newImplementation) {
              setCurrentImplementation(result.newImplementation);
              setNeedsUpgrade(false);
            }
            setUpgradeStatus({
              type: 'success',
              message: `Base Sponsored Smart Wallet upgraded successfully on ${chain?.name}!`,
              txHash: result.txHash,
            });
          } else {
            setUpgradeStatus({
              type: result.error?.includes('already') ? 'success' : 'error',
              message: result.error || 'Upgrade failed',
            });
          }
        }
      } else {
        throw new Error('Wallet not connected');
      }
    } catch (error: any) {
      setUpgradeStatus({
        type: 'error',
        message: error.message || 'Upgrade failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!walletAddress || !newImplementation || !walletClient) {
      setUpgradeStatus({
        type: 'error',
        message: 'Please fill in all required fields',
      });
      return;
    }

    setLoading(true);
    setUpgradeStatus({ type: null, message: '' });

    try {
      // If it's a Base Sponsored wallet, use Base Sponsored upgrade function
      if (isBaseSponsoredWallet) {
        if (typeof window !== 'undefined' && window.ethereum) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const result = await upgradeBaseSponsoredSmartWallet({
            walletAddress,
            chainId,
            provider,
          });

          if (result.success && result.txHash) {
            setUpgradedChains(prev => new Set([...prev, chainId]));
            if (result.newImplementation) {
              setCurrentImplementation(result.newImplementation);
            }
            setUpgradeStatus({
              type: 'success',
              message: 'Base Sponsored Smart Wallet upgraded successfully!',
              txHash: result.txHash,
            });
            setTimeout(() => {
              handleGetImplementation();
            }, 2000);
          } else {
            setUpgradeStatus({
              type: 'error',
              message: result.error || 'Upgrade failed',
            });
          }
        }
      } else {
        // Use generic upgrade for non-BaseApp wallets
        if (typeof window !== 'undefined' && window.ethereum) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();

          const result = await upgradeSmartWallet(provider, {
            walletAddress,
            newImplementation,
            chainId,
          });

          if (result.success && result.txHash) {
            setUpgradeStatus({
              type: 'success',
              message: 'Upgrade transaction submitted successfully!',
              txHash: result.txHash,
            });
            setTimeout(() => {
              handleGetImplementation();
            }, 2000);
          } else {
            setUpgradeStatus({
              type: 'error',
              message: result.error || 'Upgrade failed',
            });
          }
        } else {
          throw new Error('Wallet not connected');
        }
      }
    } catch (error: any) {
      setUpgradeStatus({
        type: 'error',
        message: error.message || 'Upgrade failed',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle upgrade from dialog
  const handleDialogUpgrade = async () => {
    setShowUpgradeDialog(false);
    await handleAutoUpgrade();
  };

  return (
    <div className="space-y-6">
      {/* Checking Wallet Status */}
      {checkingWallet && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <span className="text-white">Checking your connected wallet...</span>
        </div>
      )}

      {/* Connected Wallet Info */}
      {isConnected && address && !checkingWallet && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-white font-semibold">Connected Wallet</span>
          </div>
          <div className="text-sm text-gray-300 font-mono break-all">
            {address}
          </div>
          {isBaseSponsoredWallet && (
            <div className="mt-2 text-sm text-purple-400">
              ✓ Base Sponsored Smart Wallet detected
            </div>
          )}
          
          {/* Upgrade Button - Always Visible for Base Sponsored */}
          {isBaseSponsoredWallet && needsUpgrade && latestBaseSponsoredImpl && (
            <div className="mt-4 pt-4 border-t border-green-500/20">
              <button
                onClick={handleAutoUpgrade}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-3 text-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Signing & Upgrading Wallet...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpCircle className="w-6 h-6" />
                    <span>Sign & Upgrade Wallet Now</span>
                  </>
                )}
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">
                Network fees sponsored by Base
              </p>
            </div>
          )}
          
          {/* Already Up to Date */}
          {isBaseSponsoredWallet && !needsUpgrade && upgradedChains.has(chainId) && currentImplementation && (
            <div className="mt-4 pt-4 border-t border-green-500/20">
              <div className="bg-green-500/20 border border-green-500/40 rounded-lg p-3 text-center">
                <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 font-medium">Your wallet is up to date!</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upgrade Dialog (like BaseApp mobile dialog) */}
      {showUpgradeDialog && needsUpgrade && isBaseSponsoredWallet && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in">
            {/* Upgrade Graphic */}
            <div className="flex justify-center mb-6">
              <div className="relative w-32 h-32">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-16 h-16 bg-blue-400 rounded-full"></div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-16 h-16 bg-yellow-400 rounded-full"></div>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <ArrowUpCircle className="w-8 h-8 text-gray-800" />
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Upgrade your wallet on {chain?.name || 'this network'}
            </h2>

            {/* Description */}
            <p className="text-gray-600 text-center mb-6">
              We'll need to set you up to transact on {chain?.name || 'this network'}. We'll sponsor the network fees.
            </p>

            {/* Network Fee Info */}
            <div className="flex justify-between items-center mb-6 p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-700 font-medium">Network fee</span>
              <span className="text-green-600 font-semibold">Sponsored by Base</span>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowUpgradeDialog(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDialogUpgrade}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Upgrading...
                  </>
                ) : (
                  'Upgrade now'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Input (Hidden if wallet is connected) */}
      {!isConnected && (
        <>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-300">
              <p className="font-semibold text-white mb-1">Connect Your Wallet</p>
              <p className="text-gray-400">Connect your wallet to automatically detect and upgrade your smart wallet.</p>
            </div>
          </div>

          <div>
            <label className="block text-white font-medium mb-2">
              Smart Wallet Address (Manual)
            </label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleGetImplementation}
              disabled={loading || !walletAddress}
              className="mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking...
                </span>
              ) : (
                'Get Current Implementation'
              )}
            </button>
          </div>
        </>
      )}

      {/* Main Upgrade Button - Always Visible When Connected */}
      {isConnected && address && !checkingWallet && (
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-2 border-blue-500/50 rounded-xl p-6">
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold text-white mb-2">
              {isBaseSponsoredWallet && needsUpgrade ? (
                <>⚡ Upgrade Available (Sponsored by Base)</>
              ) : isBaseSponsoredWallet && upgradedChains.has(chainId) ? (
                <>✓ Wallet Up to Date</>
              ) : isBaseSponsoredWallet ? (
                <>🔧 Upgrade Available (Sponsored by Base)</>
              ) : (
                <>⚠️ Not a Base Sponsored Wallet</>
              )}
            </h3>
            <p className="text-gray-300 text-sm">
              {isBaseSponsoredWallet && needsUpgrade
                ? `Upgrade your wallet to the latest Base-sponsored implementation on ${chain?.name}`
                : isBaseSponsoredWallet && upgradedChains.has(chainId)
                ? 'Your wallet is already on the latest version'
                : isBaseSponsoredWallet
                ? `Upgrade available on ${chain?.name} - Network fees sponsored by Base`
                : 'This wallet is not a Base Sponsored Smart Wallet'}
            </p>
          </div>
          
          {isBaseSponsoredWallet && !needsUpgrade && upgradedChains.has(chainId) ? (
            <div className="bg-green-500/20 border border-green-500/40 rounded-xl p-4 text-center">
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-green-400 font-semibold">No upgrade needed</p>
            </div>
          ) : (
            <button
              onClick={async () => {
                if (isBaseSponsoredWallet) {
                  // Base Sponsored wallet - use auto upgrade
                  await handleAutoUpgrade();
                } else {
                  // For non-BaseApp wallets, first get current implementation
                  if (address && publicClient) {
                    setLoading(true);
                    try {
                        // Use comprehensive detection
                        if (typeof window !== 'undefined' && window.ethereum) {
                          const provider = new ethers.BrowserProvider(window.ethereum);
                          
                          // Check if it's a contract first
                          const isContractAddress = await isContract(provider, address);
                          if (!isContractAddress) {
                            setUpgradeStatus({
                              type: 'error',
                              message: 'This address is not a contract. It appears to be an EOA (Externally Owned Account). Only smart contract wallets can be upgraded.',
                            });
                            setLoading(false);
                            return;
                          }
                          
                          // Try comprehensive detection
                          const detectionResult = await detectImplementation(provider, publicClient, address);
                          
                          if (detectionResult.implementation) {
                            setCurrentImplementation(detectionResult.implementation);
                            setUpgradedChains(prev => new Set([...prev, chainId]));
                            
                            // If we have new implementation, proceed with upgrade
                            if (newImplementation) {
                              await handleUpgrade();
                            } else {
                              setUpgradeStatus({
                                type: 'error',
                                message: `Please provide new implementation address. Current implementation: ${detectionResult.implementation} (detected via ${detectionResult.method})`,
                              });
                            }
                          } else {
                            setUpgradeStatus({
                              type: 'error',
                              message: `This wallet does not appear to be an upgradeable contract. Tried multiple detection methods but no implementation address found. The address is a contract but may not use standard upgradeable patterns (UUPS, Transparent Proxy, or EIP-1967).`,
                            });
                          }
                        }
                    } catch (error: any) {
                      setUpgradeStatus({
                        type: 'error',
                        message: error.message || 'Could not check wallet implementation. Please ensure this is an upgradeable wallet.',
                      });
                    } finally {
                      setLoading(false);
                    }
                  }
                }
              }}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold py-5 px-8 rounded-xl shadow-2xl transition-all duration-200 flex items-center justify-center gap-3 text-lg transform hover:scale-105"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Signing Transaction...</span>
                </>
              ) : (
                <>
                  <ArrowUpCircle className="w-6 h-6" />
                  <span>Sign & Upgrade Wallet</span>
                  <Zap className="w-5 h-5" />
                </>
              )}
            </button>
          )}
          
          {isBaseSponsoredWallet && needsUpgrade && (
            <p className="text-center text-xs text-gray-400 mt-3">
              💰 Network fees sponsored by Base
            </p>
          )}
        </div>
      )}

      {/* Implementation Address Display - Show for Any Wallet with Implementation */}
      {isConnected && currentImplementation && (
        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border-2 border-green-500/30 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-bold text-white">
              {isBaseSponsoredWallet 
                ? `Base Sponsored Implementation (${chain?.name})`
                : `Smart Wallet Implementation (${chain?.name})`}
            </h3>
          </div>
          
          <div className="bg-gray-900/50 rounded-lg p-4 mb-3">
            <div className="text-xs text-gray-400 mb-2">Current Implementation Address</div>
            <div className="text-base font-mono text-green-400 break-all font-semibold leading-relaxed">
              {currentImplementation}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentImplementation);
                  setUpgradeStatus({
                    type: 'success',
                    message: 'Implementation address copied to clipboard!',
                  });
                }}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition-colors"
              >
                📋 Copy Full Address
              </button>
              {chain?.chain.blockExplorers?.default && (
                <a
                  href={`${chain.chain.blockExplorers.default.url}/address/${currentImplementation}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded transition-colors"
                >
                  🔍 View on Explorer
                </a>
              )}
            </div>
          </div>
          
          {isBaseSponsoredWallet && latestBaseSponsoredImpl && (
            <>
              {latestBaseSponsoredImpl.toLowerCase() !== currentImplementation.toLowerCase() && (
                <div className="bg-gray-900/50 rounded-lg p-4 mb-3">
                  <div className="text-xs text-gray-400 mb-2">Latest Available Implementation (Base Sponsored)</div>
                  <div className="text-base font-mono text-blue-400 break-all font-semibold leading-relaxed">
                    {latestBaseSponsoredImpl}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(latestBaseSponsoredImpl);
                        setUpgradeStatus({
                          type: 'success',
                          message: 'Latest implementation address copied!',
                        });
                      }}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition-colors"
                    >
                      📋 Copy Address
                    </button>
                  </div>
                  <div className="text-xs text-yellow-400 mt-2">
                    ⚠️ Upgrade available to latest version
                  </div>
                </div>
              )}
              
              {latestBaseSponsoredImpl.toLowerCase() === currentImplementation.toLowerCase() && (
                <div className="bg-green-500/20 border border-green-500/40 rounded-lg p-3 text-center">
                  <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
                  <p className="text-green-400 text-sm font-medium">✓ Wallet is on the latest Base-sponsored implementation</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* New Implementation Input (Only for manual mode) */}
      {!isConnected && (
        <div>
          <label className="block text-white font-medium mb-2">
            New Implementation Address
          </label>
          <input
            type="text"
            value={newImplementation}
            onChange={(e) => setNewImplementation(e.target.value)}
            placeholder="0x..."
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Manual Upgrade Button (Only for manual mode) */}
      {!isConnected && walletAddress && newImplementation && (
        <button
          onClick={handleUpgrade}
          disabled={loading || !walletAddress || !newImplementation}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing Upgrade...
            </>
          ) : (
            <>
              <ArrowUpCircle className="w-5 h-5" />
              Upgrade Smart Wallet
            </>
          )}
        </button>
      )}

      {/* Status Message */}
      {upgradeStatus.message && (
        <div
          className={`rounded-lg p-4 flex items-start gap-3 ${
            upgradeStatus.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20'
              : 'bg-red-500/10 border border-red-500/20'
          }`}
        >
          {upgradeStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p
              className={`font-medium ${
                upgradeStatus.type === 'success' ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {upgradeStatus.message}
            </p>
            {upgradeStatus.txHash && chain && (
              <a
                href={`${chain.chain.blockExplorers?.default?.url}/tx/${upgradeStatus.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block break-all"
              >
                View on {chain.chain.blockExplorers?.default?.name || 'Explorer'}: {upgradeStatus.txHash}
              </a>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
