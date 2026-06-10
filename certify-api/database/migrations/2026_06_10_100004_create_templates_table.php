<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->nullable()->constrained('organizations')->cascadeOnDelete();
            $table->string('name');
            $table->string('description')->nullable();
            $table->string('category')->default('completion'); // achievement/completion/participation/training
            $table->json('design_data')->nullable();
            $table->string('orientation')->default('landscape');
            $table->json('dimensions')->nullable();
            $table->string('language')->default('ar');
            $table->boolean('is_public')->default(false);
            $table->string('thumbnail_url')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('templates');
    }
};
