import { base, optimism, mainnet, arbitrum, polygon, bsc } from 'viem/chains';

export const supportedChains = [
  {
    id: mainnet.id,
    name: 'Ethereum Mainnet',
    shortName: 'Mainnet',
    icon: '🔷',
    chain: mainnet,
  },
  {
    id: base.id,
    name: 'Base',
    shortName: 'Base',
    icon: '🔵',
    chain: base,
  },
  {
    id: optimism.id,
    name: 'Optimism',
    shortName: 'OP',
    icon: '🔴',
    chain: optimism,
  },
  {
    id: arbitrum.id,
    name: 'Arbitrum',
    shortName: 'Arbitrum',
    icon: '🔵',
    chain: arbitrum,
  },
  {
    id: polygon.id,
    name: 'Polygon',
    shortName: 'Polygon',
    icon: '🟣',
    chain: polygon,
  },
  {
    id: bsc.id,
    name: 'BNB Chain',
    shortName: 'BNB',
    icon: '🟡',
    chain: bsc,
  },
];

export const getChainById = (chainId: number) => {
  return supportedChains.find((chain) => chain.id === chainId);
};
