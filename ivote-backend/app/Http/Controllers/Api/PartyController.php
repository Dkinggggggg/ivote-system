<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\Party;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PartyController extends Controller
{
    public function index(int $electionId)
    {
        Election::findOrFail($electionId);

        return response()->json([
            'data' => Party::where('election_id', $electionId)
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    public function store(Request $request, int $electionId)
    {
        Election::findOrFail($electionId);
        $request->merge(['name' => trim((string) $request->input('name'))]);
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('parties', 'name')->where('election_id', $electionId),
            ],
        ]);

        $party = Party::create($validated + ['election_id' => $electionId]);

        return response()->json(['data' => $party], 201);
    }

    public function update(Request $request, int $electionId, int $id)
    {
        $party = Party::where('election_id', $electionId)->findOrFail($id);
        $request->merge(['name' => trim((string) $request->input('name'))]);
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('parties', 'name')
                    ->where('election_id', $electionId)
                    ->ignore($party->id),
            ],
        ]);
        $oldName = $party->name;

        DB::transaction(function () use ($party, $oldName, $electionId, $validated): void {
            Candidate::where('party', $oldName)
                ->whereHas('position', fn ($query) => $query->where('election_id', $electionId))
                ->update(['party' => $validated['name']]);
            $party->update($validated);
        });

        return response()->json(['data' => $party->fresh()]);
    }

    public function destroy(int $electionId, int $id)
    {
        $party = Party::where('election_id', $electionId)->findOrFail($id);

        DB::transaction(function () use ($party, $electionId): void {
            Candidate::where('party', $party->name)
                ->whereHas('position', fn ($query) => $query->where('election_id', $electionId))
                ->update(['party' => null]);
            $party->delete();
        });

        return response()->noContent();
    }
}