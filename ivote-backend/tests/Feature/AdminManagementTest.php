<?php

namespace Tests\Feature;

use App\Models\Ballot;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\Position;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Covers the endpoints added in this upgrade pass: ballot generation,
 * user management, and BR-07 (committee officers are blocked from
 * admin-only actions).
 */
class AdminManagementTest extends TestCase
{
    use RefreshDatabase;

    private function tokenFor(User $user): string
    {
        return $user->issueApiToken();
    }

    public function test_admin_can_generate_ballots_for_an_election(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $election = Election::factory()->create(['created_by' => $admin->id]);

        $response = $this->withToken($this->tokenFor($admin))
            ->postJson('/api/ballots/generate', [
                'election_id' => $election->id,
                'quantity' => 5,
                'program' => 'BSIT',
                'year_level' => '2nd Year',
            ]);

        $response->assertStatus(201);
        $this->assertCount(5, $response->json('data'));
        $this->assertDatabaseCount('ballots', 5);
        $this->assertDatabaseHas('ballots', [
            'election_id' => $election->id,
            'program' => 'BSIT',
            'year_level' => '2nd Year',
            'serial_number' => '010020001',
        ]);
        $this->assertDatabaseHas('ballots', ['serial_number' => '010020005']);
    }

    public function test_committee_officer_cannot_generate_ballots(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $officer = User::factory()->create(['role' => 'committee_officer']);
        $election = Election::factory()->create(['created_by' => $admin->id]);

        $response = $this->withToken($this->tokenFor($officer))
            ->postJson('/api/ballots/generate', [
                'election_id' => $election->id,
                'quantity' => 5,
            ]);

        $response->assertStatus(403);
    }

    public function test_admin_can_create_a_user(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->withToken($this->tokenFor($admin))
            ->postJson('/api/users', [
                'name' => 'New Officer',
                'email' => 'new.officer@ivote.com',
                'password' => 'password123',
                'role' => 'committee_officer',
            ]);

        $response->assertStatus(201)->assertJsonPath('data.email', 'new.officer@ivote.com');
        $this->assertDatabaseHas('users', ['email' => 'new.officer@ivote.com']);
    }

