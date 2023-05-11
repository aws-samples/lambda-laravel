<?php

if (isset($_ENV['PRELOAD_DISABLE']) && $_ENV['PRELOAD_DISABLE'] === 'true') {
    file_put_contents('php://stdout', "preload disabled" . PHP_EOL);
    return;
}

$list = [
    '/var/task/tests/',
    '/var/task/database/',
    '/var/task/vendor/bin/',
    '/var/task/storage/framework/views/',
];

$directory = new RecursiveDirectoryIterator('/var/task');
$fullTree = new RecursiveIteratorIterator($directory);
$phpFiles = new RegexIterator($fullTree, '/.+((?<!Test)+\.php$)/i', RegexIterator::GET_MATCH);

foreach ($phpFiles as $key => $file) {

    if (opcache_is_script_cached($file[0])) {
        continue;
    }

    $ignore = false;
    foreach ($list as $item) {
        if (str_contains($file[0], $item)) {
            $ignores[] = $file[0];
            $ignore = true;
            break;
        }
    }

    if ($ignore) {
        continue;
    }

    try {
        @opcache_compile_file($file[0]);
    } catch (Throwable $e) {
        $msg = $e->getMessage();
        file_put_contents('php://stdout', "preload failed $msg" . PHP_EOL);
    }

}
