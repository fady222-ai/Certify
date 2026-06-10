<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificate_usage', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('month', 7); // YYYY-MM
            $table->unsignedInteger('certificates_issued')->default(0);
            $table->timestamps();

            $table->unique(['organization_id', 'month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificate_usage');
    }
};
