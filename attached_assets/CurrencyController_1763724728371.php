<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   CurrencyController.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Http\Controllers\Admin;

use App\Helpers\Queries\CurrencyQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUpdateCurrency;
use App\Models\Currency;
use App\Repositories\CurrencyRepository;

class CurrencyController extends Controller
{
    public function index(CurrencyQuery $query)
    {
        return $query;
    }

    public function show(Currency $currency)
    {
        return $currency->makeVisibleAll();
    }

    public function store(StoreUpdateCurrency $request, CurrencyRepository $repository)
    {
        $repository->create($request->validated());

        return $this->response(__('Currency successfully created.'));
    }

    public function update(StoreUpdateCurrency $request, Currency $currency, CurrencyRepository $repository)
    {
        $repository->update($currency, $request->validated());

        return $this->response(__('Currency successfully updated.'));
    }

    public function destroy(Currency $currency, CurrencyRepository $repository)
    {
        $repository->delete($currency);

        return $this->response(__('Currency successfully deleted.'));
    }
}
