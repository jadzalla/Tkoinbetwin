<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   KycController.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Http\Controllers;

use App\Exceptions\WebhookException;
use App\Http\Requests\StoreKycRequest;
use App\Models\KycRequest;
use App\Services\Kyc\CanProcessWebhook;
use App\Services\Kyc\Provider as KycProvider;
use Illuminate\Http\Request;

class KycController extends Controller
{
    public function show(Request $request, KycProvider $kycProvider)
    {
        return KycRequest::fromUser($request->user())->notRejected()->exists()
            ? ['submitted' => true]
            : $kycProvider::model()->form;
    }

    public function store(StoreKycRequest $request, KycProvider $kycProvider)
    {
        $kycProvider->process($request);

        return true;
    }

    public function processWebhook(Request $request, KycProvider $provider)
    {
        throw_unless(
            $provider->isEnabled(),
            WebhookException::class,
            sprintf('KYC provider %s is not enabled', class_basename($provider))
        );

        throw_unless(
            $provider instanceof CanProcessWebhook,
            WebhookException::class,
            sprintf('KYC provider %s does not support webhooks', class_basename($provider))
        );

        return $provider->processWebhook($request);
    }
}
