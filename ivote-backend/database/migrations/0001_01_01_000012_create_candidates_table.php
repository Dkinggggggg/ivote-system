<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('position_id')->constrained('positions')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('party', 100)->nullable();
            $table->string('photo_url', 255)->nullable();
            $table->unsignedTinyInteger('display_order')->default(0);
            $table->timestamps();

            $table->index('position_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidates');
    }
};
