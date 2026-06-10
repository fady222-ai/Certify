<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->decimal('price_monthly', 8, 2)->default(0);
            $table->decimal('price_yearly', 8, 2)->default(0);
            $table->unsignedInteger('certificates_per_month')->default(10);
            $table->unsignedInteger('templates_limit')->nullable();
            $table->unsignedInteger('team_members_limit')->default(1);
            $table->json('features')->nullable();
            $table->boolean('has_api')->default(false);
            $table->boolean('has_white_label')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
