<?php

use App\Jobs\LatencyTest;
use App\Lib\Helper;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    return view('welcome');
});

Route::get('/cost', function () {

    Log::info('cost');

    $result['version'] = env('LATENCY_VERSION', 1);

    try {
        $key = 'uploads/test-' . Helper::ms() . '.txt';
        Storage::put($key, "content");

        Cache::remember($key, 3600, function () {
            return microtime();
        });

        collect(['taylor', 'abigail', "null"])->map(function (string $name) {
            return strtoupper($name);
        })->reject(function (string $name) {
            return empty($name);
        });

        __('messages.welcome');

        LatencyTest::dispatchSync();

        app();
        config('null');
        session('key');
        request('null');
        url()->current();
        request()->validate([
            'title' => 'max:255',
        ]);
        env('APP_ENV');
        public_path();
        resource_path();

        Arr::accessible(['a' => 1, 'b' => 2]);
        Arr::accessible(new Collection);
        Arr::add(['name' => 'Desk'], 'price', 100);
        Route::currentRouteName();
        Crypt::encrypt("test");
        Hash::make("test");
        Request::getBaseUrl();
        DB::enableQueryLog();
        DB::getDatabaseName();

        Process::run('ls -la')->successful();

        RateLimiter::attempt(
            'send-message:RateLimiter',
            5,
            function () {
                return 'ok';
            }
        );

        Redis::set('name', 'Taylor');

        Http::timeout(1)->get('https://ip-ranges.amazonaws.com/ip-ranges.json');

        DB::raw(`show databases;`);
        DB::enableQueryLog();

        try {
            (new \Aws\Ecr\EcrClient([
                'region' => 'ap-southeast-1',
                'version' => 'latest',
            ]))->describeRepositories();
        } catch (Throwable $exception) {
        }

    } catch (Throwable $exception) {
        $result['error'] = $exception->getMessage();
    }

    $result['ms_from_app'] = Helper::ms() - Helper::ms(LARAVEL_START);
    $result['ms_from_request'] = Helper::ms() - Helper::ms(request('request_at', 0));

    if (opcache_get_status()) {
        $opcache_statistics = opcache_get_status()['opcache_statistics'];
        $result['num_cached_scripts'] = $opcache_statistics['num_cached_scripts'];
    }

    return $result;
});

Route::get('/phpinfo', function () {

    Log::info('phpinfo');

    return phpinfo();
});
