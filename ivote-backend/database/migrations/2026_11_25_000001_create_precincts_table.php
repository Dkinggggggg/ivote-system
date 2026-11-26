<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('precincts', function (Blueprint $table) {
            $table->id();
            $table->string('room', 150);
            $table->string('program', 100);
            $table->string('year_level', 20);
            $table->string('commissioner', 150);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('precincts');
    }
};