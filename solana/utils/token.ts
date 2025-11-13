import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  ExtensionType,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  mintTo,
  getAssociatedTokenAddress,
} from '@solana/spl-token';

/**
 * Create Token-2022 with Transfer Fee Extension
 */
export async function createTokenWithTransferFee(
  connection: Connection,
  payer: Keypair,
  mintAuthority: PublicKey,
  decimals: number,
  transferFeeBasisPoints: number, // e.g., 200 = 2%
  maxFee: bigint,
): Promise<PublicKey> {
  // Generate mint keypair
  const mint = Keypair.generate();

  // Calculate rent for mint account
  const extensions = [ExtensionType.TransferFeeConfig];
  const mintLen = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  console.log('🏗️  Creating Token-2022 mint...');
  console.log('   Mint address:', mint.publicKey.toBase58());
  console.log('   Decimals:', decimals);
  console.log('   Transfer fee:', `${transferFeeBasisPoints / 100}%`);
  console.log('   Max fee:', maxFee.toString());

  const transaction = new Transaction().add(
    // Create mint account
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    // Initialize transfer fee extension
    createInitializeTransferFeeConfigInstruction(
      mint.publicKey,
      payer.publicKey, // Transfer fee config authority
      payer.publicKey, // Withdraw withheld authority
      transferFeeBasisPoints,
      maxFee,
      TOKEN_2022_PROGRAM_ID,
    ),
    // Initialize mint
    createInitializeMintInstruction(
      mint.publicKey,
      decimals,
      mintAuthority,
      null, // Freeze authority (null = no freeze)
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  // Send transaction
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, mint],
    { commitment: 'confirmed' }
  );

  console.log('✅ Token created successfully!');
  console.log('   Transaction:', signature);
  console.log('   Mint address:', mint.publicKey.toBase58());

  return mint.publicKey;
}

/**
 * Create token metadata (requires Metaplex)
 * Note: This is a simplified version. For full metadata, use Metaplex SDK
 */
export interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string; // URI to JSON metadata
}

/**
 * Get or create associated token account
 */
export async function getOrCreateTokenAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve: boolean = false,
): Promise<PublicKey> {
  const tokenAccount = await createAssociatedTokenAccountIdempotent(
    connection,
    payer,
    mint,
    owner,
    allowOwnerOffCurve,
    'confirmed',
    TOKEN_2022_PROGRAM_ID
  );

  console.log('✅ Token account created/retrieved:', tokenAccount.toBase58());
  return tokenAccount;
}

/**
 * Mint tokens to an address
 */
export async function mintTokens(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  destination: PublicKey,
  mintAuthority: Keypair,
  amount: bigint,
): Promise<string> {
  console.log('🪙  Minting tokens...');
  console.log('   Mint:', mint.toBase58());
  console.log('   Destination:', destination.toBase58());
  console.log('   Amount:', amount.toString());

  const signature = await mintTo(
    connection,
    payer,
    mint,
    destination,
    mintAuthority,
    amount,
    [],
    {},
    TOKEN_2022_PROGRAM_ID
  );

  console.log('✅ Tokens minted successfully!');
  console.log('   Transaction:', signature);

  return signature;
}

/**
 * Get token balance
 */
export async function getTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey,
): Promise<bigint> {
  const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
  return BigInt(accountInfo.value.amount);
}

/**
 * Airdrop SOL for testing
 */
export async function airdropSol(
  connection: Connection,
  publicKey: PublicKey,
  amount: number = 2,
): Promise<string> {
  console.log(`💰 Requesting ${amount} SOL airdrop...`);
  const signature = await connection.requestAirdrop(
    publicKey,
    amount * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(signature);
  console.log('✅ Airdrop confirmed!');
  return signature;
}
