<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ballots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('election_id')->constrained('elections')->cascadeOnDelete();
            $table->string('serial_number', 30);
            $table->string('qr_code_value', 100);
            $table->enum('status', ['issued', 'counted', 'duplicate_rejected', 'manual_review'])
                ->default('issued');
            $table->timestamp('generated_at')->useCurrent();
            $table->timestamps();

            $table->unique('serial_number');
            $table->unique('qr_code_value');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ballots');
    }
};
