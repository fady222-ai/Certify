<?php

use App\Http\Controllers\Api\VerificationController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public certificate verification (network-effect surface — no auth).
Route::get('/verify/{code}', [VerificationController::class, 'show'])
    ->name('api.verify');

Route::get('/health', fn () => response()->json(['status' => 'ok']));
