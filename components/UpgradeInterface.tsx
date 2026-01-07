'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { upgradeSmartWallet, getImplementationAddress } from '@/lib/wallet-upgrade';
import { 
  upgradeBaseAppSmartWallet, 
  getLatestBaseAppImplementation,
  getBaseAppWalletImplementation,
  isBaseAppSmartWallet 
} from '@/lib/baseapp-upgrade';
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
  const [isBaseAppWallet, setIsBaseAppWallet] = useState(false);
  const [latestBaseAppImpl, setLatestBaseAppImpl] = useState<string | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [checkingWallet, setCheckingWallet] = useState(false);
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
        setIsBaseAppWallet(false);
        setLatestBaseAppImpl(null);
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
          
          // Check if it's a BaseApp wallet
          const isBaseApp = await isBaseAppSmartWallet(provider, address);
          setIsBaseAppWallet(isBaseApp);

          if (isBaseApp) {
            // Get latest implementation
            const latest = await getLatestBaseAppImplementation(provider, chainId);
            setLatestBaseAppImpl(latest);
            
            // Get current implementation
            const current = await getBaseAppWalletImplementation(provider, address);
            setCurrentImplementation(current);
            
            // Check if upgrade is needed
            if (latest && current && latest.toLowerCase() !== current.toLowerCase()) {
              setNeedsUpgrade(true);
              setNewImplementation(latest);
              setShowUpgradeDialog(true);
            } else if (latest && current && latest.toLowerCase() === current.toLowerCase()) {
              setNeedsUpgrade(false);
              setUpgradeStatus({
                type: 'success',
                message: 'Your wallet is already on the latest implementation!',
              });
            }
          } else {
            // For non-BaseApp wallets, try to get implementation using storage slot
            const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
            try {
              const storage = await publicClient.getStorageAt({
                address: address as `0x${string}`,
                slot: IMPLEMENTATION_SLOT as `0x${string}`,
              });

              if (storage && storage !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                const impl = '0x' + storage.slice(-40);
                setCurrentImplementation(impl);
              }
            } catch (error) {
              // Not an upgradeable wallet
              console.log('Wallet is not upgradeable');
            }
          }
        }
      } catch (error) {
        console.error('Error checking connected wallet:', error);
        setIsBaseAppWallet(false);
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
    if (!walletAddress || !isBaseAppWallet || !walletClient) {
      setUpgradeStatus({
        type: 'error',
        message: 'Please connect a BaseApp Smart Wallet',
      });
      return;
    }

    setLoading(true);
    setUpgradeStatus({ type: null, message: '' });

    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);

        const result = await upgradeBaseAppSmartWallet({
          walletAddress,
          chainId,
          provider,
        });

        if (result.success && result.txHash) {
          setUpgradeStatus({
            type: 'success',
            message: `BaseApp Smart Wallet upgraded successfully! New implementation: ${result.newImplementation?.slice(0, 10)}...`,
            txHash: result.txHash,
          });
          // Refresh implementation address
          setTimeout(() => {
            handleGetImplementation();
          }, 2000);
        } else {
          setUpgradeStatus({
            type: result.error?.includes('already') ? 'success' : 'error',
            message: result.error || 'Upgrade failed',
          });
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
      // If it's a BaseApp wallet, use BaseApp upgrade function
      if (isBaseAppWallet) {
        if (typeof window !== 'undefined' && window.ethereum) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const result = await upgradeBaseAppSmartWallet({
            walletAddress,
            chainId,
            provider,
          });

          if (result.success && result.txHash) {
            setUpgradeStatus({
              type: 'success',
              message: 'BaseApp Smart Wallet upgraded successfully!',
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
          {isBaseAppWallet && (
            <div className="mt-2 text-sm text-purple-400">
              ✓ BaseApp Smart Wallet detected
            </div>
          )}
        </div>
      )}

      {/* Upgrade Dialog (like BaseApp mobile dialog) */}
      {showUpgradeDialog && needsUpgrade && isBaseAppWallet && (
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

      {/* Current Implementation Display */}
      {currentImplementation && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="text-sm text-gray-300">
            <span className="font-semibold text-white">Current Implementation: </span>
            <span className="font-mono text-green-400 break-all">
              {currentImplementation}
            </span>
          </div>
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
