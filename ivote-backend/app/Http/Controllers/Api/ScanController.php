<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreScanRequest;
use App\Models\AuditLog;
use App\Models\Ballot;
use App\Models\BallotScan;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\Vote;
use App\Repositories\Contracts\BallotRepositoryInterface;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ScanController extends Controller
{
    public function __construct(
        private readonly BallotRepositoryInterface $ballots
    ) {
    }

    public function store(StoreScanRequest $request)
    {
        $data = $request->validated();

        return DB::transaction(function () use ($request, $data) {
            $election = Election::query()
                ->lockForUpdate()
                ->find($data['election_id']);

            if (! $election || $election->finalized_at) {
                return response()->json([
                    'message' => 'This election has finalized results and is not accepting scans.',
                ], Response::HTTP_CONFLICT);
            }

            return $this->processScan($request, $data);
        });
    }

    private function processScan(StoreScanRequest $request, array $data)
    {
        $officer = $request->user();

        foreach ($data['votes'] as $vote) {
            if (! ($vote['is_abstain'] ?? false)) {
                $candidateBelongsToPosition = Candidate::where('id', $vote['candidate_id'])
                    ->where('position_id', $vote['position_id'])
                    ->exists();

                if (! $candidateBelongsToPosition) {
                    return response()->json([
                        'message' => 'Each selected candidate must belong to the submitted position.',
                    ], Response::HTTP_UNPROCESSABLE_ENTITY);
                }
            }
        }

        if (empty($data['serial_number'])) {
            return $this->recordManualReview($officer->id, null, $data);
        }

        $ballot = $this->ballots->findBySerial($data['serial_number']);

        if (! $ballot || $ballot->election_id !== (int) $data['election_id']) {
            return response()->json([
                'message' => 'This serial number does not match a ballot issued for this election.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($ballot->status !== 'issued') {

            Log::info('Duplicate scan attempt', [
                'ballot_id' => $ballot->id,
                'officer_id' => $officer->id,
            ]);

            return response()->json([
                'message' => 'This ballot has already been processed.',
                'data' => [
                    'status' => 'duplicate_rejected'
                ],
            ], Response::HTTP_CONFLICT);
        }

        if ($data['omr_confidence'] < 0.85) {
            return $this->recordManualReview(
                $officer->id,
                $ballot->id,
                $data
            );
        }

        $claimed = $this->ballots->claimForCounting($ballot);

        if (! $claimed) {

            return response()->json([
                'message' => 'This ballot was just counted by another device.',
                'data' => [
                    'status' => 'duplicate_rejected'
                ],
            ], Response::HTTP_CONFLICT);
        }

        $scan = DB::transaction(function () use (
            $ballot,
            $officer,
            $data
        ) {

            $scan = BallotScan::create([
                'ballot_id' => $ballot->id,
                'scanned_by' => $officer->id,
                'image_path' => $data['image_path'] ?? null,
                'ocr_result' => $data['serial_number'],
                'omr_confidence' => $data['omr_confidence'],
                'status' => 'counted',
            ]);

            foreach ($data['votes'] as $vote) {

                Vote::create([
                    'ballot_scan_id' => $scan->id,
                    'position_id' => $vote['position_id'],
                    'candidate_id' => $vote['is_abstain']
                        ? null
                        : $vote['candidate_id'],
                    'is_abstain' => $vote['is_abstain'],
                ]);
            }

            AuditLog::create([
                'user_id' => $officer->id,
                'action' => 'ballot_scanned',
                'description' => "Ballot {$ballot->serial_number} counted.",
                'ip_address' => request()->ip(),
            ]);

            return $scan;
        });

        return response()->json([
            'data' => [
                'status' => 'counted',
                'scan_id' => $scan->id,
            ],
        ], Response::HTTP_CREATED);
    }

    /**
     * Recent Scanner Activity
     */
    public function recent()
    {
        $scans = BallotScan::with([
            'ballot.election',
            'scannedBy'
        ])
            ->latest('scanned_at')
            ->limit(50)
            ->get()
            ->map(function (BallotScan $scan) {

                return [

                    'id' => $scan->id,

                    'officer_name' =>
                        $scan->scannedBy?->name ?? 'Unknown',

                    'serial_number' =>
                        $scan->ballot?->serial_number
                        ?? $scan->ocr_result,

                    'election' =>
                        $scan->ballot?->election?->title,

                    'status' =>
                        $scan->status,

                    'confidence' =>
                        $scan->omr_confidence,

                    'scanned_at' =>
                        $scan->scanned_at?->toIso8601String(),

                ];
            });

        return response()->json([
            'data' => $scans
        ]);
    }

    /**
     * Manual Review
     */
    private function recordManualReview(
        int $officerId,
        ?int $ballotId,
        array $data
    ) {

        if ($ballotId) {

            Ballot::where('id', $ballotId)
                ->where('status', 'issued')
                ->update([
                    'status' => 'manual_review'
                ]);
        }

        $scan = BallotScan::create([
            'ballot_id' => $ballotId,
            'scanned_by' => $officerId,
            'image_path' => $data['image_path'] ?? null,
            'ocr_result' => $data['serial_number'] ?? null,
            'omr_confidence' => $data['omr_confidence'],
            'status' => 'manual_review',
        ]);

        AuditLog::create([
            'user_id' => $officerId,
            'action' => 'ballot_flagged_for_review',
            'description' => 'Low confidence or unreadable serial number.',
            'ip_address' => request()->ip(),
        ]);

        return response()->json([
            'data' => [
                'status' => 'manual_review',
                'scan_id' => $scan->id,
            ],
        ], Response::HTTP_CREATED);
    }
}