<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   AccountController.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Http\Controllers\Admin;

use App\Helpers\Queries\AccountQuery;
use App\Helpers\Queries\AccountSummaryQuery;
use App\Helpers\Queries\AccountTransactionQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AccountCredit;
use App\Http\Requests\Admin\AccountDebit;
use App\Models\Account;
use App\Models\AccountTransaction;
use App\Models\GenericAccountTransaction;
use App\Repositories\AccountTransactionRepository;
use Illuminate\Support\Facades\Request;

class AccountController extends Controller
{
    public function index(AccountQuery $query)
    {
        return $query;
    }

    public function show(Account $account)
    {
        $account->makeVisibleAll()->user->makeVisibleAll();

        return compact('account');
    }

    
    public function debit(AccountDebit $request, Account $account)
    {
        AccountTransactionRepository::createGeneric($account, GenericAccountTransaction::TYPE_DEBIT, -$request->amount);

        return $this->response(__('Account successfully debited.'));
    }

    
    public function credit(AccountCredit $request, Account $account)
    {
        AccountTransactionRepository::createGeneric($account, GenericAccountTransaction::TYPE_CREDIT, $request->amount);

        return $this->response(__('Account successfully credited.'));
    }

    public function transactions(Request $request, AccountTransactionQuery $query, Account $account)
    {
        return $query->addWhere(['account_id', $account->id]);
    }

    public function summary(Request $request, AccountSummaryQuery $query, Account $account)
    {
        return $query->addWhere(['account_id', $account->id]);
    }
}
