<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('positions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('election_id')->constrained('elections')->cascadeOnDelete();
            $table->string('name', 100);
            $table->unsignedTinyInteger('vote_for_count')->default(1);
            $table->unsignedTinyInteger('display_order')->default(0);
            $table->timestamps();

            $table->index('election_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('positions');
    }
};