    public function test_admin_can_create_a_user_with_a_username(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->withToken($this->tokenFor($admin))
            ->postJson('/api/users', [
                'name' => 'New Username Officer',
                'username' => 'officer_bsit',
                'password' => 'password123',
                'role' => 'committee_officer',
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.username', 'officer_bsit');
        $this->assertDatabaseHas('users', [
            'email' => 'officer_bsit',
            'name' => 'New Username Officer',
        ]);
    }

    public function test_user_can_log_in_with_a_username(): void
    {
        User::factory()->create([
            'email' => 'officer_bsit',
            'password' => bcrypt('password123'),
            'role' => 'committee_officer',
        ]);

        $response = $this->postJson('/api/login', [
            'username' => 'officer_bsit',
            'password' => 'password123',
            'role' => 'committee_officer',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.role', 'committee_officer')
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'role']]);
    }

    public function test_report_totals_are_scoped_to_the_selected_election(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $electionA = Election::factory()->create(['title' => 'Election A', 'created_by' => $admin->id]);
        $electionB = Election::factory()->create(['title' => 'Election B', 'created_by' => $admin->id]);

        Ballot::factory()->count(2)->create([
            'election_id' => $electionA->id,
            'status' => 'counted',
        ]);

        Ballot::factory()->create([
            'election_id' => $electionA->id,
            'status' => 'duplicate_rejected',
        ]);

        Ballot::factory()->create([
            'election_id' => $electionB->id,
            'status' => 'counted',
        ]);

        $response = $this->withToken($this->tokenFor($admin))
            ->getJson('/api/reports/winners?election_id=' . $electionA->id);

        $response->assertOk()
            ->assertJsonPath('total_ballots', 3)
            ->assertJsonPath('valid_ballots', 2)
            ->assertJsonPath('invalid_ballots', 1);
    }

    public function test_official_winners_match_public_counts_for_multi_seat_positions_and_ties(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $election = Election::factory()->create(['created_by' => $admin->id]);
        $position = Position::factory()->create([
            'election_id' => $election->id,
            'name' => 'Senators',
            'vote_for_count' => 2,
        ]);

        $candidates = collect(['Alex First', 'Casey Second', 'Morgan Second', 'Taylor Fourth'])
            ->map(fn (string $name) => Candidate::factory()->create([
                'position_id' => $position->id,
                'name' => $name,
            ]));

        $recordVotes = function (Candidate $candidate, int $count, string $scanStatus = 'counted') use ($admin, $election, $position): void {
            for ($index = 0; $index < $count; $index++) {
                $ballot = Ballot::factory()->create([
                    'election_id' => $election->id,
                    'status' => $scanStatus,
                ]);
                $scanId = DB::table('ballot_scans')->insertGetId([
                    'ballot_id' => $ballot->id,
                    'scanned_by' => $admin->id,
                    'status' => $scanStatus,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                DB::table('votes')->insert([
                    'ballot_scan_id' => $scanId,
                    'position_id' => $position->id,
                    'candidate_id' => $candidate->id,
                    'is_abstain' => false,
                ]);
            }
        };

        $recordVotes($candidates[0], 3);
        $recordVotes($candidates[1], 2);
        $recordVotes($candidates[2], 2);
        $recordVotes($candidates[3], 1);
        $recordVotes($candidates[3], 1, 'manual_review');

        $publicResults = $this->getJson('/api/elections/' . $election->id . '/public-results');
        $publicResults->assertOk();
        $publicCandidates = collect($publicResults->json('data.positions.0.candidates'))->keyBy('id');

        $report = $this->withToken($this->tokenFor($admin))
            ->getJson('/api/reports/winners?election_id=' . $election->id);

        $report->assertOk()
            ->assertJsonCount(3, 'results')
            ->assertJsonPath('results.0.winner', 'Alex First')
            ->assertJsonPath('results.0.standing', 1)
            ->assertJsonPath('results.1.winner', 'Casey Second')
            ->assertJsonPath('results.1.standing', 2)
            ->assertJsonPath('results.2.winner', 'Morgan Second')
            ->assertJsonPath('results.2.standing', 2);

        foreach ($report->json('results') as $winner) {
            $publicCandidate = $publicCandidates->firstWhere('name', $winner['winner']);
            $this->assertSame($winner['votes'], $publicCandidate['vote_count']);
        }
    }

    public function test_admin_can_finalize_results_and_public_results_use_the_saved_snapshot(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $election = Election::factory()->create([
            'created_by' => $admin->id,
            'status' => 'active',
        ]);
        $position = Position::factory()->create([
            'election_id' => $election->id,
            'name' => 'Governor - BSHM',
        ]);
        $candidate = Candidate::factory()->create([
            'position_id' => $position->id,
            'name' => 'Alex Winner',
        ]);
        $ballot = Ballot::factory()->create([
            'election_id' => $election->id,
            'status' => 'counted',
        ]);
        $scanId = DB::table('ballot_scans')->insertGetId([
            'ballot_id' => $ballot->id,
            'scanned_by' => $admin->id,
            'status' => 'counted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('votes')->insert([
            'ballot_scan_id' => $scanId,
            'position_id' => $position->id,
            'candidate_id' => $candidate->id,
            'is_abstain' => false,
        ]);

        $token = $this->tokenFor($admin);
        $response = $this->withToken($token)
            ->postJson('/api/elections/' . $election->id . '/finalize');

        $response->assertOk()
            ->assertJsonPath('data.status', 'closed')
            ->assertJsonPath('data.id', $election->id);
        $this->assertNotNull($response->json('data.finalized_at'));
        $this->assertDatabaseHas('elections', [
            'id' => $election->id,
            'status' => 'closed',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'FINALIZE_RESULTS',
        ]);

        $publicResults = $this->getJson('/api/elections/' . $election->id . '/public-results');
        $publicResults->assertOk()
            ->assertJsonPath('data.final_results.ballots_counted', 1)
            ->assertJsonPath('data.final_results.positions.0.candidates.0.vote_count', 1)
            ->assertJsonPath('meta.ballots_counted', 1);

        $finalizedAt = $response->json('data.finalized_at');
        $this->withToken($token)
            ->postJson('/api/elections/' . $election->id . '/finalize')
            ->assertJsonPath('data.finalized_at', $finalizedAt);
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'FINALIZE_RESULTS')->count());
    }

    public function test_committee_officer_cannot_finalize_results(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $officer = User::factory()->create(['role' => 'committee_officer']);
        $election = Election::factory()->create([
            'created_by' => $admin->id,
            'status' => 'active',
        ]);

        $this->withToken($this->tokenFor($officer))
            ->postJson('/api/elections/' . $election->id . '/finalize')
            ->assertForbidden();

        $this->assertNull($election->fresh()->finalized_at);
        $this->assertDatabaseMissing('audit_logs', ['action' => 'FINALIZE_RESULTS']);
    }

    public function test_scan_rejects_candidate_that_does_not_belong_to_the_selected_position(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $officer = User::factory()->create(['role' => 'committee_officer']);
        $election = Election::factory()->create(['created_by' => $admin->id]);

        $positionA = Position::factory()->create(['election_id' => $election->id, 'name' => 'President']);
        $positionB = Position::factory()->create(['election_id' => $election->id, 'name' => 'Vice President']);

        $candidateA = Candidate::factory()->create(['position_id' => $positionA->id, 'name' => 'Alice']);
        $candidateB = Candidate::factory()->create(['position_id' => $positionB->id, 'name' => 'Bob']);

        $ballot = Ballot::factory()->create([
            'election_id' => $election->id,
            'serial_number' => 'BAL-000001',
            'status' => 'issued',
        ]);

        $response = $this->withToken($this->tokenFor($officer))
            ->postJson('/api/scans', [
                'election_id' => $election->id,
                'serial_number' => $ballot->serial_number,
                'decoded_via' => 'qr',
                'omr_confidence' => 0.99,
                'image_path' => '/tmp/scan.jpg',
                'votes' => [[
                    'position_id' => $positionA->id,
                    'candidate_id' => $candidateB->id,
                    'is_abstain' => false,
                ]],
            ]);

        $response->assertStatus(422);
        $this->assertDatabaseMissing('ballot_scans', ['ballot_id' => $ballot->id]);
        $this->assertSame('issued', $ballot->fresh()->status);
    }

    public function test_committee_officer_can_scan_ballot_with_legacy_program_year_tags(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $officer = User::factory()->create(['role' => 'committee_officer']);
        $election = Election::factory()->create(['created_by' => $admin->id]);
        $ballot = Ballot::factory()->create([
            'election_id' => $election->id,
            'status' => 'issued',
        ]);
        DB::table('users')->where('id', $officer->id)->update([
            'program' => 'BSIT',
            'year_level' => '3rd Year',
        ]);
        DB::table('ballots')->where('id', $ballot->id)->update([
            'program' => 'BSE',
            'year_level' => '2nd Year',
        ]);

        $response = $this->withToken($this->tokenFor($officer))
            ->postJson('/api/scans', [
                'election_id' => $election->id,
                'serial_number' => $ballot->serial_number,
                'decoded_via' => 'qr',
                'omr_confidence' => 0.99,
                'votes' => [],
            ]);

        $response->assertCreated()->assertJsonPath('data.status', 'counted');
        $this->assertDatabaseHas('ballot_scans', ['ballot_id' => $ballot->id]);
        $this->assertSame('counted', $ballot->fresh()->status);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/users');

        $response->assertStatus(401);
    }
}
