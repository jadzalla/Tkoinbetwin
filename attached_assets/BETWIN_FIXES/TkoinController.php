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
     * API: Get transaction history with filtering support
     * 
     * v7.0: Added query parameters for filtering:
     * - type: deposit, withdrawal, all (default: all)
     * - status: completed, pending, failed, all (default: all)
     * - date_from: YYYY-MM-DD start date
     * - date_to: YYYY-MM-DD end date
     * - min_amount: minimum amount filter
     * - max_amount: maximum amount filter
     * - limit: results per page (default: 20, max: 100)
     * - offset: pagination offset (default: 0)
     */
    public function history(Request $request)
    {
        try {
            $user = auth()->user();
            
            // Build filters from query parameters
            $filters = [];
            
            if ($request->has('type')) {
                $filters['type'] = $request->get('type');
            }
            if ($request->has('status')) {
                $filters['status'] = $request->get('status');
            }
            if ($request->has('date_from')) {
                $filters['date_from'] = $request->get('date_from');
            }
            if ($request->has('date_to')) {
                $filters['date_to'] = $request->get('date_to');
            }
            if ($request->has('min_amount')) {
                $filters['min_amount'] = $request->get('min_amount');
            }
            if ($request->has('max_amount')) {
                $filters['max_amount'] = $request->get('max_amount');
            }
            
            $limit = min((int)$request->get('limit', 20), 100);
            $offset = (int)$request->get('offset', 0);
            
            $result = $this->tkoinService->getUserTransactions($user, $filters, $limit, $offset);
            
            // Backward compatible: keep both 'transactions' and 'settlements' keys
            return response()->json([
                'transactions' => $result['transactions'] ?? [],
                'settlements' => $result['transactions'] ?? [],
                'total' => $result['total'] ?? 0,
                'limit' => $result['limit'] ?? $limit,
                'offset' => $result['offset'] ?? $offset,
                'has_more' => $result['has_more'] ?? false,
                'filters_applied' => !empty($filters) ? $filters : null,
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
     * API: Export transaction history as CSV or JSON
     * 
     * v7.0: New endpoint for downloading transactions
     * 
     * Query parameters:
     * - format: csv (default) or json
     * - type, status, date_from, date_to: same filters as history endpoint
     */
    public function export(Request $request)
    {
        try {
            $user = auth()->user();
            $format = $request->get('format', 'csv');
            
            // Validate format
            if (!in_array($format, ['csv', 'json'])) {
                return response()->json([
                    'success' => false,
                    'error' => 'Invalid format. Use csv or json.'
                ], 400);
            }
            
            // Build filters
            $filters = [];
            if ($request->has('type')) {
                $filters['type'] = $request->get('type');
            }
            if ($request->has('status')) {
                $filters['status'] = $request->get('status');
            }
            if ($request->has('date_from')) {
                $filters['date_from'] = $request->get('date_from');
            }
            if ($request->has('date_to')) {
                $filters['date_to'] = $request->get('date_to');
            }
            
            $data = $this->tkoinService->exportTransactions($user, $format, $filters);
            
            $filename = 'tkoin-transactions-' . date('Y-m-d') . '.' . $format;
            
            if ($format === 'json') {
                return response()->json($data)
                    ->header('Content-Disposition', 'attachment; filename="' . $filename . '"');
            }
            
            // CSV response
            return response($data)
                ->header('Content-Type', 'text/csv; charset=utf-8')
                ->header('Content-Disposition', 'attachment; filename="' . $filename . '"');
                
        } catch (\Exception $e) {
            Log::error('Tkoin export error', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'error' => 'Failed to export transactions'
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
    
    // ==================== P2P MARKETPLACE INTEGRATION v7.0 ====================
    
    /**
     * API: Get available agents/liquidity providers from Tkoin Protocol marketplace
     * 
     * BetWin users can browse active sell offers and purchase TKOIN with fiat
     */
    public function marketplaceAgents(Request $request)
    {
        try {
            Log::info('Fetching marketplace agents');
            
            // Query Tkoin Protocol API for active sell offers
            $response = Http::timeout(30)->get("{$this->tkoinApiBase}/api/p2p/market/offers", [
                'side' => 'sell', // We want agents selling TKOIN
                'status' => 'active',
            ]);
            
            if (!$response->successful()) {
                Log::error('Failed to fetch marketplace agents', ['status' => $response->status()]);
                return response()->json([
                    'success' => false,
                    'error' => 'Marketplace temporarily unavailable',
                    'agents' => [],
                ], 503);
            }
            
            $data = $response->json();
            
            // Transform offers for BetWin display
            $agents = collect($data['offers'] ?? [])->map(function ($offer) {
                return [
                    'id' => $offer['id'],
                    'agent_id' => $offer['agentId'],
                    'agent_name' => $offer['agentName'] ?? 'Agent',
                    'agent_tier' => $offer['agentTier'] ?? 'basic',
                    'price_per_tkoin' => (float)$offer['pricePerToken'],
                    'min_amount' => (float)$offer['minAmount'],
                    'max_amount' => (float)$offer['maxAmount'],
                    'available_tkoin' => (float)$offer['availableAmount'],
                    'payment_methods' => $offer['paymentMethods'] ?? [],
                    'currency' => $offer['currency'] ?? 'USD',
                    'created_at' => $offer['createdAt'] ?? null,
                ];
            })->toArray();
            
            return response()->json([
                'success' => true,
                'agents' => $agents,
                'total' => count($agents),
            ]);
            
        } catch (\Exception $e) {
            Log::error('Marketplace agents error', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'error' => 'Failed to fetch marketplace data',
                'agents' => [],
            ], 500);
        }
    }
    
    /**
     * API: Create a purchase order for TKOIN from an agent
     */
    public function marketplacePurchase(Request $request)
    {
        try {
            $validated = $request->validate([
                'offer_id' => 'required|integer',
                'tkoin_amount' => 'required|numeric|min:0.01',
                'payment_method' => 'required|string',
            ]);
            
            $user = auth()->user();
            
            Log::info('Creating marketplace purchase', [
                'user_id' => $user->id,
                'offer_id' => $validated['offer_id'],
                'amount' => $validated['tkoin_amount'],
            ]);
            
            // Create order via Tkoin Protocol API
            $response = Http::timeout(30)->post("{$this->tkoinApiBase}/api/p2p/orders", [
                'offerId' => $validated['offer_id'],
                'amount' => $validated['tkoin_amount'],
                'buyerPlatformId' => 'betwin',
                'buyerUserId' => (string)$user->id,
                'paymentMethod' => $validated['payment_method'],
            ]);
            
            if (!$response->successful()) {
                $error = $response->json()['error'] ?? 'Failed to create order';
                Log::error('Marketplace purchase failed', ['error' => $error]);
                return response()->json([
                    'success' => false,
                    'error' => $error,
                ], 400);
            }
            
            $orderData = $response->json();
            
            return response()->json([
                'success' => true,
                'message' => 'Purchase order created! Follow payment instructions.',
                'order' => [
                    'id' => $orderData['orderId'],
                    'status' => $orderData['status'] ?? 'created',
                    'tkoin_amount' => $validated['tkoin_amount'],
                    'credits_equivalent' => $validated['tkoin_amount'] * 100,
                    'fiat_amount' => $orderData['fiatAmount'] ?? null,
                    'payment_details' => $orderData['paymentDetails'] ?? null,
                    'expires_at' => $orderData['expiresAt'] ?? null,
                ],
            ]);
            
        } catch (\Exception $e) {
            Log::error('Marketplace purchase error', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'error' => 'Failed to create purchase order',
            ], 500);
        }
    }
    
    /**
     * API: Get user's marketplace orders
     */
    public function marketplaceMyOrders(Request $request)
    {
        try {
            $user = auth()->user();
            
            $response = Http::timeout(30)->get("{$this->tkoinApiBase}/api/p2p/orders", [
                'platformId' => 'betwin',
                'userId' => (string)$user->id,
            ]);
            
            if (!$response->successful()) {
                return response()->json([
                    'success' => false,
                    'orders' => [],
                ], 503);
            }
            
            $data = $response->json();
            
            return response()->json([
                'success' => true,
                'orders' => $data['orders'] ?? [],
            ]);
            
        } catch (\Exception $e) {
            Log::error('Marketplace orders error', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'orders' => [],
            ], 500);
        }
    }
    
    /**
     * API: Get specific order status
     */
    public function marketplaceOrderStatus(Request $request, $id)
    {
        try {
            $user = auth()->user();
            
            $response = Http::timeout(30)->get("{$this->tkoinApiBase}/api/p2p/orders/{$id}");
            
            if (!$response->successful()) {
                return response()->json([
                    'success' => false,
                    'error' => 'Order not found',
                ], 404);
            }
            
            return response()->json([
                'success' => true,
                'order' => $response->json(),
            ]);
            
        } catch (\Exception $e) {
            Log::error('Order status error', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'error' => 'Failed to fetch order status',
            ], 500);
        }
    }
    
    /**
     * API: Confirm payment was sent (buyer action)
     */
    public function marketplaceConfirmPayment(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'payment_proof' => 'sometimes|string',
            ]);
            
            $user = auth()->user();
            
            $response = Http::timeout(30)->post("{$this->tkoinApiBase}/api/p2p/orders/{$id}/confirm-payment", [
                'userId' => (string)$user->id,
                'platformId' => 'betwin',
                'paymentProof' => $validated['payment_proof'] ?? null,
            ]);
            
            if (!$response->successful()) {
                $error = $response->json()['error'] ?? 'Failed to confirm payment';
                return response()->json([
                    'success' => false,
                    'error' => $error,
                ], 400);
            }
            
            return response()->json([
                'success' => true,
                'message' => 'Payment confirmed. Waiting for agent to release TKOIN.',
            ]);
            
        } catch (\Exception $e) {
            Log::error('Payment confirmation error', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'error' => 'Failed to confirm payment',
            ], 500);
        }
    }
    
    /**
     * API: Cancel an order
     */
    public function marketplaceCancelOrder(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'reason' => 'sometimes|string|max:255',
            ]);
            
            $user = auth()->user();
            
            $response = Http::timeout(30)->post("{$this->tkoinApiBase}/api/p2p/orders/{$id}/cancel", [
                'userId' => (string)$user->id,
                'platformId' => 'betwin',
                'reason' => $validated['reason'] ?? 'User cancelled',
            ]);
            
            if (!$response->successful()) {
                $error = $response->json()['error'] ?? 'Failed to cancel order';
                return response()->json([
                    'success' => false,
                    'error' => $error,
                ], 400);
            }
            
            return response()->json([
                'success' => true,
                'message' => 'Order cancelled successfully.',
            ]);
            
        } catch (\Exception $e) {
            Log::error('Order cancellation error', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'error' => 'Failed to cancel order',
            ], 500);
        }
    }
}
