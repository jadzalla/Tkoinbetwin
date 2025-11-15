import { 
  PublicKey, 
  Connection,
  AccountInfo,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { 
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
} from '@solana/spl-token';
import { TKOIN_MINT, STAKING_SEED, STAKING_PROGRAM_ID } from '@shared/staking-constants';

/**
 * Derive the PDA for an agent's stake account
 * 
 * @param agentWallet - Agent's Solana wallet public key
 * @returns PDA address and bump seed
 */
export async function deriveStakePDA(agentWallet: PublicKey): Promise<[PublicKey, number]> {
  return await PublicKey.findProgramAddress(
    [
      Buffer.from(STAKING_SEED),
      agentWallet.toBuffer(),
    ],
    STAKING_PROGRAM_ID
  );
}

/**
 * Get the agent's TKOIN Associated Token Account
 * 
 * @param connection - Solana connection
 * @param agentWallet - Agent's wallet public key
 * @returns ATA address
 */
export async function getAgentTokenAccount(
  connection: Connection,
  agentWallet: PublicKey
): Promise<PublicKey> {
  return await getAssociatedTokenAddress(
    TKOIN_MINT,
    agentWallet,
    false, // allowOwnerOffCurve
    TOKEN_2022_PROGRAM_ID
  );
}

/**
 * Get the staking vault's TKOIN Associated Token Account
 * 
 * @param connection - Solana connection
 * @param stakePDA - Stake PDA address
 * @returns Vault ATA address
 */
export async function getStakingVaultAccount(
  connection: Connection,
  stakePDA: PublicKey
): Promise<PublicKey> {
  return await getAssociatedTokenAddress(
    TKOIN_MINT,
    stakePDA,
    true, // allowOwnerOffCurve (PDA)
    TOKEN_2022_PROGRAM_ID
  );
}

/**
 * Check if an agent's stake account exists
 * 
 * @param connection - Solana connection
 * @param agentWallet - Agent's wallet public key
 * @returns true if account exists
 */
export async function stakeAccountExists(
  connection: Connection,
  agentWallet: PublicKey
): Promise<boolean> {
  try {
    const [stakePDA] = await deriveStakePDA(agentWallet);
    const accountInfo = await connection.getAccountInfo(stakePDA);
    return accountInfo !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Get the staked token balance for an agent
 * 
 * @param connection - Solana connection
 * @param agentWallet - Agent's wallet public key
 * @returns Staked balance in base units (0 if no stake)
 */
export async function getStakedBalance(
  connection: Connection,
  agentWallet: PublicKey
): Promise<bigint> {
  try {
    const [stakePDA] = await deriveStakePDA(agentWallet);
    const vaultAccount = await getStakingVaultAccount(connection, stakePDA);
    
    const tokenAccount = await getAccount(
      connection,
      vaultAccount,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );
    
    return tokenAccount.amount;
  } catch (error) {
    console.error('Error getting staked balance:', error);
    return BigInt(0);
  }
}

/**
 * Get agent's available TKOIN balance (unstaked)
 * 
 * @param connection - Solana connection
 * @param agentWallet - Agent's wallet public key
 * @returns Available balance in base units
 */
export async function getAvailableBalance(
  connection: Connection,
  agentWallet: PublicKey
): Promise<bigint> {
  try {
    const tokenAccount = await getAgentTokenAccount(connection, agentWallet);
    const account = await getAccount(
      connection,
      tokenAccount,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );
    
    return account.amount;
  } catch (error) {
    console.error('Error getting available balance:', error);
    return BigInt(0);
  }
}

/**
 * Create instruction to initialize staking vault ATA if needed
 * 
 * @param payer - Transaction payer
 * @param stakePDA - Stake PDA
 * @returns Instruction or null if already exists
 */
export async function createStakingVaultInstruction(
  connection: Connection,
  payer: PublicKey,
  stakePDA: PublicKey
): Promise<TransactionInstruction | null> {
  const vaultAccount = await getStakingVaultAccount(connection, stakePDA);
  
  try {
    await getAccount(connection, vaultAccount, 'confirmed', TOKEN_2022_PROGRAM_ID);
    return null; // Already exists
  } catch {
    return createAssociatedTokenAccountInstruction(
      payer,
      vaultAccount,
      stakePDA,
      TKOIN_MINT,
      TOKEN_2022_PROGRAM_ID
    );
  }
}
