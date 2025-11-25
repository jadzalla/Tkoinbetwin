<?php
/**
 *   BetWin - Tkoin Protocol Integration
 *   ------------------------------------
 *   TkoinController.php - CORRECTED VERSION v3
 * 
 *   FIXES:
 *   - deposit() returns deposit instructions (doesn't require signature)
 *   - verifyDeposit() verifies blockchain transaction
 *   - balance() returns correct keys matching JavaScript expectations
 *   - history() returns correct structure
 * 
 *   @copyright  Copyright (c) BetWin, All rights reserved
 *   @author     BetWin <dev@betwin.tkoin.finance>
 *   @see        https://betwin.tkoin.finance
 */

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\Account;
use App\Services\TkoinService;

class TkoinController extends Controller
{
    protected $tkoinService;
    protected $tkoinApiBase;

    public function __construct(TkoinService $tkoinService)
    {
        $this->tkoinService = $tkoinService;
        $this->tkoinApiBase = config('services.tkoin.api_base');
    }

    /**
     * Show the Tkoin Wallet page
     */
    public function showWallet()
    {
        $user = auth()->user();
        
        $balance = $this->tkoinService->getUserBalance($user);
        $transactions = $this->tkoinService->getUserTransactions($user, 20);
        
        return view('user.tkoin-wallet', [
            'balance' => $balance ?? ['credits' => 0, 'tkoin' => 0],
            'transactions' => $transactions ?? [],
            'treasuryWallet' => config('services.tkoin.treasury_wallet'),
            'tkoinMint' => config('services.tkoin.mint_address'),
        ]);
    }

    /**
     * API: Get user balance
     * 
     * FIXED: Returns keys that match JavaScript expectations
     */
    public function balance(Request $request)
    {
        try {
            $user = auth()->user();
            $balanceData = $this->tkoinService->getUserBalance($user);
            
            if (!$balanceData) {
                return response()->json([
                    'balance' => 0,
                    'currency' => 'CREDIT',
                    'account_id' => null,
                    'error' => 'Could not fetch balance'
                ], 200);
            }
            
            return response()->json([
                'balance' => $balanceData['balance'] ?? $balanceData['credits'] ?? 0,
                'currency' => $balanceData['currency'] ?? 'CREDIT',
                'account_id' => $balanceData['account_id'] ?? $user->id,
                'tkoin_equivalent' => $balanceData['tkoin'] ?? 0,
            ]);
        } catch (\Exception $e) {
            Log::error('Tkoin balance error', ['error' => $e->getMessage()]);
            return response()->json([
                'balance' => 0,
                'currency' => 'CREDIT',
                'account_id' => null,
                'error' => 'Failed to fetch balance'
            ], 500);
        }
    }

    /**
     * API: Get transaction history
     */
    public function history(Request $request)
    {
        try {
            $user = auth()->user();
            $limit = $request->get('limit', 20);
            $transactions = $this->tkoinService->getUserTransactions($user, $limit);
            
            return response()->json([
                'transactions' => $transactions ?? [],
                'settlements' => $transactions ?? [],
            ]);
        } catch (\Exception $e) {
            Log::error('Tkoin history error', ['error' => $e->getMessage()]);
            return response()->json([
                'transactions' => [],
                'error' => 'Failed to fetch history'
            ], 500);
        }
    }

