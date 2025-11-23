<?php

namespace App\Http\Controllers;

use App\Services\TkoinService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class TkoinController extends Controller
{
    protected TkoinService $tkoinService;

    public function __construct(TkoinService $tkoinService)
    {
        $this->middleware('auth');
        $this->tkoinService = $tkoinService;
    }

    /**
     * Get user's Tkoin balance
     */
    public function balance()
    {
        try {
            $user = Auth::user();
            $balance = $this->tkoinService->getUserBalance($user);

            if ($balance === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to fetch balance from Tkoin Protocol'
                ], 500);
            }

            return response()->json([
                'success' => true,
                'balance' => $balance
            ]);
        } catch (\Exception $e) {
            Log::error('Tkoin balance fetch error', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while fetching your balance'
            ], 500);
        }
    }

    /**
     * Get user's transaction history
     */
    public function history(Request $request)
    {
        try {
            $user = Auth::user();
            $limit = $request->input('limit', 10);

            $transactions = $this->tkoinService->getUserTransactions($user, $limit);

            return response()->json([
                'success' => true,
                'transactions' => $transactions
            ]);
        } catch (\Exception $e) {
            Log::error('Tkoin history fetch error', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while fetching transaction history',
                'transactions' => []
            ], 500);
        }
    }

    /**
     * Initiate a deposit
     */
    public function deposit(Request $request)
    {
        try {
            $validated = $request->validate([
                'amount' => 'required|numeric|min:10|max:1000000',
            ]);

            $user = Auth::user();
            $account = $user->account;

            if (!$account) {
                return response()->json([
                    'success' => false,
                    'message' => 'User account not found'
                ], 404);
            }

            // Amount is in credits
            $amount = floatval($validated['amount']);

            $response = $this->tkoinService->initiateDeposit($user, $account, $amount);

            return response()->json([
                'success' => true,
                'message' => 'Deposit initiated successfully',
                'transaction' => $response
            ]);
        } catch (\Exception $e) {
            Log::error('Tkoin deposit error', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'An error occurred while processing your deposit'
            ], 500);
        }
    }

    /**
     * Initiate a withdrawal
     */
    public function withdrawal(Request $request)
    {
        try {
            $validated = $request->validate([
                'amount' => 'required|numeric|min:10|max:1000000',
                'solana_wallet' => 'nullable|string|max:255',
            ]);

            $user = Auth::user();
            $account = $user->account;

            if (!$account) {
                return response()->json([
                    'success' => false,
                    'message' => 'User account not found'
                ], 404);
            }

            // Amount is in credits
            $amount = floatval($validated['amount']);
            $solanaWallet = $validated['solana_wallet'] ?? null;

            $response = $this->tkoinService->initiateWithdrawal($user, $account, $amount, $solanaWallet);

            return response()->json([
                'success' => true,
                'message' => 'Withdrawal initiated successfully',
                'transaction' => $response
            ]);
        } catch (\Exception $e) {
            Log::error('Tkoin withdrawal error', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'An error occurred while processing your withdrawal'
            ], 500);
        }
    }
}
