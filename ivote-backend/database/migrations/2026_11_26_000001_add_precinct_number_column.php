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
            $table->unsignedInteger('precinct_number')->nullable()->after('commissioner_user_id');
        });

        $precinctIds = DB::table('precincts')->orderBy('id')->pluck('id');
        foreach ($precinctIds as $index => $precinctId) {
            DB::table('precincts')
                ->where('id', $precinctId)
                ->update(['precinct_number' => $index + 1]);
        }

        Schema::table('precincts', function (Blueprint $table) {
            $table->unique('precinct_number');
        });
    }

    public function down(): void
    {
        Schema::table('precincts', function (Blueprint $table) {
            $table->dropUnique(['precinct_number']);
            $table->dropColumn('precinct_number');
        });
    }
};
