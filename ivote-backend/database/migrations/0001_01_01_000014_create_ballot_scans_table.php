<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ballot_scans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ballot_id')->nullable()->constrained('ballots')->cascadeOnDelete();
            $table->foreignId('scanned_by')->constrained('users')->restrictOnDelete();
            $table->string('image_path', 255)->nullable();
            $table->string('ocr_result', 30)->nullable();
            $table->decimal('omr_confidence', 4, 3)->nullable();
            $table->enum('status', ['counted', 'duplicate_rejected', 'manual_review', 'error']);
            $table->timestamp('scanned_at')->useCurrent();
            $table->timestamps();

            $table->index('ballot_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ballot_scans');
    }
};
