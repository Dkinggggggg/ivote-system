<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Ballot;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\Position;
use App\Models\PositionCategory;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function show(Request $request, string $type): StreamedResponse
    {
        return match ($type) {
            'results' => $this->resultsCsv($request),
            'audit'   => $this->auditCsv(),
            default   => abort(Response::HTTP_NOT_FOUND, 'Unknown report type.'),
        };
    }

    /**
     * REPORT PAGE
     */
    public function winners(Request $request)
    {
        $election = $this->getElection($request);
        $precinct = $request->query('precinct');
        $precinctAssignments = $this->precinctAssignments($precinct);
        PositionCategory::provisionDefaultsForElection($election->id);

        $positions = Position::with('category')
            ->where('election_id', $election->id)
            ->orderBy('category_id')
            ->orderBy('display_order')
            ->get();

        $results = [];

        foreach ($positions as $position) {
            array_push($results, ...$this->winnerRowsForPosition($position, $precinct, $precinctAssignments));
        }

        $electionBallots = Ballot::where('election_id', $election->id);
        $this->applyPrecinctScope($electionBallots, $precinct, $precinctAssignments);

        $totalBallots = $electionBallots->count();

        $validBallots = $electionBallots->clone()->where('status', 'counted')->count();

        $invalidBallots = $electionBallots->clone()->whereIn('status', [
            'duplicate_rejected',
            'manual_review',
        ])->count();

        return response()->json([
            'election'        => $election->title,
            'precinct'        => $precinct ?: 'All Precincts',
            'status'          => ucfirst($election->status),
            'total_ballots'   => $totalBallots,
            'valid_ballots'   => $validBallots,
            'invalid_ballots' => $invalidBallots,
            'results'         => $results,
        ]);
    }
    /**
     * DOWNLOAD CSV
     */
    private function resultsCsv(Request $request): StreamedResponse
    {
        $election = $this->getElection($request);
        $precinct = $request->query('precinct');
        $precinctAssignments = $this->precinctAssignments($precinct);
        PositionCategory::provisionDefaultsForElection($election->id);

        $positions = Position::with('category')
            ->where('election_id', $election->id)
            ->orderBy('category_id')
            ->orderBy('display_order')
            ->get();

        $electionBallots = Ballot::where('election_id', $election->id);
        $this->applyPrecinctScope($electionBallots, $precinct, $precinctAssignments);

        $totalBallots = $electionBallots->count();

        $validBallots = $electionBallots->clone()->where('status', 'counted')->count();

        $invalidBallots = $electionBallots->clone()->whereIn('status', [
            'duplicate_rejected',
            'manual_review',
        ])->count();

        return $this->streamCsv(
            'official-election-results.csv',
            function ($handle) use (
                $election,
                $precinct,
                $precinctAssignments,
                $positions,
                $totalBallots,
                $validBallots,
                $invalidBallots
            ) {

                fputcsv($handle, ['OFFICIAL ELECTION RESULTS']);
                fputcsv($handle, []);

                fputcsv($handle, ['Election', $election->title]);
                fputcsv($handle, ['Precinct', $precinct ?: 'All Precincts']);
                fputcsv($handle, ['Status', ucfirst($election->status)]);
                fputcsv($handle, []);

                fputcsv($handle, [
                    'Category',
                    'Position',
                    'Standing',
                    'Winner',
                    'Party',
                    'Votes'
                ]);

                foreach ($positions as $position) {
                    foreach ($this->winnerRowsForPosition($position, $precinct, $precinctAssignments) as $row) {
                        fputcsv($handle, [
                            $row['category'],
                            $row['position'],
                            $row['standing'] ?? '',
                            $row['winner'],
                            $row['party'],
                            $row['votes'],
                        ]);
                    }
                }

                fputcsv($handle, []);
                fputcsv($handle, ['Total Ballots', $totalBallots]);
                fputcsv($handle, ['Valid Ballots', $validBallots]);
                fputcsv($handle, ['Invalid Ballots', $invalidBallots]);
                fputcsv($handle, []);
                fputcsv($handle, ['Generated', now()->format('F d, Y h:i A')]);
            }
        );
    }

    private function winnerRowsForPosition(Position $position, ?string $precinct = null, array $precinctAssignments = []): array
    {
        $candidates = Candidate::where('position_id', $position->id)
            ->withCount([
                'votes as total_votes' => function ($query) use ($precinct, $precinctAssignments) {
                    $query->where('is_abstain', false)
                        ->whereHas('ballotScan', function ($q) use ($precinct, $precinctAssignments) {
                            $q->where('status', 'counted');

                            if ($precinct) {
                                $q->whereHas('ballot', function ($ballotQuery) use ($precinct, $precinctAssignments) {
                                    $this->applyPrecinctScope($ballotQuery, $precinct, $precinctAssignments);
                                });
                            }
                        });
                }
            ])
            ->orderByDesc('total_votes')
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();

        $candidatesWithVotes = $candidates
            ->filter(fn (Candidate $candidate) => (int) $candidate->total_votes > 0)
            ->values();

        if ($candidatesWithVotes->isEmpty()) {
            return [[
                'category' => $position->category?->name ?? 'Uncategorized',
                'position' => $position->name,
                'standing' => null,
                'winner' => 'No Winner',
                'party' => '-',
                'votes' => 0,
            ]];
        }

        $winningPlaces = min(
            max(1, (int) $position->vote_for_count),
            $candidatesWithVotes->count()
        );
        $cutoffVoteCount = (int) $candidatesWithVotes->get($winningPlaces - 1)->total_votes;
        $rows = [];
        $standing = 0;
        $previousVoteCount = null;

        foreach ($candidatesWithVotes as $index => $candidate) {
            $voteCount = (int) $candidate->total_votes;

            if ($index >= $winningPlaces && $voteCount < $cutoffVoteCount) {
                break;
            }

            if ($previousVoteCount !== $voteCount) {
                $standing = $index + 1;
            }

            $rows[] = [
                'category' => $position->category?->name ?? 'Uncategorized',
                'position' => $position->name,
                'standing' => $standing,
                'winner' => $candidate->name,
                'party' => $candidate->party ?? '-',
                'votes' => $voteCount,
            ];
            $previousVoteCount = $voteCount;
        }

        return $rows;
    }

    private function precinctAssignments(?string $precinct): array
    {
        if (! $precinct || $precinct === 'all') {
            return [];
        }

        return User::query()
            ->where('role', 'committee_officer')
            ->whereNotNull('program')
            ->whereNotNull('year_level')
            ->get(['role', 'program', 'year_level', 'precinct'])
            ->filter(fn (User $user) => $user->precinct === $precinct)
            ->map(fn (User $user) => [
                'program' => $user->program,
                'year_level' => $user->year_level,
            ])
            ->unique(fn (array $assignment) => $assignment['program'] . '|' . $assignment['year_level'])
            ->values()
            ->all();
    }

    private function applyPrecinctScope($query, ?string $precinct, array $precinctAssignments): void
    {
        if (! $precinct || $precinct === 'all') {
            return;
        }

        $query->where(function ($scope) use ($precinct, $precinctAssignments) {
            $scope->where('ballots.precinct', $precinct);

            if ($precinctAssignments !== []) {
                $scope->orWhere(function ($unassigned) use ($precinctAssignments) {
                    $unassigned->whereNull('ballots.precinct')
                        ->where(function ($assignments) use ($precinctAssignments) {
                            foreach ($precinctAssignments as $assignment) {
                                $assignments->orWhere(function ($pair) use ($assignment) {
                                    $pair->where('ballots.program', $assignment['program'])
                                        ->where('ballots.year_level', $assignment['year_level']);
                                });
                            }
                        });
                });
            }
        });
    }

    /**
     * GET SELECTED ELECTION
     */
    private function getElection(Request $request): Election
    {
        if ($request->filled('election_id')) {

            $election = Election::find($request->election_id);

            abort_if(!$election, 404, 'Election not found.');

            return $election;
        }

        return Election::where('status', 'active')->first()
            ?? Election::latest()->firstOrFail();
    }

    /**
     * AUDIT CSV
     */
    private function auditCsv(): StreamedResponse
    {
        $logs = AuditLog::with('user')->latest()->get();

        return $this->streamCsv('audit-report.csv', function ($handle) use ($logs) {

            fputcsv($handle, [
                'Time',
                'User',
                'Action',
                'Description',
                'IP Address'
            ]);

            foreach ($logs as $log) {

                fputcsv($handle, [
                    optional($log->created_at)->format('Y-m-d H:i:s'),
                    $log->user?->name ?? 'System',
                    $log->action,
                    $log->description,
                    $log->ip_address,
                ]);
            }
        });
    }

    /**
     * STREAM CSV
     */
    private function streamCsv(string $filename, callable $callback): StreamedResponse
    {
        return response()->streamDownload(function () use ($callback) {

            $handle = fopen('php://output', 'w');

            $callback($handle);

            fclose($handle);

        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }
}