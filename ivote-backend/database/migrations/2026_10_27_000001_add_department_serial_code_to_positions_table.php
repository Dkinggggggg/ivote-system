<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('positions', function (Blueprint $table) {
            $table->string('department_serial_code', 2)->nullable();
            $table->index(['election_id', 'department_serial_code']);
        });

        foreach (['BSIT' => '01', 'BSHM' => '02', 'BSE' => '03', 'BTVTED' => '04', 'BINDTECH' => '05'] as $department => $code) {
            DB::table('positions')
                ->where('name', 'Governor - ' . $department)
                ->update(['department_serial_code' => $code]);
        }
    }

    public function down(): void
    {
        Schema::table('positions', function (Blueprint $table) {
            $table->dropIndex(['election_id', 'department_serial_code']);
            $table->dropColumn('department_serial_code');
        });
    }
};
