'use client';

import { useState } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { UpgradeInterface } from '@/components/UpgradeInterface';
import { ChainSelector } from '@/components/ChainSelector';
import { WalletConnect } from '@/components/WalletConnect';
import { supportedChains } from '@/lib/chains';
import { Wallet, Network } from 'lucide-react';

export default function Home() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [selectedChainId, setSelectedChainId] = useState(chainId || 1);

  const handleChainChange = (newChainId: number) => {
    setSelectedChainId(newChainId);
    if (isConnected) {
      switchChain({ chainId: newChainId });
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 flex items-center justify-center gap-3">
            <Wallet className="w-12 h-12" />
            Smart Wallet Upgrader
          </h1>
          <p className="text-xl text-gray-300">
            Upgrade your smart wallets across multiple blockchain networks
          </p>
        </div>

        {/* Main Card */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
            {/* Wallet Connection Section */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Network className="w-5 h-5 text-blue-400" />
                <h2 className="text-2xl font-semibold text-white">
                  Wallet Connection
                </h2>
              </div>
              <WalletConnect />
            </div>

            {isConnected && (
              <>
                {/* Chain Selector */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Network className="w-5 h-5 text-blue-400" />
                    <h2 className="text-2xl font-semibold text-white">
                      Select Network
                    </h2>
                  </div>
                  <ChainSelector
                    selectedChainId={selectedChainId}
                    onChainChange={handleChainChange}
                  />
                </div>

                {/* Upgrade Interface */}
                <div>
                  <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-blue-400" />
                    Upgrade Smart Wallet
                  </h2>
                  <UpgradeInterface chainId={selectedChainId} />
                </div>
              </>
            )}

            {!isConnected && (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">
                  Please connect your wallet to get started
                </p>
              </div>
            )}
          </div>

          {/* Supported Chains Info */}
          <div className="mt-8 bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">
              Supported Networks
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {supportedChains.map((chain) => (
                <div
                  key={chain.id}
                  className="bg-white/5 rounded-lg p-3 text-center border border-white/10 hover:border-blue-400/50 transition-colors"
                >
                  <div className="text-2xl mb-1">{chain.icon}</div>
                  <div className="text-sm text-gray-300 font-medium">
                    {chain.shortName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
