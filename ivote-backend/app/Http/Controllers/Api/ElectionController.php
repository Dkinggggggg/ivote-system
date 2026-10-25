<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CandidateResource;
use App\Http\Requests\StoreElectionRequest;
use App\Http\Resources\ElectionResource;
use App\Models\AuditLog;
use App\Models\Ballot;
use App\Models\BallotScan;
use App\Models\Election;
use App\Models\Position;
use App\Models\Vote;
use App\Repositories\Contracts\ElectionRepositoryInterface;
use Illuminate\Http\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ElectionController extends Controller
{
    public function __construct(
        private readonly ElectionRepositoryInterface $elections
    ) {
    }

    public function index()
    {
        return ElectionResource::collection($this->elections->all());
    }

    public function store(StoreElectionRequest $request)
    {
        $data = $request->validated();
        $data['created_by'] = $request->user()->id;
        $data['status'] ??= 'draft';

        $election = $this->elections->create($data);
        Position::provisionDefaultsForElection($election->id);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'CREATE_ELECTION',
            'description' => 'Created election: ' . $election->title,
            'ip_address' => $request->ip(),
        ]);

        return (new ElectionResource($election))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(int $id)
    {
        $election = $this->elections->find($id);

        abort_if(
            ! $election,
            Response::HTTP_NOT_FOUND,
            'Election not found.'
        );

        return new ElectionResource(
            $election->load('positions.candidates')
        );
    }

    public function active()
    {
        $election = Election::where('status', 'active')->first();

        abort_if(
            ! $election,
            Response::HTTP_NOT_FOUND,
            'No active election found.'
        );

        return new ElectionResource(
            $election->load('positions.candidates')
        );
    }

    public function currentPublicResults()
    {
        $election = Election::where('status', 'active')->first()
            ?? Election::where('status', 'closed')->latest('updated_at')->first();

        abort_if(
            ! $election,
            Response::HTTP_NOT_FOUND,
            'No active or closed election found.'
        );

        return $this->publicResults($election->id);
    }

    /**
     * Public election data used by a shared results link. Keeping this
     * separate from show() means the normal election endpoint can remain
     * authenticated while visitors can open a copied public URL.
     */
    public function publicResults(int $id)
    {
        $election = $this->elections->find($id);

        abort_if(
            ! $election,
            Response::HTTP_NOT_FOUND,
            'Election not found.'
        );

        $countedBallots = $election->final_results['ballots_counted']
            ?? Ballot::where('election_id', $election->id)
                ->where('status', 'counted')
                ->count();

        return (new ElectionResource(
            $election->load('positions.candidates')
        ))->additional([
            'meta' => [
                'ballots_counted' => $countedBallots,
            ],
        ]);
    }

    public function results(int $id)
{
    $election = $this->elections->find($id);

    abort_if(
        ! $election,
        Response::HTTP_NOT_FOUND,
        'Election not found.'
    );

    // Vote totals for the selected election only
    $tally = Vote::query()
        ->selectRaw('votes.candidate_id, COUNT(*) as total_votes')
        ->join(
            'ballot_scans',
            'votes.ballot_scan_id',
            '=',
            'ballot_scans.id'
        )
        ->join(
            'ballots',
            'ballot_scans.ballot_id',
            '=',
            'ballots.id'
        )
        ->where('ballots.election_id', $election->id)
        ->where('ballot_scans.status', 'counted')
        ->where('votes.is_abstain', false)
        ->whereNotNull('votes.candidate_id')
        ->groupBy('votes.candidate_id')
        ->pluck('total_votes', 'votes.candidate_id')
        ->all();

    // Ballot statistics for the selected election only
    $issued = Ballot::where('election_id', $election->id)
        ->count();

    $counted = Ballot::where('election_id', $election->id)
        ->where('status', 'counted')
        ->count();

    $manualReview = Ballot::where('election_id', $election->id)
        ->where('status', 'manual_review')
        ->count();

    return response()->json([
        'data' => [
            'tally' => $tally,

            'ballotStats' => [
                'issued' => $issued,
                'counted' => $counted,
                'manualReview' => $manualReview,
            ],
        ],
    ]);
}

    public function update(StoreElectionRequest $request, int $id)
    {
        $election = $this->elections->find($id);

        abort_if(
            ! $election,
            Response::HTTP_NOT_FOUND,
            'Election not found.'
        );

        abort_if(
            $election->finalized_at,
            Response::HTTP_CONFLICT,
            'Finalized elections cannot be modified.'
        );

        $updated = $this->elections->update(
            $election,
            $request->validated()
        );

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'UPDATE_ELECTION',
            'description' => 'Updated election: ' . $updated->title,
            'ip_address' => $request->ip(),
        ]);

        return new ElectionResource($updated);
    }

    public function destroy(int $id)
    {
        $election = $this->elections->find($id);

        abort_if(
            ! $election,
            Response::HTTP_NOT_FOUND,
            'Election not found.'
        );

        abort_if(
            $election->finalized_at,
            Response::HTTP_CONFLICT,
            'Finalized elections cannot be deleted.'
        );

        $title = $election->title;

        $this->elections->delete($election);

        AuditLog::create([
            'user_id' => auth()->id(),
            'action' => 'DELETE_ELECTION',
            'description' => 'Deleted election: ' . $title,
            'ip_address' => request()->ip(),
        ]);

        return response()->json(
            null,
            Response::HTTP_NO_CONTENT
        );
    }
    /**
     * Activate an election.
     * Only one election can be active at a time.
     */
    public function activate(int $id)
    {
        $election = $this->elections->find($id);

        abort_if(
            ! $election,
            Response::HTTP_NOT_FOUND,
            'Election not found.'
        );

        abort_if(
            $election->finalized_at,
            Response::HTTP_CONFLICT,
            'Finalized elections cannot be activated.'
        );

        // Close all active elections
        Election::where('status', 'active')
            ->update([
                'status' => 'closed'
            ]);

        // Activate selected election
        $election->update([
            'status' => 'active'
        ]);

        // ==========================
        // AUDIT LOG
        // ==========================
        \App\Models\AuditLog::create([
            'user_id' => auth()->id(),
            'action' => 'Activate Election',
            'description' => 'Activated election: ' . $election->title,
            'ip_address' => request()->ip(),
        ]);

        return response()->json([
            'message' => 'Election activated successfully.'
        ]);
    }

    /**
     * Close an election.
     */
    public function close(int $id)
    {
        $election = $this->elections->find($id);

        abort_if(
            ! $election,
            Response::HTTP_NOT_FOUND,
            'Election not found.'
        );

        $election->update([
            'status' => 'closed'
        ]);

        // ==========================
        // AUDIT LOG
        // ==========================
        \App\Models\AuditLog::create([
            'user_id' => auth()->id(),
            'action' => 'Close Election',
            'description' => 'Closed election: ' . $election->title,
            'ip_address' => request()->ip(),
        ]);

        return response()->json([
            'message' => 'Election closed successfully.'
        ]);
    }

    public function finalize(Request $request, int $id)
    {
        $election = DB::transaction(function () use ($request, $id) {
            $election = Election::query()->lockForUpdate()->find($id);

            abort_if(
                ! $election,
                Response::HTTP_NOT_FOUND,
                'Election not found.'
            );

            if ($election->finalized_at) {
                return $election;
            }

            abort_if(
                $election->status === 'draft',
                Response::HTTP_UNPROCESSABLE_ENTITY,
                'Draft elections cannot be finalized.'
            );

            $election->load('positions.candidates');
            $finalizedAt = now();
            $finalResults = [
                'finalized_at' => $finalizedAt->toIso8601String(),
                'ballots_counted' => Ballot::where('election_id', $election->id)
                    ->where('status', 'counted')
                    ->count(),
                'positions' => $election->positions->map(function ($position) use ($request) {
                    return [
                        'id' => $position->id,
                        'name' => $position->name,
                        'vote_for_count' => $position->vote_for_count,
                        'display_order' => $position->display_order,
                        'candidates' => $position->candidates->map(function ($candidate) use ($request) {
                            $data = (new CandidateResource($candidate))->toArray($request);
                            $data['vote_count'] = $candidate->voteCount();

                            return $data;
                        })->values()->all(),
                    ];
                })->values()->all(),
            ];

            $election->forceFill([
                'status' => 'closed',
                'finalized_at' => $finalizedAt,
                'final_results' => $finalResults,
            ])->save();

            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'FINALIZE_RESULTS',
                'description' => sprintf(
                    'Finalized results for "%s" with %d counted ballots.',
                    $election->title,
                    $finalResults['ballots_counted']
                ),
                'ip_address' => $request->ip(),
            ]);

            return $election;
        });

        return response()->json([
            'message' => 'Election results finalized successfully.',
            'data' => [
                'id' => $election->id,
                'status' => $election->status,
                'finalized_at' => $election->finalized_at?->toIso8601String(),
            ],
        ]);
    }
}
