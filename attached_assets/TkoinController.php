<?php
/**
 *   BetWin - Tkoin Protocol Integration
 *   ------------------------------------
 *   TkoinController.php
 * 
 *   @copyright  Copyright (c) BetWin, All rights reserved
 *   @author     BetWin <dev@betwin.tkoin.finance>
 *   @see        https://betwin.tkoin.finance
*/

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\TkoinSettlement;
use App\Repositories\AccountTransactionRepository;
use App\Repositories\TkoinSettlementRepository;
use App\Services\TkoinService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class TkoinController extends Controller
{
    protected TkoinService $tkoinService;

    public function __construct(TkoinService $tkoinService)
    {
        $this->tkoinService = $tkoinService;
    }

    /**
     * Get user's Tkoin balance
     */
    public function balance(Request $request)
    {
        $user = $request->user();
        $account = $user->account;

        if (!$account) {
            return response()->json([
                'balance' => 0,
                'currency' => null,
            ]);
        }

        return response()->json([
            'balance' => (float) $account->balance,
            'currency' => $account->currency_code,
            'account_id' => $account->id,
        ]);
    }

    /**
     * Initiate a deposit
     */
    public function deposit(Request $request)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
        ]);

        $user = $request->user();
        $account = $user->account;

        if (!$account) {
            throw ValidationException::withMessages([
                'account' => __('No account found for deposit.'),
            ]);
        }

        try {
            // Initiate deposit through Tkoin
            $settlement = $this->tkoinService->initiateDeposit(
                $user,
                $account,
                (float) $validated['amount']
            );

            Log::info('Deposit initiated', [
                'user_id' => $user->id,
                'settlement_id' => $settlement->id,
                'amount' => $validated['amount'],
            ]);

            return response()->json([
                'success' => true,
                'settlement_id' => $settlement->id,
                'amount' => $settlement->amount,
                'status' => $settlement->status,
                'message' => __('Deposit initiated. Please complete the transaction on Tkoin.'),
            ]);
        } catch (\Exception $e) {
            Log::error('Deposit failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            throw ValidationException::withMessages([
                'amount' => __('Failed to initiate deposit: :error', ['error' => $e->getMessage()]),
            ]);
        }
    }

    /**
     * Initiate a withdrawal
     */
    public function withdrawal(Request $request)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'solana_address' => 'nullable|string|max:255',
        ]);

        $user = $request->user();
        $account = $user->account;

        if (!$account) {
            throw ValidationException::withMessages([
                'account' => __('No account found for withdrawal.'),
            ]);
        }

        try {
            // Initiate withdrawal through Tkoin
            $settlement = $this->tkoinService->initiateWithdrawal(
                $user,
                $account,
                (float) $validated['amount'],
                $validated['solana_address'] ?? null
            );

            Log::info('Withdrawal initiated', [
                'user_id' => $user->id,
                'settlement_id' => $settlement->id,
                'amount' => $validated['amount'],
            ]);

            return response()->json([
                'success' => true,
                'settlement_id' => $settlement->id,
                'amount' => $settlement->amount,
                'status' => $settlement->status,
                'message' => __('Withdrawal initiated successfully.'),
            ]);
        } catch (\Exception $e) {
            Log::error('Withdrawal failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            throw ValidationException::withMessages([
                'amount' => __('Failed to initiate withdrawal: :error', ['error' => $e->getMessage()]),
            ]);
        }
    }

    /**
     * Get settlement history
     */
    public function history(Request $request)
    {
        $validated = $request->validate([
            'limit' => 'nullable|integer|min:1|max:100',
            'type' => 'nullable|in:deposit,withdrawal',
            'status' => 'nullable|in:pending,processing,completed,failed,cancelled',
        ]);

        $user = $request->user();
        $limit = $validated['limit'] ?? 50;

        $query = TkoinSettlement::where('user_id', $user->id);

        if (isset($validated['type'])) {
            $query->where('type', $validated['type']);
        }

        if (isset($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        $settlements = $query
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get()
            ->map(function (TkoinSettlement $settlement) {
                return [
                    'id' => $settlement->id,
                    'type' => $settlement->type,
                    'amount' => (float) $settlement->amount,
                    'status' => $settlement->status,
                    'solana_signature' => $settlement->solana_signature,
                    'completed_at' => $settlement->completed_at?->toIso8601String(),
                    'created_at' => $settlement->created_at->toIso8601String(),
                ];
            });

        return response()->json([
            'settlements' => $settlements,
            'count' => count($settlements),
        ]);
    }

    /**
     * Get specific settlement details
     */
    public function show(Request $request, TkoinSettlement $settlement)
    {
        // Authorization: user can only see their own settlements
        if ($settlement->user_id !== $request->user()->id) {
            abort(403, __('Unauthorized'));
        }

        return response()->json([
            'id' => $settlement->id,
            'type' => $settlement->type,
            'amount' => (float) $settlement->amount,
            'status' => $settlement->status,
            'solana_signature' => $settlement->solana_signature,
            'metadata' => $settlement->metadata,
            'completed_at' => $settlement->completed_at?->toIso8601String(),
            'created_at' => $settlement->created_at->toIso8601String(),
            'updated_at' => $settlement->updated_at->toIso8601String(),
        ]);
    }

    /**
     * Get settlement stats
     */
    public function stats(Request $request)
    {
        $user = $request->user();
        $stats = TkoinSettlementRepository::getUserStats($user);

        return response()->json($stats);
    }

    /**
     * Cancel a pending settlement
     */
    public function cancel(Request $request, TkoinSettlement $settlement)
    {
        // Authorization: user can only cancel their own settlements
        if ($settlement->user_id !== $request->user()->id) {
            abort(403, __('Unauthorized'));
        }

        // Only pending or processing settlements can be cancelled
        if (!in_array($settlement->status, [TkoinSettlement::STATUS_PENDING, TkoinSettlement::STATUS_PROCESSING])) {
            throw ValidationException::withMessages([
                'status' => __('Only pending or processing settlements can be cancelled.'),
            ]);
        }

        try {
            $settlement->update(['status' => TkoinSettlement::STATUS_CANCELLED]);

            Log::info('Settlement cancelled', [
                'settlement_id' => $settlement->id,
                'user_id' => $request->user()->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => __('Settlement cancelled successfully.'),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to cancel settlement', [
                'settlement_id' => $settlement->id,
                'error' => $e->getMessage(),
            ]);

            throw ValidationException::withMessages([
                'status' => __('Failed to cancel settlement.'),
            ]);
        }
    }
}
