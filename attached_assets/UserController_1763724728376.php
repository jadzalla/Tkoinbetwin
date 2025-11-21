<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   UserController.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Http\Controllers\Admin;

use App\Events\KycFailed;
use App\Events\KycPassed;
use App\Helpers\Queries\UserQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateUser;
use App\Mail\Message;
use App\Models\AffiliateCommission;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class UserController extends Controller
{
    public function index(UserQuery $query)
    {
        return $query;
    }

    public function show(User $user)
    {
        return [
            'user' => $user->loadMissing('rank')->makeVisibleAll(),
            'roles' => User::roles(),
            'kyc_statuses' => User::kycStatuses(),
            'permissions' => User::permissions(),
            'affiliate_commission_types' => AffiliateCommission::types(),
            'access_modes' => User::accessModes(),
        ];
    }

    public function update(UpdateUser $request, User $user)
    {
        foreach ($request->all() as $property => $value) {
            if ($property == 'password' && $value) {
                $user->password = Hash::make($value);
            } elseif ($property == 'avatar') {
                $user->avatar = Str::afterLast($request->avatar, '/');
            } elseif (Schema::hasColumn($user->getTable(), $property)) {
                $user->{$property} = $value;
            }
        }

        $user->save();

        if ($user->wasChanged('kyc_status') && $user->kyc_passed) {
            event(new KycPassed($user));
        } elseif ($user->wasChanged('kyc_status') && $user->kyc_failed) {
            event(new KycFailed($user));
        }

        return $this->response(__('User successfully updated.'));
    }

    
    public function destroy(Request $request, User $user)
    {
        
        if ($request->user()->id == $user->id) {
            abort(409, __('You can not delete currently logged user.'));
        }

        $user->delete();

        return $this->response(__('User successfully deleted.'));
    }

    
    public function mail(Request $request, User $user)
    {
        try {
            Mail::to($user)->send(new Message($user, $request->subject, $request->message));
        } catch (\Throwable $e) {
            Log::error($e->getMessage());
            abort(500, $e->getMessage());
        }

        return $this->response(__('Message is successfully sent.'));
    }

    public function search(Request $request)
    {
        return User::when(is_numeric($request->search), function ($query) use ($request) {
                $query->where('id', $request->search);
            })
            ->when(!is_numeric($request->search), function ($query) use ($request) {
                $query->whereRaw('LOWER(name) LIKE ?', ['%' . strtolower($request->search) . '%'])
                    ->orWhereRaw('LOWER(email) LIKE ?', ['%' . strtolower($request->search) . '%']);
            })
            ->orderBy('name')
            ->get();
    }
}
