# Tkoin Solana Token-2022 Deployment

This directory contains scripts and utilities for deploying and managing the Tkoin Token-2022 on Solana.

## Overview

Tkoin uses Solana's Token-2022 standard with the **Transfer Fee Extension** to implement a 2% burn mechanism on all deposits to the treasury wallet.

### Token Specifications

- **Standard**: Token-2022 (SPL Token v2)
- **Max Supply**: 100,000,000 TKOIN
- **Decimals**: 8
- **Transfer Fee**: 2% (200 basis points)
- **Burn Mechanism**: Automatic on treasury deposits via transfer fee
- **Mint Authority**: Treasury wallet (can mint new tokens up to max supply)
- **Freeze Authority**: None (tokens cannot be frozen)

## Directory Structure

```
solana/
├── scripts/
│   ├── 01-generate-treasury-wallet.ts  # Generate treasury wallet
│   ├── 02-deploy-token.ts              # Deploy Token-2022
│   └── 03-mint-initial-supply.ts       # (Optional) Mint tokens
├── utils/
│   ├── wallet.ts                        # Wallet utilities
│   └── token.ts                         # Token utilities
├── wallets/                             # ⚠️ Git-ignored wallet files
│   └── treasury-wallet.json             # Generated treasury wallet
├── deployment.json                      # Deployment information
└── README.md                            # This file
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

Required packages:
- `@solana/web3.js` - Solana JavaScript SDK
- `@solana/spl-token` - SPL Token library with Token-2022 support

### 2. Configure Environment

Create a `.env` file or add these variables:

```bash
# Solana Network
SOLANA_RPC_URL=https://api.devnet.solana.com  # or mainnet-beta

# These will be generated in next steps
SOLANA_TREASURY_WALLET=<generated-public-key>
SOLANA_TREASURY_PRIVATE_KEY=<generated-secret-key-array>
TKOIN_MINT_ADDRESS=<deployed-token-mint-address>
```

### 3. Generate Treasury Wallet

```bash
tsx solana/scripts/01-generate-treasury-wallet.ts
```

This creates a new Solana wallet that will:
- Receive all user deposits
- Hold mint authority for Tkoin
- Pay transaction fees for minting

**⚠️ CRITICAL SECURITY:**
- Back up the generated wallet file immediately
- Store private key in secure password manager
- Never commit wallet files to git (already in .gitignore)
- Consider using a hardware wallet for production

The script outputs wallet information and .env configuration. **Copy the private key array to your secrets management system.**

### 4. Fund the Wallet

The treasury wallet needs SOL for transaction fees.

**Devnet:**
```bash
solana airdrop 2 <WALLET_ADDRESS> --url devnet
```

**Mainnet:**
Transfer SOL from an exchange or another wallet. Recommended: 0.5-1 SOL for deployment and initial operations.

### 5. Deploy Token

```bash
tsx solana/scripts/02-deploy-token.ts
```

This script:
1. Connects to Solana network (devnet or mainnet)
2. Creates Token-2022 mint with transfer fee extension
3. Configures 2% transfer fee (burn mechanism)
4. Sets treasury wallet as mint authority
5. Saves deployment info to `deployment.json`

**Expected Output:**
```
✅ Token Deployed Successfully!

📋 Deployment Summary:
   Mint Address: <MINT_ADDRESS>
   Treasury Wallet: <TREASURY_WALLET>
   Network: <RPC_URL>
```

**Copy the mint address to your .env file as `TKOIN_MINT_ADDRESS`.**

### 6. Verify Deployment

Visit Solana Explorer to verify your token:

**Devnet:**
```
https://explorer.solana.com/address/<MINT_ADDRESS>?cluster=devnet
```

**Mainnet:**
```
https://explorer.solana.com/address/<MINT_ADDRESS>
```

Check for:
- ✅ Token-2022 Program (not legacy SPL Token)
- ✅ Transfer fee configured (2%)
- ✅ Correct decimals (8)
- ✅ Mint authority set to treasury wallet

## Token Operations

### Minting Tokens

Agents mint new Tkoin when users purchase. This is done via the backend API, which calls:

```typescript
import { mintTokens } from './utils/token';

