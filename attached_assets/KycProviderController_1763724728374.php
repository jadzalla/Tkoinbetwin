<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   KycProviderController.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Http\Controllers\Admin;

use App\Helpers\Queries\KycProviderQuery;
use App\Http\Controllers\Controller;
use App\Models\KycProvider;
use Illuminate\Http\Request;

class KycProviderController extends Controller
{
    public function index(KycProviderQuery $query)
    {
        return $query;
    }

    public function show(KycProvider $kycProvider)
    {
        return $kycProvider;
    }

    public function update(KycProvider $kycProvider, Request $request)
    {
        $kycProvider->update($request->all());

        return $this->response(__('Provider successfully updated.'));
    }
}
