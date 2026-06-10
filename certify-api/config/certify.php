<?php

return [
    /*
     * Public base URL used to build certificate verification links.
     * e.g. https://verify.example.com  =>  https://verify.example.com/verify/{code}
     */
    'verify_base_url' => env('CERTIFY_VERIFY_BASE_URL', env('APP_URL', 'http://localhost')),

    /*
     * Browsershot / headless Chrome configuration.
     * When chrome_path is null, Browsershot relies on the bundled puppeteer Chrome.
     */
    'chrome_path' => env('CERTIFY_CHROME_PATH', '/root/.cache/puppeteer/chrome/linux-149.0.7827.22/chrome-linux64/chrome'),
    'node_binary' => env('CERTIFY_NODE_BINARY', '/opt/node22/bin/node'),
    'node_modules_path' => env('CERTIFY_NODE_MODULES_PATH'),  // null = base_path('node_modules')

    /*
     * Disk (filesystems.php) used to store generated certificate PDFs.
     * Use 's3'/'r2' in production; 'public' locally.
     */
    'storage_disk' => env('CERTIFY_STORAGE_DISK', 'public'),
];
