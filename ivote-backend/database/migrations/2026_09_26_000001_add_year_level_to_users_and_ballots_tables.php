<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('year_level', 20)->nullable()->after('program');
            $table->index(['role', 'program', 'year_level']);
        });

        Schema::table('ballots', function (Blueprint $table) {
            $table->string('year_level', 20)->nullable()->after('program');
            $table->index(['election_id', 'program', 'year_level']);
        });
    }

    public function down(): void
    {
        Schema::table('ballots', function (Blueprint $table) {
            $table->dropIndex(['ballots_election_id_program_year_level_index']);
            $table->dropColumn('year_level');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['users_role_program_year_level_index']);
            $table->dropColumn('year_level');
        });
    }
};