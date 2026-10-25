<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DeleteBallotsRequest;
use App\Http\Requests\GenerateBallotsRequest;
use App\Http\Resources\BallotResource;
use App\Models\AuditLog;
use App\Models\Ballot;
use App\Repositories\Contracts\BallotRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class BallotController extends Controller
{
    public function __construct(
        private readonly BallotRepositoryInterface $ballots
    ) {
    }

    public function index()
    {
        return BallotResource::collection($this->ballots->all());
    }

    public function generate(GenerateBallotsRequest $request)
    {
        $data = $request->validated();

        $ballots = $this->ballots->generateForElection(
            $data['election_id'],
            $data['quantity'],
            $data['program'],
            $data['year_level']
        );

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'Generate Ballots',
            'description' => "Generated {$data['quantity']} ballot(s) for election #{$data['election_id']}.",
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Ballots generated successfully.',
            'data' => BallotResource::collection($ballots),
        ], Response::HTTP_CREATED);
    }

    public function show(string|int $id, Request $request)
    {
        if ($id === 'print-next-batch') {
            return $this->printNextBatch($request);
        }

        $ballot = $this->ballots->find($id);

        abort_if(
            ! $ballot,
            Response::HTTP_NOT_FOUND,
            'Ballot not found.'
        );

        return new BallotResource(
            $ballot->load('election.positions.candidates')
        );
    }

    /**
     * Print First N Ballots
     */
    public function printByQuantity(int $quantity)
    {
        $ballots = Ballot::with('election.positions.candidates')
            ->orderBy('generated_at', 'asc')
            ->take($quantity)
            ->get();

        return response()->json([
            'data' => BallotResource::collection($ballots),
        ]);
    }

    public function printSelected(Request $request)
    {
        $ids = $request->query('ids');

        if (blank($ids)) {
            return response()->json([
                'data' => [],
            ]);
        }

        $orderedIds = array_values(array_filter(array_map('intval', explode(',', $ids))));

        if ($orderedIds === []) {
            return response()->json([
                'data' => [],
            ]);
        }

        $ballots = Ballot::with('election.positions.candidates')
            ->whereIn('id', $orderedIds)
            ->get()
            ->sortBy(fn ($ballot) => array_search($ballot->id, $orderedIds, true))
            ->values();

        return response()->json([
            'data' => BallotResource::collection($ballots),
        ]);
    }

    public function printNextBatch(Request $request)
    {
        $validated = $request->validate([
            'election_id' => ['required', 'integer', 'exists:elections,id'],
            'batch_size' => ['required', 'integer', 'min:1', 'max:100'],
            'program' => ['required', 'in:BSIT,BSHM,BSE,BTVTED,BINDTECH'],
            'year_level' => ['required', 'in:2nd Year,3rd Year,4th Year'],
        ]);

        $ballots = $this->ballots->nextUnprintedForElection(
            $validated['election_id'],
            $validated['batch_size'],
            $validated['program'],
            $validated['year_level']
        );

        if ($ballots->isEmpty()) {
            $ballots = $this->ballots->generateForElection(
                $validated['election_id'],
                $validated['batch_size'],
                $validated['program'],
                $validated['year_level']
            );

            $ballots->load('election.positions.candidates');

            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'Generate Ballots For Printing',
                'description' => "Generated {$validated['batch_size']} ballot(s) for election #{$validated['election_id']}.",
                'ip_address' => $request->ip(),
            ]);
        }

        return response()->json([
            'data' => BallotResource::collection($ballots),
        ]);
    }

    public function markPrinted(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['integer', 'distinct', 'exists:ballots,id'],
        ]);

        return response()->json([
            'printed' => $this->ballots->markPrinted($validated['ids']),
        ]);
    }

    /**
     * Public QR Verification
     */
    public function verify(string $serialNumber)
    {
        $ballot = Ballot::with('election')
            ->where('serial_number', $serialNumber)
            ->first();

        abort_if(
            ! $ballot,
            Response::HTTP_NOT_FOUND,
            'Ballot not found.'
        );

        return response()->json([
            'data' => [
                'serial_number' => $ballot->serial_number,
                'status' => $ballot->status,
                'generated_at' => $ballot->generated_at,
                'election' => $ballot->election?->title,
            ],
        ]);
    }

    public function destroy(int $id)
    {
        $ballot = $this->ballots->find($id);

        abort_if(
            ! $ballot,
            Response::HTTP_NOT_FOUND,
            'Ballot not found.'
        );

        $serial = $ballot->serial_number;

        $this->ballots->delete($ballot);

        AuditLog::create([
            'user_id' => auth()->id(),
            'action' => 'Delete Ballot',
            'description' => "Deleted ballot {$serial}.",
            'ip_address' => request()->ip(),
        ]);

        return response()->json(
            null,
            Response::HTTP_NO_CONTENT
        );
    }

    public function destroyMultiple(DeleteBallotsRequest $request)
    {
        $ids = $request->validated()['ids'];

        $deleted = $this->ballots->deleteMany($ids);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'Delete Multiple Ballots',
            'description' => "Deleted {$deleted} ballot(s).",
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => "{$deleted} ballot(s) deleted successfully.",
        ]);
    }
}