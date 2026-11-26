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
            $table->foreignId('commissioner_user_id')
                ->nullable()
                ->after('commissioner')
                ->constrained('users')
                ->nullOnDelete();
        });

        DB::table('precincts')
            ->whereNotNull('commissioner')
            ->orderBy('id')
            ->each(function (object $precinct): void {
                $matchingUsers = DB::table('users')
                    ->where('role', 'committee_officer')
                    ->whereRaw('LOWER(TRIM(name)) = ?', [strtolower(trim($precinct->commissioner))])
                    ->pluck('id');

                if ($matchingUsers->count() === 1) {
                    DB::table('precincts')
                        ->where('id', $precinct->id)
                        ->update(['commissioner_user_id' => $matchingUsers->first()]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('precincts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('commissioner_user_id');
        });
    }
};