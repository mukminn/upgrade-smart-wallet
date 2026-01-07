'use client';

import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { upgradeSmartWallet, getImplementationAddress } from '@/lib/wallet-upgrade';
import { getChainById } from '@/lib/chains';
import { ArrowUpCircle, Loader2, CheckCircle, XCircle, Info } from 'lucide-react';

interface UpgradeInterfaceProps {
  chainId: number;
}

export function UpgradeInterface({ chainId }: UpgradeInterfaceProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });
  
  const [walletAddress, setWalletAddress] = useState('');
  const [newImplementation, setNewImplementation] = useState('');
  const [currentImplementation, setCurrentImplementation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [upgradeStatus, setUpgradeStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    txHash?: string;
  }>({ type: null, message: '' });

  const chain = getChainById(chainId);

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
      // Create ethers provider from wallet client
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
          // Refresh implementation address
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
    } catch (error: any) {
      setUpgradeStatus({
        type: 'error',
        message: error.message || 'Upgrade failed',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-gray-300">
          <p className="font-semibold text-white mb-1">Important Notes:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Ensure the wallet address is a proxy contract (upgradeable)</li>
            <li>Verify the new implementation address is correct and deployed</li>
            <li>Make sure you have the necessary permissions to upgrade</li>
            <li>Always test on testnets first</li>
          </ul>
        </div>
      </div>

      {/* Wallet Address Input */}
      <div>
        <label className="block text-white font-medium mb-2">
          Smart Wallet Address
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

      {/* New Implementation Input */}
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

      {/* Upgrade Button */}
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
    </div>
  );
}
