<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   AddonController.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Http\Controllers\Admin;

use App\Exceptions\ApiException;
use App\Facades\Manager;
use App\Helpers\PackageManager;
use App\Helpers\ReleaseManager;
use App\Helpers\Utils;
use App\Http\Controllers\Controller;
use App\Services\ArtisanService;
use App\Services\DotEnvService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

class AddonController extends Controller
{
    public function index(PackageManager $packageManager, ReleaseManager $releaseManager)
    {
        $releases = $releaseManager->getInfo();

        $checkSystemRequirements = function (array $requirements): Collection {
            return collect($requirements)
                ->reject(function ($requirement) {
                    if ($requirement->type == 'config') {
                        return collect($requirement->vars)
                            ->reduce(function ($carry, $value) {
                                return $carry && !!config($value);
                            }, TRUE);
                    } elseif ($requirement->type == 'php_ext') {
                        return extension_loaded($requirement->ext);
                    } elseif ($requirement->type == 'fn') {
                        return Utils::{$requirement->fn}();
                    } else {
                        return FALSE;
                    }
                })
                
                ->values();
        };


        $packages = collect($packageManager->getAll())
            ->each(function ($package) use ($releases, $checkSystemRequirements) {
                $release = data_get($releases, 'add-ons.' . $package->id);
                $package->update_available = $release && $package->enabled && version_compare($package->version, $release['version'], '<');
                $package->update_can_be_installed = $package->update_available && version_compare(config('app.version'), $release['min_app_version'], '>=');
                $package->missing_system_requirements = isset($package->system_requirements)
                    ? $checkSystemRequirements($package->system_requirements)
                    : collect();
            });

        return compact('releases', 'packages');
    }

    public function get(Request $request, PackageManager $packageManager, $packageId)
    {
        $package = $packageManager->get($packageId);

        abort_unless($package, 404);

        return [
            'package' => collect($package)->only(['id', 'name', 'extra']),
            'code' => env($packageManager->getCodeVariable($packageId . ($request->query('extra') ? '-' . $request->query('extra') : ''))),
        ];
    }

    
    public function disable($packageId, PackageManager $packageManager)
    {
        $package = $packageManager->get($packageId);

        abort_unless($package, 404);

        throw_unless(
            Storage::disk('local')->put('packages/' . $packageId . '/disabled', ''),
            ApiException::class,
            __('Could not disable the add-on. Please check that storage/app folder is writable.'),
            400
        );

        return $this->response(__('Add-on ":name" successfully disabled.', ['name' => $package->name]));
    }

    
    public function enable($packageId, PackageManager $packageManager)
    {
        $package = $packageManager->get($packageId);

        abort_unless($package, 404);

        throw_unless(
            Storage::disk('local')->delete('packages/' . $packageId . '/disabled'),
            ApiException::class,
            __('Could not enable the add-on. Please check that storage/app folder is writable.'),
            400
        );

        return $this->response(__('Add-on ":name" successfully enabled.', ['name' => $package->name]));
    }

    public function install($packageId, Request $request, PackageManager $packageManager, ReleaseManager $releaseManager, DotEnvService $dotEnvService)
    {
        set_time_limit(600);

        $releases = $releaseManager->getInfo();
        $package = $packageManager->get($packageId);

        abort_unless($package, 404);

        throw_unless(
            isset($releases['add-ons'][$package->id]),
            ApiException::class,
            __('Package ":id" can not be installed or upgraded.', ['id' => $packageId]),
            400
        );

        $extraId = $request->query('extra');
        $hash = isset($package->extra) && $extraId
            ? $package->extra->{$extraId}->hash
            : $package->hash;

        throw_unless(
            $hash,
            ApiException::class,
            __('There was an error while trying to install ":id" package.', ['id' => $packageId]),
            400
        );

        $response = Manager::download($request->code, env(FP_EMAIL), $hash, $releases['add-ons'][$package->id]['version']);

        
        throw_unless($response['success'], ApiException::class, $response['message'] ?? __('There was an error.'));

        $fullPackageId = $packageId . ($extraId ? '-' . $extraId : '');

        
        $dotEnvService->save([ $packageManager->getCodeVariable($fullPackageId) => $request->code, $packageManager->getHashVariable($fullPackageId) => $response['message'] ]);

        
        
        if (!$package->enabled) {
            $packageManager->load(base_path(sprintf('packages/%s/config.json', $package->id)));

            foreach ($package->providers as $provider) {
                app()->register($provider);
            }
        }

        
        ArtisanService::migrateAndSeed();
        
        ArtisanService::clearAllCaches();

        return $this->response(__('Add-on ":name" successfully installed or updated. Please check the add-on documentation to see if there are any extra steps required.', ['name' => $package->name]));
    }

    public function changelog($packageId)
    {
        $path = base_path('packages/' . $packageId . '/CHANGELOG.txt');

        return ['changelog' => File::exists($path) ? File::get($path) : __('No changelog found.')];
    }

    public function registerBundle(Request $request, PackageManager $packageManager, ReleaseManager $releaseManager, DotEnvService $dotEnvService)
    {
        $response = Manager::register($request->code, env(FP_EMAIL), NULL, TRUE);

        throw_unless($response['success'], ApiException::class, $response['message']);

        
        $dotEnvService->save(collect($response['message'])
            ->filter(function ($c, $h) use ($packageManager) {
                return !!$packageManager->get($h, 'hash');
            })
            ->mapWithKeys(function ($c, $h) use ($packageManager) {
                return [$packageManager->getCodeVariable($packageManager->get($h, 'hash')->id) => $c];
            })->toArray()
        );

        return $this->response(__('The bundle is successfully registered. Please install each add-on by clicking the "Install" button.'));
    }
}
