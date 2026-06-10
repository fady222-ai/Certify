<?php

namespace App\Providers;

use App\Services\CertificateHasher;
use App\Services\CertificateIssuer;
use App\Services\CertificateRenderer;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(CertificateHasher::class);
        $this->app->singleton(CertificateRenderer::class);
        $this->app->singleton(CertificateIssuer::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
