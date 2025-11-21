<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   PageController.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Http\Controllers;

use App\Helpers\GameManager;
use App\Helpers\PackageManager;
use App\Helpers\Utils;
use App\Models\Bet;
use App\Repositories\CurrencyRepository;
use App\Repositories\BonusRuleRepository;
use App\Repositories\PromoCodeRepository;
use App\Services\OauthService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

class PageController extends Controller
{
    public function index(
        Request $request,
        OauthService $OAuthService,
        PackageManager $packageManager,
        GameManager $gameManager,
        string $path = NULL
    )
    {
        $publicDisk = Storage::disk('public');

        $store = [
            'config' => array_merge_recursive(
                $this->mapConfigVariables('app', ['name', 'version', 'logo', 'banner', 'url', 'locale', 'default_locale', 'translation_files_folder']),
                $this->mapConfigVariables('broadcasting', ['default', 'connections.reverb.key', 'connections.reverb.options.host', 'connections.reverb.options.port', 'connections.reverb.options.scheme', 'connections.reverb.options.useTLS', 'connections.pusher.key', 'connections.pusher.options.cluster']),
                $this->mapConfigVariables('settings', ['template', 'theme', 'kyc.enabled', 'kyc.pages', 'interface', 'content', 'format', 'games', 'bonuses', 'vip', 'tips', 'affiliate', 'users', 'bet_stream.display_count', 'bet_stream.big_bet_threshold']),
                ['settings' => ['promo_codes' => ['enabled' => (new PromoCodeRepository)->countEnabled() > 0]]],
                $this->mapConfigVariables('services', ['support_chat', 'recaptcha.public_key', 'recaptcha.version', 'postaffiliatepro.script.id', 'postaffiliatepro.script.url', 'postaffiliatepro.signup_action_code', 'amcharts.license']),
                ['auth' => [
                    'web3' => collect(config('auth.web3'))
                        ->filter(function ($provider) {
                            return $provider['enabled'];
                        })
                    ]
                ],
                ['oauth' => $OAuthService->getEnabled(['client_id', 'mdi', 'image'])],
            ),
            'user' => $request->user()?->profile,
            'models' => [
                'currencies' => (new CurrencyRepository)->all(),
                'bonus_rules' => (new BonusRuleRepository)->all(),
            ],
            'assets' => [
                'deck' =>  config('settings.games.playing_cards.deck')
                    ? collect(Storage::disk('assets')->files(sprintf('images/games/playing-cards/%s', config('settings.games.playing_cards.deck'))))
                        ->map(function ($path) {
                            return url($path);
                        })
                        ->toArray()
                    : []
            ],
            'routes' => $this->getRoutes(),
            'content' => [
                'home' => $this->getFileContents(sprintf('html/home-%s.html', config('settings.template'))),
                'footer' => $this->getFileContents(sprintf('html/footer-%s.html', config('settings.template'))),
            ]
        ];

        
        $store['config']['app']['locales'] = collect(config('app.locales'))
            ->filter(function ($locale, $code) {
                return Storage::disk('resources')->exists('lang/' . $code . '.json');
            })
            ->map(function ($locale, $code) {
                return array_merge(['code' => $code], $locale);
            })
            ->sortBy('code');

        
        $enabledPackages = $packageManager->getEnabled()->toArray();

        $store['packages'] = collect($enabledPackages)
            ->mapWithKeys(function ($package, $key) {
                return [
                    $key => [
                        'id' => $package->id,
                        'type' => $package->type,
                        'name' => __($package->name)
                    ]
                ];
            })
            ->toArray();

        $store['originalGames'] = $gameManager->all()->values();

        if (app()->bound('Packages\GameProviders\Services\GameProviderManager')) {
            $gameProviderManager = app('Packages\GameProviders\Services\GameProviderManager');
            $store['providerGames'] = $gameProviderManager->getGames();
            $store['featuredCategories'] = $gameProviderManager->getFeaturedCategories();
        } else {
            $store['providerGames'] = [];
            $store['featuredCategories'] = [];
        }

        $store['message'] = [
            'type' => session()->pull('type', $request->query('messageType')),
            'text' => session()->pull('text', base64_decode(rawurldecode($request->query('messageText', '')))),
        ];

        
        foreach ($packageManager->getEnabled() as $package) {
            $packageConfig = [];

            
            if ($publicVariables = config($package->id . '.public_variables')) {
                collect($publicVariables)
                    ->push('live')
                    ->each(function ($key) use ($package, &$packageConfig) {
                        
                        data_fill($packageConfig, $key, config($package->id . '.' . $key));
                    });
            } else {
                $packageConfig = config($package->id);
            }

            
            if (isset($packageConfig['variations'])) {
                collect($packageConfig['variations'])->each(function ($variation) {
                    $variation->_title = __($variation->title);
                });
            }

            $store['config'][$package->id] = $packageConfig;
        }

        $stylesheets = collect(config('settings.theme.fonts'))
            ->values()
            ->map(fn($font) => $font['url'])
            ->filter()
            ->unique();

        if ($publicDisk->exists('css/style.css')) {
            $stylesheets->push(asset('storage/css/style.css'));
        }

        $javascript = null;
        if ($publicDisk->exists('js/script.html')) {
            $javascript = $publicDisk->get('js/script.html');
        }

        return view('index', [
            'store' => base64_encode(json_encode($store, JSON_NUMERIC_CHECK)),
            'stylesheets' => $stylesheets,
            'javascript' => $javascript,
        ]);
    }

