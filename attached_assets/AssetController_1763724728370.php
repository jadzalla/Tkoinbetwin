<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   AssetController.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Http\Controllers;

use App\Exceptions\UserException;
use App\Http\Requests\GetAssetData;
use App\Models\Asset;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AssetController extends Controller
{
    public function index(Request $request)
    {
        $maxRank = (int) config('crypto-prediction.asset_max_rank');

        return Asset::active()
            ->when($maxRank > 0, function ($query) use ($maxRank) {
                $query->where('rank', '<=', $maxRank);
            })
            ->orderBy('rank')
            ->orderBy('name')
            ->get()
            ->map
            ->append('ws_url');
    }

    public function price(GetAssetData $request, Asset $asset)
    {
        $apiClass = sprintf('App\\Helpers\\Api\\%sApi', $asset->type_name);

        if ($price = app()->make($apiClass)->getPrice($asset)) {
            $asset->update(['price' => $price]);
        }

        return $asset->price;
    }

    public function history(GetAssetData $request, Asset $asset)
    {
        $apiClass = sprintf('App\\Helpers\\Api\\%sApi', $asset->type_name);

        throw_unless(app()->bound($apiClass), UserException::class, sprintf('%s API is not configured.', $asset->type_name));

        return app()->make($apiClass)->getHistory(
            $asset,
            Carbon::now()->subMinutes(30)->timestamp * 1000,
            Carbon::now()->timestamp * 1000
        );
    }

    public function search(Request $request)
    {
        $scopeMethod = strtolower($request->type);

        $whereClause = $request->exact
            ? ['name = ?', [$request->search]]
            : ['LOWER(name) LIKE ?', ['%' . strtolower($request->search) . '%']];

        $maxRank = (int) config( 'crypto-prediction.asset_max_rank');

        return Asset::active()
            ->$scopeMethod()
            ->whereRaw(...$whereClause)
            ->when($maxRank > 0, function ($query) use ($maxRank) {
                $query->where('rank', '<=', $maxRank);
            })
            ->orderBy('rank')
            ->orderBy('name')
            ->get();
    }
}
