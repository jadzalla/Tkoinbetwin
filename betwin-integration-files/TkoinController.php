<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Services\TkoinService;

/**
 * Tkoin Integration Controller for BetWin Casino
 * 
 * Handles three deposit/withdrawal scenarios:
 * 1. Direct Phantom wallet deposits (verifyDeposit)
 * 2. P2P marketplace purchases (handled by TkoinService)
 * 3. Withdrawals via Platform API (handled by TkoinService)
 */
class TkoinController extends Controller
{
    protected $tkoinService;
    protected $tkoinApiBase;
    protected $platformToken;
    protected $apiSecret;

    public function __construct(TkoinService $tkoinService)
    {
        $this->tkoinService = $tkoinService;
        $this->tkoinApiBase = config('services.tkoin.api_base');
        $this->platformToken = config('services.tkoin.platform_token');
        $this->apiSecret = config('services.tkoin.api_secret');
    }

    /**
     * Show Tkoin wallet interface
     */
    public function showWallet()
    {
        $user = auth()->user();
        
        // Get user's TKOIN balance and transaction history from Platform API
        $balance = $this->tkoinService->getBalance($user->id);
        $transactions = $this->tkoinService->getTransactions($user->id);
        
        return view('tkoin.wallet', [
            'balance' => $balance,
            'transactions' => $transactions,
            'treasuryWallet' => config('services.tkoin.treasury_wallet'),
            'tkoinMint' => config('services.tkoin.mint_address'),
        ]);
    }

    /**
     * Verify Phantom wallet deposit and credit user account
     * 
     * Flow:
     * 1. User signs transaction in Phantom wallet
     * 2. Frontend calls this endpoint with transaction signature
     * 3. We verify on-chain via Tkoin Protocol's /api/verify-deposit
     * 4. If valid, call Platform API to credit user's account
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function verifyDeposit(Request $request)
    {
        try {
            $validated = $request->validate([
                'signature' => 'required|string',
                'amount' => 'required|numeric|min:10',
                'platformUserId' => 'required|string',
            ]);

            $signature = $validated['signature'];
            $expectedAmount = $validated['amount'];
            $platformUserId = $validated['platformUserId'];
            
            // Verify user owns this request
            $user = auth()->user();
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

            // Step 1: Verify transaction on blockchain via Tkoin Protocol
            $verifyResponse = Http::post("{$this->tkoinApiBase}/api/verify-deposit", [
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
                    'error' => 'Transaction verification failed: ' . $verifyResponse->json()['error'] ?? 'Unknown error'
                ], 400);
            }

            $verifyData = $verifyResponse->json();

            if (!$verifyData['success']) {
                return response()->json([
                    'success' => false,
                    'error' => 'Invalid transaction: ' . ($verifyData['error'] ?? 'Unknown error')
                ], 400);
            }

            // Check if already processed
            if ($verifyData['alreadyProcessed']) {
                return response()->json([
                    'success' => false,
                    'error' => 'Deposit already processed',
                    'depositId' => $verifyData['depositId']
                ], 400);
            }

            // Verify amount matches
            $actualAmount = $verifyData['amount'];
            if (abs($actualAmount - $expectedAmount) > 0.001) {
                Log::error('Amount mismatch', [
                    'expected' => $expectedAmount,
                    'actual' => $actualAmount,
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'Amount mismatch: Expected ' . $expectedAmount . ', got ' . $actualAmount
                ], 400);
            }

            Log::info('Blockchain verification successful', $verifyData);

            // Step 2: Check for duplicate processing in our database
            $existingDeposit = DB::table('tkoin_deposits')
                ->where('solana_signature', $signature)
                ->first();

            if ($existingDeposit) {
                return response()->json([
                    'success' => false,
                    'error' => 'Deposit already recorded in BetWin database'
                ], 400);
            }

            // Step 3: Call Platform API to credit user's account
            // This will handle burn rate and credit ratio automatically
            $depositResponse = $this->tkoinService->createDeposit(
                $platformUserId,
                $actualAmount,
                $signature,
                [
                    'deposit_type' => 'phantom_wallet',
                    'sender_wallet' => $verifyData['senderAddress'],
                    'memo' => $verifyData['memo'],
                    'timestamp' => $verifyData['timestamp'],
                ]
            );

            if (!$depositResponse['success']) {
                Log::error('Platform API deposit failed', [
                    'error' => $depositResponse['error'],
                    'signature' => $signature,
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'Failed to credit account: ' . $depositResponse['error']
                ], 500);
            }

            // Step 4: Record deposit in local database for tracking
            DB::table('tkoin_deposits')->insert([
                'user_id' => $platformUserId,
                'solana_signature' => $signature,
                'sender_wallet' => $verifyData['senderAddress'],
                'tkoin_amount' => $actualAmount,
                'credits_amount' => $depositResponse['credits_amount'],
                'burn_amount' => $depositResponse['burn_amount'] ?? 0,
                'status' => 'completed',
                'platform_transaction_id' => $depositResponse['transaction_id'],
                'metadata' => json_encode([
                    'memo' => $verifyData['memo'],
                    'timestamp' => $verifyData['timestamp'],
                    'destination' => $verifyData['destination'],
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            Log::info('Deposit completed successfully', [
                'user_id' => $platformUserId,
                'credits_amount' => $depositResponse['credits_amount'],
                'transaction_id' => $depositResponse['transaction_id'],
            ]);

            return response()->json([
                'success' => true,
                'signature' => $signature,
                'tkoin_amount' => $actualAmount,
                'credits_amount' => $depositResponse['credits_amount'],
                'burn_amount' => $depositResponse['burn_amount'] ?? 0,
                'transaction_id' => $depositResponse['transaction_id'],
                'message' => 'Deposit successful! Credits added to your account.',
            ]);

        } catch (\Exception $e) {
            Log::error('Deposit verification exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'An error occurred while processing your deposit. Please contact support with transaction signature: ' . ($signature ?? 'unknown')
            ], 500);
        }
    }

    /**
     * Redirect to P2P marketplace
     */
    public function redirectToMarketplace()
    {
        $marketplaceUrl = config('services.tkoin.marketplace_url', $this->tkoinApiBase . '/marketplace');
        return redirect()->away($marketplaceUrl);
    }

    /**
     * Withdraw credits to TKOIN via Platform API
     * User can then optionally sell TKOIN for fiat on P2P marketplace
     */
    public function withdraw(Request $request)
    {
        $validated = $request->validate([
            'credits_amount' => 'required|numeric|min:100',
            'destination_wallet' => 'required|string',
        ]);

        $user = auth()->user();

        // Call TkoinService to initiate withdrawal
        $result = $this->tkoinService->createWithdrawal(
            $user->id,
            $validated['credits_amount'],
            $validated['destination_wallet']
        );

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'error' => $result['error']
            ], 400);
        }

        return response()->json([
            'success' => true,
            'message' => 'Withdrawal initiated. TKOIN will be sent to your wallet shortly.',
            'transaction_id' => $result['transaction_id'],
            'tkoin_amount' => $result['tkoin_amount'],
        ]);
    }
}
