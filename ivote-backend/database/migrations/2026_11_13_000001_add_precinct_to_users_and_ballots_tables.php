<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('precinct', 100)->nullable()->after('year_level');
            $table->index(['role', 'precinct']);
        });

        Schema::table('ballots', function (Blueprint $table) {
            $table->string('precinct', 100)->nullable()->after('year_level');
            $table->index(['election_id', 'precinct']);
        });
    }

    public function down(): void
    {
        Schema::table('ballots', function (Blueprint $table) {
            $table->dropIndex(['ballots_election_id_precinct_index']);
            $table->dropColumn('precinct');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['users_role_precinct_index']);
            $table->dropColumn('precinct');
        });
    }
};
