# Smart Wallet Upgrader

A modern web application for upgrading smart wallets across multiple blockchain networks including Base, Optimism, Ethereum Mainnet, Arbitrum, Polygon, and BNB Chain.

## Features

- 🔗 **Multi-Chain Support**: Upgrade smart wallets on 6 different blockchain networks
- 🔐 **Wallet Integration**: Connect using MetaMask, WalletConnect, and other popular wallets via RainbowKit
- 🎨 **Modern UI**: Beautiful, responsive interface with dark theme
- ✅ **Safe Upgrades**: Verify current implementation before upgrading
- 📊 **Transaction Tracking**: View upgrade transactions on block explorers

## Supported Networks

- 🔷 Ethereum Mainnet
- 🔵 Base
- 🔴 Optimism
- 🔵 Arbitrum
- 🟣 Polygon
- 🟡 BNB Chain

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A WalletConnect Project ID (get one from [cloud.walletconnect.com](https://cloud.walletconnect.com))

### Installation

1. Install dependencies:
```bash
npm install
```

2. The WalletConnect Project ID is already configured in `app/providers.tsx`. You can also set it via environment variable:
```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Connect Wallet**: Click "Connect Wallet" and select your preferred wallet
2. **Select Network**: Choose the blockchain network you want to upgrade on
3. **Enter Wallet Address**: Input the smart wallet (proxy) address
4. **Check Implementation**: Click "Get Current Implementation" to verify the current implementation address
5. **Enter New Implementation**: Input the new implementation contract address
6. **Upgrade**: Click "Upgrade Smart Wallet" and confirm the transaction in your wallet

## Important Notes

⚠️ **Security Warnings:**
- Always verify the new implementation address before upgrading
- Test upgrades on testnets first
- Ensure you have the necessary permissions to upgrade the contract
- Double-check all addresses before submitting transactions

## Customization

The upgrade function in `lib/wallet-upgrade.ts` uses a standard proxy upgrade pattern. You may need to modify it based on your specific smart wallet implementation:

- If your contract uses `upgradeToAndCall`, modify the upgrade function
- Adjust the ABI if your contract has a different upgrade interface
- Add additional validation or checks as needed

## Technology Stack

- **Next.js 14**: React framework
- **TypeScript**: Type safety
- **Wagmi**: React Hooks for Ethereum
- **RainbowKit**: Wallet connection UI
- **Viem**: Ethereum library
- **Ethers.js**: Blockchain interactions
- **Tailwind CSS**: Styling

## License

MIT
