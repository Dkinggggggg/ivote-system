<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('program', 20)->nullable()->after('role');
            $table->index(['role', 'program']);
        });

        Schema::table('ballots', function (Blueprint $table) {
            $table->string('program', 20)->nullable()->after('election_id');
            $table->index(['election_id', 'program']);
        });
    }

    public function down(): void
    {
        Schema::table('ballots', function (Blueprint $table) {
            $table->dropIndex(['ballots_election_id_program_index']);
            $table->dropColumn('program');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['users_role_program_index']);
            $table->dropColumn('program');
        });
    }
};