    /**
     * API: Initiate deposit - returns deposit instructions
     * 
     * FIXED: This endpoint returns deposit instructions to the user.
     * User must send TKOIN to treasury wallet, then call verify-deposit.
     */
    public function deposit(Request $request)
    {
        try {
            $validated = $request->validate([
                'amount' => 'sometimes|numeric|min:0.1',
            ]);

            $user = auth()->user();
            $amount = $validated['amount'] ?? null;
            
            // Get treasury wallet from config
            $treasuryWallet = config('services.tkoin.treasury_wallet', env('SOLANA_TREASURY_WALLET'));
            $tkoinMint = config('services.tkoin.mint_address', env('TKOIN_MINT_ADDRESS'));
            
            if (!$treasuryWallet) {
                return response()->json([
                    'success' => false,
                    'error' => 'Treasury wallet not configured. Please contact support.'
                ], 500);
            }

            // Calculate TKOIN amount (100 CREDIT = 1 TKOIN)
            $tkoinAmount = $amount ? $amount / 100 : null;
            
            Log::info('Deposit instructions requested', [
                'user_id' => $user->id,
                'credits_amount' => $amount,
                'tkoin_amount' => $tkoinAmount,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Send TKOIN to the treasury wallet, then verify your deposit.',
                'instructions' => [
                    'step1' => 'Open your Phantom wallet',
                    'step2' => 'Send TKOIN to the treasury wallet address below',
                    'step3' => 'Include your User ID in the memo field',
                    'step4' => 'After sending, click "Verify Deposit" with your transaction signature',
                ],
                'treasury_wallet' => $treasuryWallet,
                'tkoin_mint' => $tkoinMint,
                'platform_user_id' => (string)$user->id,
                'suggested_amount' => $tkoinAmount,
                'credits_conversion' => '1 TKOIN = 100 CREDIT',
                'memo_format' => 'TKOIN:' . $user->id,
            ]);

        } catch (\Exception $e) {
            Log::error('Deposit initiation error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to get deposit instructions: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Verify a Phantom wallet deposit using blockchain signature
     */
    public function verifyDeposit(Request $request)
    {
        try {
            $validated = $request->validate([
                'signature' => 'required|string',
                'amount' => 'sometimes|numeric|min:0.01',
                'platformUserId' => 'sometimes|string',
            ]);

            $signature = $validated['signature'];
            $expectedAmount = $validated['amount'] ?? null;
            
            $user = auth()->user();
            $platformUserId = $validated['platformUserId'] ?? (string)$user->id;
            
            if ($user->id != $platformUserId) {
                return response()->json([
                    'success' => false,
                    'error' => 'Unauthorized: User ID mismatch'
                ], 403);
            }

            Log::info('Verifying Phantom deposit', [
                'user_id' => $platformUserId,
                'signature' => $signature,
                'expected_amount' => $expectedAmount,
            ]);

            // Check if signature already processed
            $existingDeposit = DB::table('tkoin_settlements')
                ->where('solana_signature', $signature)
                ->first();

            if ($existingDeposit) {
                return response()->json([
                    'success' => false,
                    'error' => 'This transaction has already been processed.',
                    'deposit_id' => $existingDeposit->id,
                ], 400);
            }

            // Verify with Tkoin Protocol API
            $verifyResponse = Http::timeout(30)->post("{$this->tkoinApiBase}/api/verify-deposit", [
                'signature' => $signature,
                'platformUserId' => $platformUserId,
            ]);

            if (!$verifyResponse->successful()) {
                Log::error('Blockchain verification failed', [
                    'status' => $verifyResponse->status(),
                    'response' => $verifyResponse->body(),
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'Transaction verification failed. Please try again or contact support.'
                ], 400);
            }

            $verifyData = $verifyResponse->json();

            if (!($verifyData['success'] ?? false)) {
                return response()->json([
                    'success' => false,
                    'error' => 'Invalid transaction: ' . ($verifyData['error'] ?? 'Verification failed')
                ], 400);
            }

            if ($verifyData['alreadyProcessed'] ?? false) {
                return response()->json([
                    'success' => false,
                    'error' => 'Deposit already processed',
                    'depositId' => $verifyData['depositId'] ?? null
                ], 400);
            }

            $actualAmount = $verifyData['amount'] ?? 0;
            $creditsAmount = $actualAmount * 100;

            // Get user account
            $account = Account::where('user_id', $user->id)->first();
            
            if (!$account) {
                return response()->json([
                    'success' => false,
                    'error' => 'User account not found'
                ], 404);
            }

            // Credit the user's account
            $account->balance = ($account->balance ?? 0) + $creditsAmount;
            $account->save();

            // Record the settlement
            DB::table('tkoin_settlements')->insert([
                'user_id' => $user->id,
                'account_id' => $account->id,
                'type' => 'deposit',
                'status' => 'completed',
                'amount' => $creditsAmount,
                'solana_signature' => $signature,
                'metadata' => json_encode([
                    'tkoin_amount' => $actualAmount,
                    'sender_wallet' => $verifyData['senderAddress'] ?? null,
                    'burn_amount' => $verifyData['burnAmount'] ?? 0,
                    'verified_at' => now()->toIso8601String(),
                ]),
                'completed_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            Log::info('Deposit completed successfully', [
                'user_id' => $user->id,
                'tkoin_amount' => $actualAmount,
                'credits_amount' => $creditsAmount,
                'signature' => $signature,
            ]);

            return response()->json([
                'success' => true,
                'signature' => $signature,
                'tkoin_amount' => $actualAmount,
                'credits_amount' => $creditsAmount,
                'new_balance' => $account->balance,
                'message' => "Deposit successful! {$creditsAmount} CREDIT added to your account.",
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid request: ' . implode(', ', array_map(fn($errors) => implode(', ', $errors), $e->errors()))
            ], 422);
        } catch (\Exception $e) {
            Log::error('Deposit verification exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'An error occurred while processing your deposit. Please contact support.'
            ], 500);
        }
    }

    /**
     * Process withdrawal request - Calls Tkoin Protocol API to send TKOIN
     */
    public function withdraw(Request $request)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:1',
            'wallet_address' => 'required|string|min:32|max:64',
        ]);

