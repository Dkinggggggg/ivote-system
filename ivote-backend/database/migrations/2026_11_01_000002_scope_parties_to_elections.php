<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('parties', function (Blueprint $table) {
            $table->dropUnique(['name']);
            $table->foreignId('election_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            $table->unique(['election_id', 'name']);
        });

        DB::table('parties')->orderBy('id')->get()->each(function ($party): void {
            $electionIds = DB::table('candidates')
                ->join('positions', 'positions.id', '=', 'candidates.position_id')
                ->where('candidates.party', $party->name)
                ->distinct()
                ->orderBy('positions.election_id')
                ->pluck('positions.election_id');

            if ($electionIds->isEmpty()) {
                return;
            }

            $firstElectionId = $electionIds->shift();
            DB::table('parties')->where('id', $party->id)->update(['election_id' => $firstElectionId]);

            foreach ($electionIds as $electionId) {
                DB::table('parties')->insert([
                    'election_id' => $electionId,
                    'name' => $party->name,
                    'created_at' => $party->created_at,
                    'updated_at' => $party->updated_at,
                ]);
            }
        });
    }

    public function down(): void
    {
        $keepIds = DB::table('parties')
            ->selectRaw('MIN(id) as id')
            ->groupBy('name')
            ->pluck('id');

        DB::table('parties')->whereNotIn('id', $keepIds)->delete();

        Schema::table('parties', function (Blueprint $table) {
            $table->dropUnique(['election_id', 'name']);
            $table->dropForeign(['election_id']);
            $table->dropColumn('election_id');
            $table->unique('name');
        });
    }
};