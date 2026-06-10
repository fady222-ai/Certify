<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificate_events', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('certificate_id')->constrained('certificates')->cascadeOnDelete();
            $table->string('event_type'); // issued/opened/downloaded/shared/added_to_linkedin/revoked
            $table->string('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->string('referrer')->nullable();
            $table->string('country')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['certificate_id', 'event_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificate_events');
    }
};
