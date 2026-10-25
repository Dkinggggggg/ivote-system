<?php

namespace Tests\Feature;

use App\Models\Ballot;
use App\Models\Election;
use App\Models\User;
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
 * clause in BallotRepository::claimForCounting(). If this passes, the
 * guarantee holds no matter how many processes hit it concurrently,
 * because the database - not PHP's scheduling - is what serializes
 * the two claims.
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

        // Simulates two officers' requests both reaching the claim step
        // for the same ballot. Real concurrent requests would each run
        // this exact same query against the same row.
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

        $payload = [
            'election_id' => $election->id,
            'serial_number' => $ballot->serial_number,
            'decoded_via' => 'qr',
            'omr_confidence' => 0.95,
            'votes' => [],
        ];

        $first = $this->actingAs($officer, 'sanctum')->postJson('/api/scans', $payload);
        $second = $this->actingAs($officer, 'sanctum')->postJson('/api/scans', $payload);

        $first->assertStatus(201)->assertJsonPath('data.status', 'counted');
        $second->assertStatus(409)->assertJsonPath('data.status', 'duplicate_rejected');
    }
}