        $user = auth()->user();
        $creditsAmount = $validated['amount'];
        $destinationWallet = $validated['wallet_address'];
        
        $account = Account::where('user_id', $user->id)->first();
        
        if (!$account) {
            return response()->json([
                'success' => false,
                'error' => 'User account not found'
            ], 404);
        }

        if ($account->balance < $creditsAmount) {
            return response()->json([
                'success' => false,
                'error' => 'Insufficient balance',
                'available' => $account->balance,
                'requested' => $creditsAmount,
            ], 400);
        }

        try {
            Log::info('Processing withdrawal', [
                'user_id' => $user->id,
                'credits_amount' => $creditsAmount,
                'destination_wallet' => $destinationWallet,
            ]);

            // Call Tkoin Protocol API to process on-chain withdrawal
            $withdrawResponse = Http::timeout(60)->post("{$this->tkoinApiBase}/api/process-withdrawal", [
                'credits_amount' => $creditsAmount,
                'destination_wallet' => $destinationWallet,
                'platformUserId' => (string)$user->id,
            ]);

            if (!$withdrawResponse->successful()) {
                Log::error('Tkoin withdrawal API error', [
                    'status' => $withdrawResponse->status(),
                    'response' => $withdrawResponse->body(),
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'Failed to process withdrawal. Please try again later.'
                ], 500);
            }

            $withdrawData = $withdrawResponse->json();

            if (!($withdrawData['success'] ?? false)) {
                return response()->json([
                    'success' => false,
                    'error' => $withdrawData['error'] ?? 'Withdrawal failed'
                ], 400);
            }

            // Deduct from user balance
            $account->balance = $account->balance - $creditsAmount;
            $account->save();

            // Record the settlement
            DB::table('tkoin_settlements')->insert([
                'user_id' => $user->id,
                'account_id' => $account->id,
                'type' => 'withdrawal',
                'status' => 'completed',
                'amount' => $creditsAmount,
                'solana_signature' => $withdrawData['signature'] ?? null,
                'metadata' => json_encode([
                    'tkoin_amount' => $withdrawData['tkoin_amount'] ?? ($creditsAmount / 100),
                    'destination_wallet' => $destinationWallet,
                    'withdrawal_id' => $withdrawData['withdrawal_id'] ?? null,
                    'processed_at' => now()->toIso8601String(),
                ]),
                'completed_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            Log::info('Withdrawal completed successfully', [
                'user_id' => $user->id,
                'credits_amount' => $creditsAmount,
                'signature' => $withdrawData['signature'] ?? null,
            ]);

            return response()->json([
                'success' => true,
                'message' => $withdrawData['message'] ?? 'Withdrawal successful!',
                'signature' => $withdrawData['signature'] ?? null,
                'tkoin_amount' => $withdrawData['tkoin_amount'] ?? ($creditsAmount / 100),
                'new_balance' => $account->balance,
            ]);

        } catch (\Exception $e) {
            Log::error('Withdrawal exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'An error occurred while processing your withdrawal. Please contact support.'
            ], 500);
        }
    }

    /**
     * API: Withdrawal endpoint (alias for withdraw)
     */
    public function withdrawal(Request $request)
    {
        return $this->withdraw($request);
    }

    /**
     * Redirect to P2P Marketplace
     */
    public function redirectToMarketplace()
    {
        $marketplaceUrl = config('services.tkoin.marketplace_url', $this->tkoinApiBase . '/marketplace');
        return redirect()->away($marketplaceUrl);
    }
}
