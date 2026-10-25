<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ballots', function (Blueprint $table) {
            $table->timestamp('printed_at')->nullable()->after('generated_at');
            $table->index(['election_id', 'printed_at', 'serial_number']);
        });
    }

    public function down(): void
    {
        Schema::table('ballots', function (Blueprint $table) {
            $table->dropIndex(['ballots_election_id_printed_at_serial_number_index']);
            $table->dropColumn('printed_at');
        });
    }
};