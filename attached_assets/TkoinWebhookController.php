<?php
/**
 *   BetWin - Tkoin Protocol Integration
 *   ------------------------------------
 *   TkoinWebhookController.php
 * 
 *   @copyright  Copyright (c) BetWin, All rights reserved
 *   @author     BetWin <dev@betwin.tkoin.finance>
 *   @see        https://betwin.tkoin.finance
*/

namespace App\Http\Controllers;

use App\Services\TkoinService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TkoinWebhookController extends Controller
{
    protected TkoinService $tkoinService;

    public function __construct(TkoinService $tkoinService)
    {
        $this->tkoinService = $tkoinService;
    }

    /**
     * Handle Tkoin webhook for settlement updates
     */
    public function handleWebhook(Request $request)
    {
        // Get the signature from headers
        $signature = $request->header('X-TKOIN-SIGNATURE');
        
        if (!$signature) {
            Log::warning('Tkoin webhook missing signature');
            return response()->json(['error' => 'Missing signature'], 401);
        }

        // Get raw body for signature verification
        $payload = $request->getContent();

        // Verify webhook signature
        if (!$this->tkoinService->verifyWebhookSignature($payload, $signature)) {
            Log::warning('Tkoin webhook signature verification failed', [
                'signature' => substr($signature, 0, 20) . '...',
            ]);
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        // Parse webhook data
        $data = json_decode($payload, true);

        if (!isset($data['event'])) {
            Log::warning('Tkoin webhook missing event type', $data);
            return response()->json(['error' => 'Missing event type'], 400);
        }

        $event = $data['event'];
        $eventData = $data['data'] ?? [];

        // Log webhook reception
        Log::info('Tkoin webhook received', [
            'event' => $event,
            'settlement_id' => $eventData['settlement_id'] ?? null,
        ]);

        try {
            // Handle different webhook events
            switch ($event) {
                case 'settlement.completed':
                    return $this->handleSettlementCompleted($eventData);

                case 'settlement.failed':
                    return $this->handleSettlementFailed($eventData);

                case 'settlement.processing':
                    return $this->handleSettlementProcessing($eventData);

                default:
                    Log::warning('Unknown Tkoin webhook event', ['event' => $event]);
                    return response()->json(['error' => 'Unknown event'], 400);
            }
        } catch (\Exception $e) {
            Log::error('Tkoin webhook processing error', [
                'event' => $event,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json(['error' => 'Processing error'], 500);
        }
    }

    /**
     * Handle settlement.completed event
     */
    protected function handleSettlementCompleted(array $data): \Illuminate\Http\JsonResponse
    {
        if (!isset($data['settlement_id'])) {
            Log::warning('Settlement completed webhook missing settlement_id', $data);
            return response()->json(['error' => 'Missing settlement_id'], 400);
        }

        try {
            $this->tkoinService->handleSettlementCompleted($data);

            Log::info('Settlement completion processed', [
                'settlement_id' => $data['settlement_id'],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Settlement completed',
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to process settlement completion', [
                'settlement_id' => $data['settlement_id'] ?? null,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Processing failed'], 500);
        }
    }

    /**
     * Handle settlement.failed event
     */
    protected function handleSettlementFailed(array $data): \Illuminate\Http\JsonResponse
    {
        if (!isset($data['settlement_id'])) {
            Log::warning('Settlement failed webhook missing settlement_id', $data);
            return response()->json(['error' => 'Missing settlement_id'], 400);
        }

        try {
            $this->tkoinService->handleSettlementFailed($data);

            Log::info('Settlement failure processed', [
                'settlement_id' => $data['settlement_id'],
                'reason' => $data['failure_reason'] ?? null,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Settlement failure processed',
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to process settlement failure', [
                'settlement_id' => $data['settlement_id'] ?? null,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Processing failed'], 500);
        }
    }

    /**
     * Handle settlement.processing event (optional, for status updates)
     */
    protected function handleSettlementProcessing(array $data): \Illuminate\Http\JsonResponse
    {
        if (!isset($data['settlement_id'])) {
            Log::warning('Settlement processing webhook missing settlement_id', $data);
            return response()->json(['error' => 'Missing settlement_id'], 400);
        }

        // Log processing status update
        Log::info('Settlement in processing', [
            'settlement_id' => $data['settlement_id'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Settlement processing status noted',
        ]);
    }
}