    public function show(string $page)
    {
        $file = 'html/' . preg_replace('#[^a-z0-9-_]#i', '', $page) . '.html';

        
        $html = $this->getFileContents($file);

        return response()->json(['html' => Utils::renderHtml($html)]);
    }

    protected function getFileContents(string $file): string
    {
        return match (true) {
            Storage::disk('public')->exists($file) => Storage::disk('public')->get($file),
            Storage::disk('assets')->exists($file) => Storage::disk('assets')->get($file),
            default => '',
        };
    }

    public function makeManifestFile()
    {
        if (File::exists(public_path('custom/manifest.json'))) {
            return response()->json(json_decode(File::get(public_path('custom/manifest.json'))));
        }

        $manifest = [
            'name' => config('app.name'),
            'id'=> '/',
            'start_url' => '/',
            'theme_color' => '#000000',
            'background_color' => '#212121',
            'display' => 'fullscreen',
            'icons' => []
        ];

        foreach (['32x32', '192x192', '512x512'] as $size) {
            $favicon = config('settings.favicon.' . $size);

            if ($favicon) {
                $manifest['icons'][] = [
                    'src' => $favicon,
                    'sizes' => $size,
                    'type' => 'image/png',
                    'purpose' => 'any'
                ];
            }
        }

        return response()->json($manifest);
    }

    public function getBetCount()
    {
        return Bet::completed()->count();
    }

    public function getLatestBets()
    {
        return Cache::rememberForever('bets.latest', function () {
            return Bet::completed()
                ->orderBy('updated_at', 'desc')
                ->take(config('settings.bet_stream.display_count'))
                ->with('account', 'account.user')
                ->get()
                ->map
                ->toSafeArray();
        })->map(Closure::fromCallable([$this, 'calcUpdatedAgo']));
    }

    public function getBigBets()
    {
        return Cache::rememberForever('bets.big', function () {
            return Bet::completed()
                ->where('bet', '>=', config('settings.bet_stream.big_bet_threshold'))
                ->orderBy('updated_at', 'desc')
                ->take(config('settings.bet_stream.display_count'))
                ->with('account', 'account.user')
                ->get()
                ->map
                ->toSafeArray();
        })->map(Closure::fromCallable([$this, 'calcUpdatedAgo']));
    }

    public function getBiggestWin()
    {
        return Cache::remember('bets.biggest-win', now()->addHour(), function () {
            return Bet::with('account', 'account.user')
                ->completed()
                ->profitable()
                ->orderBy('win', 'desc')
                ->limit(1)
                ->first();
        });
    }

    public function getLastWin()
    {
        return Bet::with('account','account.user')
            ->completed()
            ->profitable()
            ->orderBy('id', 'desc')
            ->limit(1)
            ->first();
    }

    protected function getRoutes(): Collection
    {
        return collect(Route::getRoutes()->getRoutesByName()) 
            ->map(function ($route) {
                return '/' . $route->uri;
            })->filter(function ($url, $name) {
                return !str($name)->startsWith('ignition.');
            });
    }

    
    protected function mapConfigVariables ($key, $array)
    {
        $result = [];

        foreach ($array as $item) {
            data_set($result, $key . '.' . $item, data_get(config($key), $item));
        }

        return $result;
    }

    
    protected function calcUpdatedAgo (array $bet): array
    {
        $bet['updated_ago'] = Carbon::make($bet['updated_at'])->diffForHumans();
        return $bet;
    }
}
