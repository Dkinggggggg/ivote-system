<?php

namespace Tests\Feature;

use App\Models\Candidate;
use App\Models\Election;
use App\Models\Party;
use App\Models\Position;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PartyAndElectionCandidateTest extends TestCase
{
    use RefreshDatabase;

    private function adminToken(): string
    {
        return User::factory()->create(['role' => 'admin'])->issueApiToken();
    }

    public function test_admin_can_manage_parties_and_renames_update_candidates(): void
    {
        $token = $this->adminToken();
        $election = Election::factory()->create();
        $otherElection = Election::factory()->create();
        $party = $this->withToken($token)
            ->postJson("/api/elections/{$election->id}/parties", ['name' => 'Unity Party'])
            ->assertCreated()
            ->json('data');

        $position = Position::factory()->create(['election_id' => $election->id]);
        $candidate = Candidate::create([
            'position_id' => $position->id,
            'name' => 'Avery Candidate',
            'party' => 'Unity Party',
        ]);

        $this->withToken($token)
            ->putJson("/api/elections/{$election->id}/parties/{$party['id']}", ['name' => 'Unity Coalition'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Unity Coalition');
        $this->assertDatabaseHas('candidates', ['id' => $candidate->id, 'party' => 'Unity Coalition']);

        $this->withToken($token)->deleteJson("/api/elections/{$election->id}/parties/{$party['id']}")->assertNoContent();
        $this->assertDatabaseHas('candidates', ['id' => $candidate->id, 'party' => null]);

        $this->withToken($token)
            ->getJson("/api/elections/{$otherElection->id}/parties")
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_admin_can_register_list_move_and_delete_election_candidates(): void
    {
        $token = $this->adminToken();
        $election = Election::factory()->create();
        $president = Position::factory()->create(['election_id' => $election->id, 'name' => 'President']);
        $senator = Position::factory()->create(['election_id' => $election->id, 'name' => 'Senator']);
        Party::create(['election_id' => $election->id, 'name' => 'Unity Party']);

        $candidate = $this->withToken($token)
            ->postJson("/api/elections/{$election->id}/candidates", [
                'name' => 'Avery Candidate',
                'party' => 'Unity Party',
                'position_id' => $president->id,
            ])
            ->assertCreated()
            ->json('data');

        $this->withToken($token)
            ->getJson("/api/elections/{$election->id}/candidates")
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Avery Candidate')
            ->assertJsonPath('data.0.position_name', 'President');

        $this->withToken($token)
            ->putJson("/api/elections/{$election->id}/candidates/{$candidate['id']}", [
                'name' => 'Avery Updated',
                'party' => 'Unity Party',
                'position_id' => $senator->id,
            ])
            ->assertOk()
            ->assertJsonPath('data.position_id', $senator->id);

        $this->withToken($token)
            ->deleteJson("/api/elections/{$election->id}/candidates/{$candidate['id']}")
            ->assertNoContent();
        $this->assertDatabaseMissing('candidates', ['id' => $candidate['id']]);
    }

    public function test_candidate_requires_a_registered_party_and_position_from_same_election(): void
    {
        $token = $this->adminToken();
        $election = Election::factory()->create();
        $otherElection = Election::factory()->create();
        $foreignPosition = Position::factory()->create(['election_id' => $otherElection->id]);

        $this->withToken($token)
            ->postJson("/api/elections/{$election->id}/candidates", [
                'name' => 'Avery Candidate',
                'party' => 'Unregistered Party',
                'position_id' => $foreignPosition->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['party', 'position_id']);
    }
}