<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   PromoCodeController.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Http\Controllers;

use App\Http\Requests\RedeemPromoCode;
use App\Repositories\PromoCodeRepository;
use App\Services\PromoCodeService;

class PromoCodeController extends Controller
{
    public function redeem(RedeemPromoCode $request, PromoCodeService $service, PromoCodeRepository $repository)
    {
        $promoCode = $repository->findByCode($request->code);
        $account = $request->user()->accounts()->ofCurrency($promoCode->currency_code)->first();

        $service->redeem($account, $promoCode);

        return $this->response(__('Promo code successfully redeemed.'));
    }
}
