<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignUuid('template_id')->nullable()->constrained('templates')->nullOnDelete();
            $table->foreignUuid('batch_id')->nullable()->constrained('batches')->nullOnDelete();
            $table->string('recipient_name');
            $table->string('recipient_email')->nullable();
            $table->string('recipient_phone')->nullable();
            $table->string('course_name')->nullable();
            $table->date('issue_date');
            $table->date('expiry_date')->nullable();
            $table->json('custom_fields')->nullable();
            $table->string('status')->default('active'); // active/revoked/expired
            $table->string('verification_code')->unique();
            $table->string('verification_hash');
            $table->string('pdf_url')->nullable();
            $table->string('thumbnail_url')->nullable();
            $table->boolean('linkedin_added')->default(false);
            $table->unsignedInteger('opened_count')->default(0);
            $table->unsignedInteger('downloaded_count')->default(0);
            $table->unsignedInteger('shared_count')->default(0);
            $table->timestamp('revoked_at')->nullable();
            $table->string('revoked_reason')->nullable();
            $table->timestamps();

            $table->index('verification_code');
            $table->index(['organization_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificates');
    }
};
