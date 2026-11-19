<?php

namespace Tests\Feature;

use App\Models\Ballot;
use App\Models\BallotScan;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\Position;
use App\Models\User;
use App\Models\Vote;
use App\Repositories\Eloquent\BallotRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * TC-07 / TC-15: Verifies BR-04 (a ballot can only ever be counted once)
 * holds even when two "requests" race to claim the same ballot.
 *
 * True simultaneous HTTP requests need a real running server and multiple
 * processes (see the companion k6 script, ivote_race_test.js, for that
 * end-to-end demonstration). This test instead proves the guarantee at
 * the level that actually provides it: the atomic SQL UPDATE...WHERE
 * clause in BallotRepository::claimForCounting().
 */
class BallotDuplicateScanTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_one_claim_succeeds_for_the_same_ballot(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $election = Election::factory()->create(['status' => 'active', 'created_by' => $admin->id]);

        $ballot = Ballot::factory()->create([
            'election_id' => $election->id,
            'status' => 'issued',
        ]);

        $repository = new BallotRepository();

        $firstClaimResult = $repository->claimForCounting($ballot->fresh());
        $secondClaimResult = $repository->claimForCounting($ballot->fresh());

        $this->assertTrue($firstClaimResult, 'The first claim should succeed.');
        $this->assertFalse($secondClaimResult, 'The second claim must fail - BR-04 violated otherwise.');

        $this->assertSame('counted', $ballot->fresh()->status);
        $this->assertSame(
            1,
            Ballot::where('id', $ballot->id)->where('status', 'counted')->count(),
            'Exactly one ballot row should end up counted, never zero or duplicated.'
        );
    }

    public function test_full_scan_endpoint_rejects_the_second_submission(): void
    {
        $officer = User::factory()->create(['role' => 'committee_officer']);
        $admin = User::factory()->create(['role' => 'admin']);
        $election = Election::factory()->create(['status' => 'active', 'created_by' => $admin->id]);
        $ballot = Ballot::factory()->create(['election_id' => $election->id, 'status' => 'issued']);

        $token = $officer->issueApiToken();

        $payload = [
            'election_id' => $election->id,
            'serial_number' => $ballot->serial_number,
            'decoded_via' => 'qr',
            'omr_confidence' => 0.95,
            'votes' => [],
        ];

        $headers = ['Authorization' => "Bearer {$token}"];

        $first = $this->withHeaders($headers)->postJson('/api/scans', $payload);
        $second = $this->withHeaders($headers)->postJson('/api/scans', $payload);

        $first->assertStatus(201)->assertJsonPath('data.status', 'counted');
        $second->assertStatus(409)->assertJsonPath('data.status', 'duplicate_rejected');
    }

    public function test_precinct_officer_can_scan_multiple_year_levels_within_the_same_precinct(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $officer = User::factory()->create([
            'role' => 'committee_officer',
            'program' => 'BSE',
            'year_level' => '2nd Year',
            'precinct' => 'Precinct 7',
        ]);

        $election = Election::factory()->create([
            'status' => 'active',
            'created_by' => $admin->id,
        ]);

        $secondYearBallot = Ballot::factory()->create([
            'election_id' => $election->id,
            'status' => 'issued',
            'program' => 'BSE',
            'year_level' => '2nd Year',
            'precinct' => 'Precinct 7',
        ]);

        $thirdYearBallot = Ballot::factory()->create([
            'election_id' => $election->id,
            'status' => 'issued',
            'program' => 'BSE',
            'year_level' => '3rd Year',
            'precinct' => 'Precinct 7',
        ]);

        $token = $officer->issueApiToken();

        $this->withToken($token)
            ->postJson('/api/scans', [
                'election_id' => $election->id,
                'serial_number' => $secondYearBallot->serial_number,
                'decoded_via' => 'qr',
                'omr_confidence' => 0.95,
                'votes' => [],
            ])
            ->assertCreated();

        $this->withToken($token)
            ->postJson('/api/scans', [
                'election_id' => $election->id,
                'serial_number' => $thirdYearBallot->serial_number,
                'decoded_via' => 'qr',
                'omr_confidence' => 0.95,
                'votes' => [],
            ])
            ->assertCreated();

        $this->assertSame(2, Ballot::where('precinct', 'Precinct 7')->where('status', 'counted')->count());
    }

    public function test_scan_is_rejected_after_results_are_finalized(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $officer = User::factory()->create(['role' => 'committee_officer']);
        $election = Election::factory()->create([
            'status' => 'active',
            'created_by' => $admin->id,
        ]);
        $ballot = Ballot::factory()->create([
            'election_id' => $election->id,
            'status' => 'issued',
        ]);

        $this->withToken($admin->issueApiToken())
            ->postJson('/api/elections/' . $election->id . '/finalize')
            ->assertOk();

        $this->withToken($officer->issueApiToken())
            ->postJson('/api/scans', [
                'election_id' => $election->id,
                'serial_number' => $ballot->serial_number,
                'decoded_via' => 'qr',
                'omr_confidence' => 0.99,
                'votes' => [],
            ])
            ->assertConflict();

        $this->assertSame('issued', $ballot->fresh()->status);
        $this->assertDatabaseMissing('ballot_scans', ['ballot_id' => $ballot->id]);
    }

    public function test_scan_rejects_overvoted_position_and_counts_valid_partial_and_blank_positions(): void
    {
        $officer = User::factory()->create(['role' => 'committee_officer']);
        $admin = User::factory()->create(['role' => 'admin']);
        $election = Election::factory()->create(['status' => 'active', 'created_by' => $admin->id]);
        $ballot = Ballot::factory()->create(['election_id' => $election->id, 'status' => 'issued']);

        $twoVotePosition = Position::factory()->create([
            'election_id' => $election->id,
            'vote_for_count' => 2,
        ]);
        $twelveVotePosition = Position::factory()->create([
            'election_id' => $election->id,
            'vote_for_count' => 12,
        ]);
        $blankPosition = Position::factory()->create([
            'election_id' => $election->id,
            'vote_for_count' => 1,
        ]);

        $overvoteCandidates = Candidate::factory()->count(3)->create(['position_id' => $twoVotePosition->id]);
        $validCandidates = Candidate::factory()->count(3)->create(['position_id' => $twelveVotePosition->id]);

        $votes = collect($overvoteCandidates)
            ->map(fn (Candidate $candidate) => [
                'position_id' => $twoVotePosition->id,
                'candidate_id' => $candidate->id,
                'is_abstain' => false,
            ])
            ->concat(collect($validCandidates)->map(fn (Candidate $candidate) => [
                'position_id' => $twelveVotePosition->id,
                'candidate_id' => $candidate->id,
                'is_abstain' => false,
            ]))
            ->push([
                'position_id' => $blankPosition->id,
                'candidate_id' => null,
                'is_abstain' => true,
            ])
            ->all();

        $this->withToken($officer->issueApiToken())
            ->postJson('/api/scans', [
                'election_id' => $election->id,
                'serial_number' => $ballot->serial_number,
                'decoded_via' => 'ocr',
                'omr_confidence' => 0.95,
                'votes' => $votes,
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'counted');

        $scanId = BallotScan::where('ballot_id', $ballot->id)->value('id');
        $this->assertSame(3, Vote::where('ballot_scan_id', $scanId)->count());
        $this->assertDatabaseMissing('votes', [
            'ballot_scan_id' => $scanId,
            'position_id' => $twoVotePosition->id,
        ]);
        $this->assertDatabaseMissing('votes', [
            'ballot_scan_id' => $scanId,
            'position_id' => $blankPosition->id,
        ]);
    }
}
