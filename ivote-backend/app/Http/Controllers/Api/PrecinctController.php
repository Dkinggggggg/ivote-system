<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Precinct;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PrecinctController extends Controller
{
    public function assigned(Request $request)
    {
        abort_if(
            $request->user()?->role !== 'committee_officer',
            Response::HTTP_FORBIDDEN,
            'Only committee officers can view their assigned precinct.'
        );

        $precinct = Precinct::where('commissioner_user_id', $request->user()->id)->first();

        return response()->json(['data' => $precinct]);
    }

    public function index()
    {
        $this->renumberPrecincts();

        return response()->json([
            'data' => Precinct::with('commissionerUser:id,name')->orderBy('precinct_number')->orderBy('id')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatedData($request);

        $precinct = DB::transaction(function () use ($validated) {
            $this->renumberPrecincts();

            $validated['commissioner'] = '';
            $validated['commissioner_user_id'] = null;
            $validated['precinct_number'] = (int) (Precinct::count() + 1);

            return Precinct::create($validated);
        });

        return response()->json(['data' => $precinct->load('commissionerUser:id,name')], 201);
    }

    public function update(Request $request, Precinct $precinct)
    {
        $validated = $this->validatedData($request);
        $precinct = DB::transaction(function () use ($precinct, $validated) {
            $precinct->update($validated);
            $precinct->refresh();

            if ($precinct->commissioner_user_id) {
                $this->syncOfficerAssignment($precinct->commissionerUser, $precinct);
            }

            return $precinct;
        });

        return response()->json(['data' => $precinct->fresh('commissionerUser:id,name')]);
    }

    public function updateCommissioner(Request $request, Precinct $precinct)
    {
        $validated = $request->validate([
            'commissioner_user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where('role', 'committee_officer'),
            ],
        ]);
        $precinct = DB::transaction(function () use ($precinct, $validated) {
            $precinct->refresh();
            $previousCommissioner = $precinct->commissionerUser;
            $commissioner = isset($validated['commissioner_user_id'])
                ? User::findOrFail($validated['commissioner_user_id'])
                : null;

            if ($previousCommissioner && $previousCommissioner->id !== $commissioner?->id) {
                $this->syncOfficerAssignment($previousCommissioner, null);
            }

            if ($commissioner) {
                $otherPrecincts = Precinct::where('commissioner_user_id', $commissioner->id)
                    ->where('id', '!=', $precinct->id)
                    ->get();

                foreach ($otherPrecincts as $otherPrecinct) {
                    $otherPrecinct->update([
                        'commissioner_user_id' => null,
                        'commissioner' => '',
                    ]);
                }
            }

            $precinct->update([
                'commissioner_user_id' => $commissioner?->id,
                'commissioner' => $commissioner?->name ?? '',
            ]);

            if ($commissioner) {
                $this->syncOfficerAssignment($commissioner, $precinct->fresh());
            }

            return $precinct;
        });

        return response()->json(['data' => $precinct->fresh('commissionerUser:id,name')]);
    }

    public function destroy(Precinct $precinct)
    {
        DB::transaction(function () use ($precinct): void {
            $precinct->refresh();
            if ($precinct->commissionerUser) {
                $this->syncOfficerAssignment($precinct->commissionerUser, null);
            }
            $precinct->delete();

            $this->renumberPrecincts();
        });

        return response()->noContent();
    }

    private function renumberPrecincts(): void
    {
        DB::transaction(function (): void {
            $precincts = Precinct::orderBy('id')->get();
            foreach ($precincts as $index => $precinct) {
                if ((int) $precinct->precinct_number !== $index + 1) {
                    $precinct->update(['precinct_number' => $index + 1]);
                }
            }
        });
    }

    private function validatedData(Request $request): array
    {
        $request->merge([
            'room' => trim((string) $request->input('room')),
            'program' => trim((string) $request->input('program')),
        ]);

        $validated = $request->validate([
            'room' => ['required', 'string', 'max:150'],
            'program' => ['required', 'string', 'max:100'],
            'year_levels' => ['required', 'array', 'min:1', 'max:4'],
            'year_levels.*' => ['required', 'string', 'distinct', 'in:1st Year,2nd Year,3rd Year'],
        ]);

        $validated['year_level'] = $validated['year_levels'][0];

        return $validated;
    }

    private function syncOfficerAssignment(User $user, ?Precinct $precinct): void
    {
        if (! $precinct) {
            $user->forceFill([
                'program' => null,
                'year_level' => null,
                'precinct' => null,
            ])->save();

            return;
        }

        $yearLevels = $precinct->year_levels ?? [$precinct->year_level];
        $yearLevelText = implode(', ', array_filter($yearLevels));

        $user->forceFill([
            'program' => $precinct->program,
            'year_level' => $yearLevelText,
            'precinct' => $precinct->program . ' - ' . $yearLevelText,
        ])->save();
    }
}