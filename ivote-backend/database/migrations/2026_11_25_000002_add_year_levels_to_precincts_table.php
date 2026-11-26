<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('precincts', function (Blueprint $table) {
            $table->json('year_levels')->nullable()->after('year_level');
        });

        DB::table('precincts')
            ->select(['id', 'year_level'])
            ->orderBy('id')
            ->each(function (object $precinct): void {
                $yearLevels = array_values(array_filter(array_map('trim', explode(',', (string) $precinct->year_level))));

                if ($yearLevels !== []) {
                    DB::table('precincts')
                        ->where('id', $precinct->id)
                        ->update(['year_levels' => json_encode($yearLevels)]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('precincts', function (Blueprint $table) {
            $table->dropColumn('year_levels');
        });
    }
};