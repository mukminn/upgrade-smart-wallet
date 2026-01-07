'use client';

import { supportedChains } from '@/lib/chains';
import { Check } from 'lucide-react';

interface ChainSelectorProps {
  selectedChainId: number;
  onChainChange: (chainId: number) => void;
}

export function ChainSelector({ selectedChainId, onChainChange }: ChainSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {supportedChains.map((chain) => {
        const isSelected = chain.id === selectedChainId;
        return (
          <button
            key={chain.id}
            onClick={() => onChainChange(chain.id)}
            className={`
              relative p-4 rounded-xl border-2 transition-all duration-200
              ${
                isSelected
                  ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/20'
                  : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
              }
            `}
          >
            {isSelected && (
              <div className="absolute top-2 right-2">
                <Check className="w-5 h-5 text-blue-400" />
              </div>
            )}
            <div className="text-3xl mb-2">{chain.icon}</div>
            <div className="text-white font-semibold text-lg">{chain.name}</div>
            <div className="text-gray-400 text-sm mt-1">Chain ID: {chain.id}</div>
          </button>
        );
      })}
    </div>
  );
}