const signature = await mintTokens(
  connection,
  payer,
  mintAddress,
  agentTokenAccount,
  treasuryWallet,
  amount * 10**8, // Convert to base units
);
```

### Transfer Fee (Burn Mechanism)

When users deposit Tkoin to the treasury wallet:
1. 2% fee is automatically deducted by Token-2022 transfer fee extension
2. Fee is "withheld" in the mint account
3. Automated burn service periodically harvests and burns withheld fees

**Manual Burn (for testing or emergency):**
```bash
tsx solana/scripts/03-harvest-and-burn-fees.ts
```

**Automated Burn Service:**
The burn service runs as a background job in the Node.js server:
```typescript
import { initializeBurnService } from './server/services/burn-service';

// Initialize and start (runs every 60 minutes by default)
const burnService = initializeBurnService(rpcUrl, mintAddress, treasuryPrivateKey);
burnService.start(60); // Run every 60 minutes

// Manual trigger
await burnService.manualBurn();
```

This ensures that the 2% transfer fee truly reduces the circulating supply, maintaining the deflationary tokenomics.

### Monitoring Treasury Deposits

The blockchain monitoring service watches the treasury wallet:

```typescript
connection.onLogs(
  treasuryWallet.publicKey,
  (logs) => {
    // Parse transaction
    // Extract user ID from memo
    // Calculate burn (2%)
    // Calculate credits
    // Send webhook to Laravel
  },
  'confirmed'
);
```

## Stablecoin Swaps (USDT/USDC/EURt ↔ Tkoin)

For agents to purchase Tkoin inventory with stablecoins, integrate with:

1. **Jupiter Aggregator** (recommended):
   - Best prices across all Solana DEXs
   - Simple SDK integration
   - Supports all major stablecoins

2. **Direct DEX Integration**:
   - Orca
   - Raydium
   - Lifinity

Example using Jupiter:

```typescript
import { Jupiter } from '@jup-ag/core';

const jupiter = await Jupiter.load({
  connection,
  cluster: 'mainnet-beta',
  user: agentWallet,
});

const routes = await jupiter.computeRoutes({
  inputMint: USDC_MINT,
  outputMint: TKOIN_MINT,
  amount: amountInBaseUnits,
  slippageBps: 50, // 0.5%
});

const { execute } = await jupiter.exchange({
  routeInfo: routes.routesInfos[0],
});

await execute();
```

## Production Checklist

Before deploying to mainnet:

- [ ] Test thoroughly on devnet
- [ ] Verify transfer fee mechanism works correctly
- [ ] Test automated burn service (harvest + burn cycle)
- [ ] Audit smart contract integration
- [ ] Set up multi-sig for treasury wallet (recommend Squads Protocol)
- [ ] Configure rate limits and monitoring
- [ ] Prepare incident response plan
- [ ] Document wallet backup and recovery procedures
- [ ] Consider token metadata (name, symbol, logo via Metaplex)
- [ ] Set up automated treasury balance monitoring
- [ ] Configure burn service alerting and monitoring
- [ ] Test burn service failover and recovery

## Security Best Practices

1. **Wallet Management**:
   - Use hardware wallet (Ledger) for production
   - Implement multi-signature (Squads Protocol)
   - Rotate keys on suspected compromise

2. **Rate Limiting**:
   - Limit minting per agent per day
   - Monitor for unusual transaction patterns
   - Implement circuit breakers

3. **Monitoring**:
   - Alert on large transactions
   - Track burn rate and supply
   - Monitor wallet balances

4. **Access Control**:
   - Separate development and production wallets
   - Restrict RPC access with API keys
   - Log all mint operations

## Troubleshooting

### "Insufficient funds" error
- Fund treasury wallet with SOL
- Check network (devnet vs mainnet)

### "Invalid account owner" error
- Ensure using TOKEN_2022_PROGRAM_ID, not TOKEN_PROGRAM_ID
- Verify mint address is correct

### Transfer fee not applied
- Verify token was created with TransferFeeConfig extension
- Check explorer for extension data

### RPC connection timeout
- Try different RPC endpoint
- Check network connectivity
- Consider using paid RPC (QuickNode, Helius)

## Resources

- [Solana Token-2022 Documentation](https://spl.solana.com/token-2022)
- [Transfer Fee Extension Guide](https://spl.solana.com/token-2022/extensions#transfer-fees)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
- [Jupiter Aggregator](https://jup.ag/)
- [Squads Protocol (Multisig)](https://squads.so/)
- [Metaplex Documentation](https://docs.metaplex.com/)

## Support

For questions or issues:
1. Check Solana Discord #dev-support
2. Review [Solana Stack Exchange](https://solana.stackexchange.com/)
3. Consult project documentation

---

**⚠️ SECURITY REMINDER**: Never commit private keys, wallet files, or secrets to version control. Always use environment variables and secure secret management.
