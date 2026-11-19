<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parties', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            $table->timestamps();
        });

        DB::table('candidates')
            ->whereNotNull('party')
            ->distinct()
            ->pluck('party')
            ->each(function ($legacyName): void {
                $name = trim((string) $legacyName);

                if ($name === '') {
                    DB::table('candidates')->where('party', $legacyName)->update(['party' => null]);
                    return;
                }

                DB::table('parties')->insertOrIgnore([
                    'name' => $name,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                DB::table('candidates')->where('party', $legacyName)->update(['party' => $name]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('parties');
    }
};