<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   BetController.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Http\Controllers\Admin;

use App\Helpers\Queries\BetQuery;
use App\Http\Controllers\Controller;

class BetController extends Controller
{
    public function index(BetQuery $query)
    {
        return $query;
    }
}
