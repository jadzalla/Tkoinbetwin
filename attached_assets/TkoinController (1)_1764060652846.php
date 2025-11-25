<?php

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
                    'error' => 'Transaction verification failed: ' . ($verifyResponse->json()['error'] ?? 'Unknown error')
                ], 400);
            }

            $verifyData = $verifyResponse->json();

            if (!$verifyData['success']) {
                return response()->json([
                    'success' => false,
                    'error' => 'Invalid transaction: ' . ($verifyData['error'] ?? 'Unknown error')
                ], 400);
            }

            if ($verifyData['alreadyProcessed']) {
                return response()->json([
                    'success' => false,
                    'error' => 'Deposit already processed',
                    'depositId' => $verifyData['depositId']
                ], 400);
            }

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

            $existingDeposit = DB::table('tkoin_deposits')
                ->where('solana_signature', $signature)
                ->first();

            if ($existingDeposit) {
                return response()->json([
                    'success' => false,
                    'error' => 'Deposit already recorded in BetWin database'
                ], 400);
            }

            $account = Account::where('user_id', $user->id)->first();
            
            if (!$account) {
                return response()->json([
                    'success' => false,
                    'error' => 'User account not found'
                ], 404);
            }

            $creditsAmount = $actualAmount * 100;
            
            $depositResponse = $this->tkoinService->initiateDeposit(
                $user,
                $account,
                $creditsAmount
            );

            DB::table('tkoin_deposits')->insert([
                'user_id' => $platformUserId,
                'solana_signature' => $signature,
                'sender_wallet' => $verifyData['senderAddress'],
                'tkoin_amount' => $actualAmount,
                'credits_amount' => $creditsAmount,
                'burn_amount' => $verifyData['burnAmount'] ?? 0,
                'status' => 'completed',
                'platform_transaction_id' => $depositResponse['transactionId'] ?? null,
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
                'credits_amount' => $creditsAmount,
            ]);

            return response()->json([
                'success' => true,
                'signature' => $signature,
                'tkoin_amount' => $actualAmount,
                'credits_amount' => $creditsAmount,
                'burn_amount' => $verifyData['burnAmount'] ?? 0,
                'message' => 'Deposit successful! Credits added to your account.',
            ]);

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

    public function redirectToMarketplace()
    {
        $marketplaceUrl = config('services.tkoin.marketplace_url', $this->tkoinApiBase . '/marketplace');
        return redirect()->away($marketplaceUrl);
    }

    public function withdraw(Request $request)
    {
        $validated = $request->validate([
            'credits_amount' => 'required|numeric|min:100',
            'destination_wallet' => 'required|string',
        ]);

        $user = auth()->user();
        
        $account = Account::where('user_id', $user->id)->first();
        
        if (!$account) {
            return response()->json([
                'success' => false,
                'error' => 'User account not found'
            ], 404);
        }

        try {
            $result = $this->tkoinService->initiateWithdrawal(
                $user,
                $account,
                $validated['credits_amount'],
                $validated['destination_wallet']
            );

            return response()->json([
                'success' => true,
                'message' => 'Withdrawal initiated. TKOIN will be sent to your wallet shortly.',
                'tkoin_amount' => $validated['credits_amount'] / 100,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 400);
        }
    }

    // NEW METHODS BELOW - Added to support Tkoin Wallet page JavaScript

    public function balance(Request $request)
    {
        try {
            $user = auth()->user();
            $balance = $this->tkoinService->getUserBalance($user);
            
            return response()->json([
                'tkoinBalance' => $balance['tkoin'] ?? 0,
                'creditsBalance' => $balance['credits'] ?? 0,
                'userId' => $user->id
            ]);
        } catch (\Exception $e) {
            Log::error('Tkoin balance error', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to fetch balance'], 500);
        }
    }

    public function history(Request $request)
    {
        try {
            $user = auth()->user();
            $limit = $request->get('limit', 20);
            $transactions = $this->tkoinService->getUserTransactions($user, $limit);
            
            return response()->json([
                'transactions' => $transactions ?? []
            ]);
        } catch (\Exception $e) {
            Log::error('Tkoin history error', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to fetch history'], 500);
        }
    }

    public function deposit(Request $request)
    {
        return $this->verifyDeposit($request);
    }

    public function withdrawal(Request $request)
    {
        return $this->withdraw($request);
    }
}