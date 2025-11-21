<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   VipController.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Http\Controllers;

use App\Models\RankGroup;
use App\Repositories\RankGroupRepository;
use App\Repositories\RankRepository;
use App\Repositories\XpTransactionRepository;
use Illuminate\Http\Request;

class VipController extends Controller
{
    public function index(Request $request, RankRepository $rankRepository, RankGroupRepository $rankGroupRepository, XpTransactionRepository $xpTransactionRepository)
    {
        $user = $request->user();
        $ranks = $rankRepository->all();

        $groups = $rankGroupRepository->all()->map(function (RankGroup $rankGroup) use ($ranks) {
            $rankGroup->min_xp = $ranks->where('rank_group_id', $rankGroup->id)->sortBy('min_xp')->first()?->min_xp ?? 0;
            $rankGroup->rank_count = $ranks->where('rank_group_id', $rankGroup->id)->count();
            $rankGroup->makeVisible(['min_xp', 'rank_count']);
            return $rankGroup;
        });

        $userRank = $user->rank;
        $nextUserRank = $ranks->where('min_xp', '>', $user->rank?->min_xp ?? 0)->first(); 
        $min = $userRank?->min_xp ?? 0;
        $max = $nextUserRank?->min_xp ?? $min;

        $xp = (float) $xpTransactionRepository->calculateXp($user);

        $progress = [
            'min' => $min,
            'max' => $max,
            'xp' => $xp,
            'pct' => $max > $min
                ? round((max($xp - $min, 0) / ($max - $min)) * 100, 2)
                : 100,
            'next_rank' => [
                'name' => $nextUserRank?->name,
            ]
        ];

        return compact('ranks', 'groups', 'progress');
    }
}
