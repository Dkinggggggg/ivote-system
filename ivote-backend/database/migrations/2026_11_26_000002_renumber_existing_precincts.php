<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $precinctIds = DB::table('precincts')->orderBy('id')->pluck('id');

        foreach ($precinctIds as $index => $precinctId) {
            DB::table('precincts')
                ->where('id', $precinctId)
                ->update(['precinct_number' => $index + 1]);
        }
    }

    public function down(): void
    {
    }
};
