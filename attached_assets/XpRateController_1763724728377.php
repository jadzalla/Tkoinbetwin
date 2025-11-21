<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   XpRateController.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Http\Controllers\Admin;

use App\Helpers\Queries\XpRateQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreOrUpdateXpRate;
use App\Models\XpRate;
use App\Repositories\XpRateRepository;

class XpRateController extends Controller
{
    public function index(XpRateQuery $query)
    {
        return $query;
    }

    public function show(XpRate $xpRate)
    {
        return [
            'model' => $xpRate->makeVisibleAll(),
        ];
    }

    public function update(StoreOrUpdateXpRate $request, XpRateRepository $repository, XpRate $xpRate)
    {
        $repository->update($xpRate, $request->validated());

        return $this->response(__('XP rate successfully updated.'));
    }
}
