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

namespace App\Http\Controllers\Admin;

use App\Helpers\Queries\KycQuery;
use App\Http\Controllers\Controller;
use App\Models\KycRequest;
use App\Repositories\KycRequestRepository;

class KycController extends Controller
{
    public function index(KycQuery $query)
    {
        return $query;
    }

    public function show(KycRequest $kycRequest)
    {
        $kycRequest
            ->load('provider', 'user')
            ->makeVisibleAll()
            ->user->makeVisibleAll();

        return [
            'model' => $kycRequest
        ];
    }

    public function approve(KycRequest $kycRequest)
    {
        KycRequestRepository::approve($kycRequest);

        return $this->response(__('KYC request successfully approved.'));
    }

    public function reject(KycRequest $kycRequest)
    {
        KycRequestRepository::reject($kycRequest);

        return $this->response(__('KYC request successfully rejected.'));
    }

    public function destroy(KycRequest $kycRequest)
    {
        $kycRequest->delete();

        return $this->response(__('KYC request successfully deleted.'));
    }
}
