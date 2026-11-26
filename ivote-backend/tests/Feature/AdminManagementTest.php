<?php

namespace Tests\Feature;

use App\Models\Ballot;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\Precinct;
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

    public function test_admin_can_manage_precincts_with_generated_numbers(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $token = $this->tokenFor($admin);
        $commissioner = User::factory()->create([
            'name' => 'Alex Commissioner',
            'role' => 'committee_officer',
            'program' => null,
            'year_level' => null,
            'precinct' => null,
        ]);
        $precinctData = [
            'room' => 'Sci Building Room 202',
            'program' => 'BSIT',
            'year_levels' => ['2nd Year', '3rd Year'],
        ];

        $this->withToken($token)
            ->postJson('/api/precincts', array_replace($precinctData, [
                'room' => 'Invalid Year Room',
                'year_levels' => ['4th Year'],
            ]))
            ->assertUnprocessable();

        $created = $this->withToken($token)
            ->postJson('/api/precincts', $precinctData)
            ->assertCreated()
            ->assertJsonPath('data.room', $precinctData['room'])
            ->assertJsonPath('data.program', $precinctData['program'])
            ->assertJsonPath('data.year_levels', $precinctData['year_levels'])
            ->assertJsonPath('data.commissioner_user_id', null)
            ->assertJsonPath('data.precinct_number', 1);

        $precinctId = $created->json('data.id');
        $this->assertDatabaseHas('precincts', [
            'id' => $created->json('data.id'),
            'room' => $precinctData['room'],
        ]);

        $this->withToken($token)
            ->getJson('/api/precincts')
            ->assertOk()
            ->assertJsonPath('data.0.precinct_number', 1);

        $this->withToken($token)
            ->patchJson("/api/precincts/{$precinctId}/commissioner", [
                'commissioner_user_id' => $commissioner->id,
            ])
            ->assertOk()
            ->assertJsonPath('data.commissioner_user.name', 'Alex Commissioner')
            ->assertJsonPath('data.commissioner', 'Alex Commissioner');

        $this->assertDatabaseHas('users', [
            'id' => $commissioner->id,
            'program' => 'BSIT',
            'year_level' => '2nd Year, 3rd Year',
            'precinct' => 'BSIT - 2nd Year, 3rd Year',
        ]);

        $this->withToken($token)
            ->putJson("/api/precincts/{$precinctId}", array_replace($precinctData, [
                'room' => 'Science Room 202',
                'year_levels' => ['1st Year'],
            ]))
            ->assertOk()
            ->assertJsonPath('data.room', 'Science Room 202')
            ->assertJsonPath('data.year_levels', ['1st Year']);

        $this->assertDatabaseHas('users', [
            'id' => $commissioner->id,
            'program' => 'BSIT',
            'year_level' => '1st Year',
            'precinct' => 'BSIT - 1st Year',
        ]);

        $this->withToken($token)
            ->deleteJson("/api/precincts/{$precinctId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('precincts', ['id' => $precinctId]);
        $this->assertDatabaseHas('users', [
            'id' => $commissioner->id,
            'program' => null,
            'year_level' => null,
            'precinct' => null,
        ]);
    }

    public function test_admin_can_create_committee_officer_before_assigning_precinct(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $this->withToken($this->tokenFor($admin))
            ->postJson('/api/users', [
                'name' => 'Unassigned Officer',
                'username' => 'unassigned_officer',
                'email' => 'unassigned.officer@ivote.com',
                'role' => 'committee_officer',
            ])
            ->assertCreated()
            ->assertJsonPath('data.role', 'committee_officer')
            ->assertJsonPath('data.program', null)
            ->assertJsonPath('data.year_level', null);
    }

    public function test_next_precinct_starts_at_one_after_all_precincts_are_deleted(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $token = $this->tokenFor($admin);

        $first = $this->withToken($token)
            ->postJson('/api/precincts', [
                'room' => 'Room 101',
                'program' => 'BSIT',
                'year_levels' => ['1st Year'],
            ])
            ->assertCreated();

        $second = $this->withToken($token)
            ->postJson('/api/precincts', [
                'room' => 'Room 102',
                'program' => 'BSIT',
                'year_levels' => ['2nd Year'],
            ])
            ->assertCreated();

        $this->withToken($token)
            ->deleteJson('/api/precincts/' . $first->json('data.id'))
            ->assertNoContent();
        $this->withToken($token)
            ->deleteJson('/api/precincts/' . $second->json('data.id'))
            ->assertNoContent();

        $this->assertDatabaseCount('precincts', 0);

        $this->withToken($token)
            ->postJson('/api/precincts', [
                'room' => 'Room 201',
                'program' => 'BSIT',
                'year_levels' => ['3rd Year'],
            ])
            ->assertCreated()
            ->assertJsonPath('data.precinct_number', 1);

        $this->assertDatabaseHas('precincts', [
            'room' => 'Room 201',
            'precinct_number' => 1,
        ]);
    }

    public function test_committee_officer_can_load_its_assigned_dashboard_precinct(): void
    {
        $officer = User::factory()->create([
            'role' => 'committee_officer',
            'program' => 'BSIT',
            'year_level' => '2nd Year',
            'precinct' => 'BSIT - 2nd Year',
        ]);
        $precinct = Precinct::create([
            'room' => 'Science Room 202',
            'program' => 'BSIT',
            'year_level' => '2nd Year',
            'year_levels' => ['2nd Year'],
            'commissioner' => $officer->name,
            'commissioner_user_id' => $officer->id,
        ]);

        $this->withToken($this->tokenFor($officer))
            ->getJson('/api/precincts/assigned')
            ->assertOk()
            ->assertJsonPath('data.id', $precinct->id)
            ->assertJsonPath('data.precinct_number', $precinct->id)
            ->assertJsonPath('data.room', 'Science Room 202');
    }

    public function test_committee_officer_without_managed_precinct_does_not_fall_back_to_user_precinct(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $election = Election::factory()->create(['created_by' => $admin->id]);
        $officer = User::factory()->create([
            'role' => 'committee_officer',
            'program' => 'BSIT',
            'year_level' => '2nd Year',
            'precinct' => 'BSIT - 2nd Year',
        ]);

        Ballot::factory()->create([
            'election_id' => $election->id,
            'program' => 'BSIT',
            'year_level' => '2nd Year',
            'precinct' => 'BSIT - 2nd Year',
            'status' => 'issued',
        ]);

        $this->withToken($this->tokenFor($officer))
            ->getJson("/api/elections/{$election->id}/results?program=BSIT&year_level=2nd+Year")
            ->assertOk()
            ->assertJsonPath('data.ballotStats.issued', 0);
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

    public function test_admin_can_generate_ballots_for_a_new_governor_department(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $election = Election::factory()->create(['created_by' => $admin->id]);
        $token = $this->tokenFor($admin);
        $this->withToken($token)->getJson("/api/elections/{$election->id}/positions")->assertOk();
        $categories = $this->withToken($token)
            ->getJson("/api/elections/{$election->id}/position-categories")
            ->assertOk()
            ->json('data');
        $governorsCategoryId = collect($categories)->firstWhere('name', 'Governors')['id'];

        $positionResponse = $this->withToken($token)
            ->postJson("/api/elections/{$election->id}/positions", [
                'name' => 'Nursing',
                'vote_for_count' => 1,
                'display_order' => 12,
                'category_id' => $governorsCategoryId,
            ]);

        $positionResponse->assertCreated()
            ->assertJsonPath('data.department_serial_code', '06');

        $response = $this->withToken($token)
            ->postJson('/api/ballots/generate', [
                'election_id' => $election->id,
                'quantity' => 2,
                'program' => 'Nursing',
                'year_level' => '2nd Year',
            ]);

        $response->assertCreated();
        $this->assertDatabaseHas('ballots', [
            'election_id' => $election->id,
            'program' => 'Nursing',
            'serial_number' => '060020001',
        ]);
        $this->assertDatabaseHas('ballots', [
            'election_id' => $election->id,
            'program' => 'Nursing',
            'serial_number' => '060020002',
        ]);
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
                'username' => 'new_officer',
                'email' => 'new.officer@ivote.com',
                'role' => 'committee_officer',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.email', 'new.officer@ivote.com')
            ->assertJsonPath('data.username', 'new_officer')
            ->assertJsonPath('data.must_change_password', false)
            ->assertJsonStructure(['temporary_password']);
        $this->assertDatabaseHas('users', [
            'email' => 'new.officer@ivote.com',
            'username' => 'new_officer',
            'must_change_password' => false,
        ]);
    }

    public function test_new_admin_must_change_temporary_password_before_accessing_protected_routes(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $response = $this->withToken($this->tokenFor($admin))
            ->postJson('/api/users', [
                'name' => 'Temporary Password Admin',
                'username' => 'temporary_admin',
                'email' => 'temporary.admin@ivote.com',
                'role' => 'admin',
            ])
            ->assertCreated();

        $temporaryPassword = $response->json('temporary_password');
        $login = $this->postJson('/api/login', [
            'username' => 'temporary_admin',
            'password' => $temporaryPassword,
            'role' => 'admin',
        ])->assertOk()
            ->assertJsonPath('user.must_change_password', true);
        $token = $login->json('token');

        $this->withToken($token)->getJson('/api/elections')->assertStatus(423);

        $this->withToken($token)->postJson('/api/change-password', [
            'current_password' => $temporaryPassword,
            'password' => 'new-secure-password-2026',
            'password_confirmation' => 'new-secure-password-2026',
        ])->assertOk()
            ->assertJsonPath('user.must_change_password', false);

        $this->withToken($token)->getJson('/api/elections')->assertOk();
    }

    public function test_committee_officer_skips_forced_password_change_even_with_legacy_flag(): void
    {
        $officer = User::factory()->create([
            'role' => 'committee_officer',
            'must_change_password' => true,
            'password' => bcrypt('password123'),
        ]);

        $login = $this->postJson('/api/login', [
            'username' => $officer->username,
            'password' => 'password123',
            'role' => 'committee_officer',
        ])->assertOk()
            ->assertJsonPath('user.must_change_password', false);

        $this->withToken($login->json('token'))
            ->getJson('/api/elections')
            ->assertOk();
    }

    public function test_admin_can_assign_precinct_to_a_user(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->withToken($this->tokenFor($admin))
            ->postJson('/api/users', [
                'name' => 'Precinct Officer',
                'username' => 'precinct_officer',
                'email' => 'precinct.officer@ivote.com',
                'password' => 'Passw0rd!',
                'password_confirmation' => 'Passw0rd!',
                'role' => 'committee_officer',
                'program' => 'BSIT',
                'year_level' => '3rd Year',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.precinct', 'BSIT - 3rd Year')
            ->assertJsonPath('data.program', 'BSIT')
            ->assertJsonPath('data.year_level', '3rd Year');

        $this->assertDatabaseHas('users', [
            'email' => 'precinct.officer@ivote.com',
            'username' => 'precinct_officer',
            'precinct' => 'BSIT - 3rd Year',
            'program' => 'BSIT',
            'year_level' => '3rd Year',
        ]);
    }

    public function test_admin_can_create_user_with_multiple_year_levels(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->withToken($this->tokenFor($admin))
            ->postJson('/api/users', [
                'name' => 'Multi Year Officer',
                'username' => 'multi_year_officer',
                'email' => 'multi.year.officer@ivote.com',
                'password' => 'Passw0rd!',
                'password_confirmation' => 'Passw0rd!',
                'role' => 'committee_officer',
                'program' => 'BSE',
                'year_level' => ['2nd Year', '3rd Year', '4th Year'],
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.precinct', 'BSE - 2nd Year, 3rd Year, 4th Year')
            ->assertJsonPath('data.program', 'BSE')
            ->assertJsonPath('data.year_level', '2nd Year, 3rd Year, 4th Year')
            ->assertJsonPath('temporary_password', 'Passw0rd!');

        $this->assertDatabaseHas('users', [
            'email' => 'multi.year.officer@ivote.com',
            'username' => 'multi_year_officer',
            'precinct' => 'BSE - 2nd Year, 3rd Year, 4th Year',
            'program' => 'BSE',
            'year_level' => '2nd Year, 3rd Year, 4th Year',
        ]);
    }

    public function test_admin_cannot_create_user_with_invalid_or_mismatched_password(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $token = $this->tokenFor($admin);
        $userData = [
            'name' => 'Invalid Password Officer',
            'username' => 'invalid_password_officer',
            'email' => 'invalid.password@ivote.com',
            'role' => 'committee_officer',
        ];

        $this->withToken($token)
            ->postJson('/api/users', [
                ...$userData,
                'password' => 'weakpass1',
                'password_confirmation' => 'weakpass1',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);

        $this->withToken($token)
            ->postJson('/api/users', [
                ...$userData,
                'password' => 'Strong1!',
                'password_confirmation' => 'Different1!',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);

        $this->assertDatabaseMissing('users', ['email' => 'invalid.password@ivote.com']);
    }

    public function test_results_endpoint_filters_by_precinct(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $election = Election::factory()->create(['created_by' => $admin->id]);

        Ballot::factory()->create([
            'election_id' => $election->id,
            'status' => 'counted',
            'precinct' => 'Precinct 1',
        ]);

        Ballot::factory()->create([
            'election_id' => $election->id,
            'status' => 'counted',
            'precinct' => 'Precinct 2',
        ]);

        $response = $this->withToken($this->tokenFor($admin))
            ->getJson("/api/elections/{$election->id}/results?precinct=Precinct+1");

        $response->assertOk()
            ->assertJsonPath('data.ballotStats.issued', 1)
            ->assertJsonPath('data.ballotStats.counted', 1)
            ->assertJsonPath('data.ballotStats.manualReview', 0);
    }

    public function test_dashboard_results_use_managed_precinct_year_levels(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $election = Election::factory()->create(['created_by' => $admin->id]);
        $precinct = Precinct::create([
            'room' => 'Science Room 202',
            'program' => 'BSIT',
            'year_level' => '2nd Year',
            'year_levels' => ['2nd Year', '3rd Year'],
            'commissioner' => '',
        ]);

        Ballot::factory()->create([
            'election_id' => $election->id,
            'program' => 'BSIT',
            'year_level' => '2nd Year',
            'precinct' => null,
            'status' => 'counted',
        ]);
        Ballot::factory()->create([
            'election_id' => $election->id,
            'program' => 'BSIT',
            'year_level' => '3rd Year',
            'precinct' => null,
            'status' => 'issued',
        ]);
        Ballot::factory()->create([
            'election_id' => $election->id,
            'program' => 'BSIT',
            'year_level' => '1st Year',
            'precinct' => null,
            'status' => 'issued',
        ]);

        $this->withToken($this->tokenFor($admin))
            ->getJson("/api/elections/{$election->id}/results?precinct_id={$precinct->id}")
            ->assertOk()
            ->assertJsonPath('data.ballotStats.issued', 2)
            ->assertJsonPath('data.ballotStats.counted', 1);

        $this->withToken($this->tokenFor($admin))
            ->getJson("/api/reports/winners?election_id={$election->id}&precinct_id={$precinct->id}")
            ->assertOk()
            ->assertJsonPath('total_ballots', 2)
            ->assertJsonPath('precinct', 'Precinct ' . $precinct->id . ' · Science Room 202');
    }

    public function test_precinct_results_include_unscanned_ballots_for_assigned_department_and_year(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $election = Election::factory()->create(['created_by' => $admin->id]);
        User::factory()->create([
            'role' => 'committee_officer',
            'precinct' => 'Legacy precinct label',
            'program' => 'BSIT',
            'year_level' => '2nd Year',
        ]);
        Ballot::factory()->create([
            'election_id' => $election->id,
            'program' => 'BSIT',
            'year_level' => '2nd Year',
            'status' => 'issued',
        ]);
        Ballot::factory()->create([
            'election_id' => $election->id,
            'program' => 'BSE',
            'year_level' => '2nd Year',
            'status' => 'issued',
        ]);

        $response = $this->withToken($this->tokenFor($admin))
            ->getJson("/api/elections/{$election->id}/results?precinct=BSIT+-+2nd+Year");

        $response->assertOk()
            ->assertJsonPath('data.ballotStats.issued', 1)
            ->assertJsonPath('data.ballotStats.counted', 0);
    }

    public function test_admin_can_deactivate_and_reactivate_a_user(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $user = User::factory()->create(['is_active' => true]);
        $token = $this->tokenFor($admin);

        $this->withToken($token)
            ->patchJson("/api/users/{$user->id}/status", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('users', ['id' => $user->id, 'is_active' => false]);

        $this->withToken($token)
            ->patchJson("/api/users/{$user->id}/status", ['is_active' => true])
            ->assertOk()
            ->assertJsonPath('data.is_active', true);

        $this->assertDatabaseHas('users', ['id' => $user->id, 'is_active' => true]);
    }

    public function test_admin_cannot_deactivate_their_own_account(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $this->withToken($this->tokenFor($admin))
            ->patchJson("/api/users/{$admin->id}/status", ['is_active' => false])
            ->assertUnprocessable();

        $this->assertDatabaseHas('users', ['id' => $admin->id, 'is_active' => true]);
    }

    public function test_admin_can_manage_position_categories_and_assign_positions(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $election = Election::factory()->create(['created_by' => $admin->id]);
        $token = $this->tokenFor($admin);

        $positionsResponse = $this->withToken($token)
            ->getJson("/api/elections/{$election->id}/positions");

        $positionsResponse->assertOk()
            ->assertJsonPath('data.0.name', 'President');
        $this->assertNotNull($positionsResponse->json('data.0.category_id'));

        $categoryResponse = $this->withToken($token)
            ->postJson("/api/elections/{$election->id}/position-categories", [
                'name' => 'Class Representatives',
            ]);

        $categoryResponse->assertCreated()
            ->assertJsonPath('data.name', 'Class Representatives');
        $categoryId = $categoryResponse->json('data.id');

        $positionResponse = $this->withToken($token)
            ->postJson("/api/elections/{$election->id}/positions", [
                'name' => 'First Year Representative',
                'vote_for_count' => 1,
                'category_id' => $categoryId,
            ]);

        $positionResponse->assertCreated()
            ->assertJsonPath('data.category_id', $categoryId);

        $this->withToken($token)
            ->putJson("/api/elections/{$election->id}/position-categories/{$categoryId}", [
                'name' => 'Year Representatives',
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Year Representatives');

        $this->assertDatabaseHas('positions', [
            'name' => 'First Year Representative',
            'category_id' => $categoryId,
        ]);
        $this->assertDatabaseHas('position_categories', [
            'id' => $categoryId,
            'name' => 'Year Representatives',
        ]);

        $this->withToken($token)
            ->deleteJson("/api/elections/{$election->id}/position-categories/{$categoryId}")
            ->assertUnprocessable();

        $emptyCategory = $this->withToken($token)
            ->postJson("/api/elections/{$election->id}/position-categories", [
                'name' => 'Empty Category',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->withToken($token)
            ->deleteJson("/api/elections/{$election->id}/position-categories/{$emptyCategory}")
            ->assertNoContent();
        $this->assertDatabaseMissing('position_categories', ['id' => $emptyCategory]);
    }

    public function test_default_position_category_mapping_corrects_existing_positions(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $election = Election::factory()->create(['created_by' => $admin->id]);
        $token = $this->tokenFor($admin);

        $positions = $this->withToken($token)
            ->getJson("/api/elections/{$election->id}/positions")
            ->assertOk()
            ->json('data');
        $categories = $this->withToken($token)
            ->getJson("/api/elections/{$election->id}/position-categories")
            ->assertOk()
            ->json('data');
        $president = collect($positions)->firstWhere('name', 'President');
        $executiveCategoryId = collect($categories)->firstWhere('name', 'Executive Officers')['id'];
        $senatorsCategoryId = collect($categories)->firstWhere('name', 'Senators')['id'];

        $this->withToken($token)
            ->putJson("/api/elections/{$election->id}/positions/{$president['id']}", [
                'name' => 'President',
                'vote_for_count' => 1,
                'category_id' => $senatorsCategoryId,
            ])
            ->assertOk()
            ->assertJsonPath('data.category_id', $senatorsCategoryId);

        $this->withToken($token)
            ->getJson("/api/elections/{$election->id}/positions")
            ->assertOk();

        $this->assertDatabaseHas('positions', [
            'id' => $president['id'],
            'category_id' => $executiveCategoryId,
        ]);
    }

    public function test_default_position_categories_exclude_custom_positions(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $election = Election::factory()->create(['created_by' => $admin->id]);

        $response = $this->withToken($this->tokenFor($admin))
            ->getJson("/api/elections/{$election->id}/position-categories");

        $response->assertOk();
        $this->assertNotContains('Custom Positions', collect($response->json('data'))->pluck('name')->all());
    }

    public function test_admin_can_create_a_user_with_a_username(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->withToken($this->tokenFor($admin))
            ->postJson('/api/users', [
                'name' => 'New Username Officer',
                'username' => 'officer_bsit',
                'password' => 'Passw0rd!',
                'password_confirmation' => 'Passw0rd!',
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
            'email' => 'officer@ivote.com',
            'username' => 'officer_bsit',
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

    public function test_user_can_log_in_with_an_email(): void
    {
        User::factory()->create([
            'email' => 'officer@ivote.com',
            'password' => bcrypt('password123'),
            'role' => 'committee_officer',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'officer@ivote.com',
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

    public function test_official_report_filters_ballot_totals_and_winner_votes_by_precinct(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        User::factory()->create([
            'role' => 'committee_officer',
            'program' => 'BSIT',
            'year_level' => '2nd Year',
        ]);
        $election = Election::factory()->create(['created_by' => $admin->id]);
        $position = Position::factory()->create([
            'election_id' => $election->id,
            'name' => 'Senators',
        ]);
        $bsitCandidate = Candidate::factory()->create([
            'position_id' => $position->id,
            'name' => 'BSIT Candidate',
        ]);
        $otherCandidate = Candidate::factory()->create([
            'position_id' => $position->id,
            'name' => 'Other Candidate',
        ]);

        $recordVote = function (string $program, string $yearLevel, Candidate $candidate) use ($election, $admin, $position): void {
            $ballot = Ballot::factory()->create([
                'election_id' => $election->id,
                'program' => $program,
                'year_level' => $yearLevel,
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
        };

        $recordVote('BSIT', '2nd Year', $bsitCandidate);
        $recordVote('BSE', '2nd Year', $otherCandidate);

        $response = $this->withToken($this->tokenFor($admin))
            ->getJson('/api/reports/winners?election_id=' . $election->id . '&precinct=BSIT%20-%202nd%20Year')
            ->assertOk()
            ->assertJsonPath('precinct', 'BSIT - 2nd Year')
            ->assertJsonPath('total_ballots', 1)
            ->assertJsonPath('valid_ballots', 1);

        $senatorRows = collect($response->json('results'))
            ->where('position', 'Senators')
            ->values();

        $this->assertCount(1, $senatorRows);
        $this->assertSame('BSIT Candidate', $senatorRows->first()['winner']);
        $this->assertSame(1, $senatorRows->first()['votes']);
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
            ->assertJsonPath('results.0.category', 'Senators')
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

    public function test_public_results_report_department_turnout_from_counted_ballots_only(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $election = Election::factory()->create(['created_by' => $admin->id]);

        Ballot::factory()->count(3)->create([
            'election_id' => $election->id,
            'program' => 'BSIT',
        ]);
        Ballot::factory()->count(3)->create([
            'election_id' => $election->id,
            'program' => 'BSHM',
        ]);

        Ballot::where('election_id', $election->id)
            ->where('program', 'BSIT')
            ->limit(2)
            ->update(['status' => 'counted']);
        Ballot::where('election_id', $election->id)
            ->where('program', 'BSHM')
            ->limit(1)
            ->update(['status' => 'counted']);
        Ballot::where('election_id', $election->id)
            ->where('program', 'BSHM')
            ->where('status', 'issued')
            ->limit(1)
            ->update(['status' => 'manual_review']);
        Ballot::where('election_id', $election->id)
            ->where('program', 'BSHM')
            ->where('status', 'issued')
            ->update(['status' => 'duplicate_rejected']);

        $response = $this->getJson('/api/elections/' . $election->id . '/public-results');

        $response->assertOk()
            ->assertJsonPath('meta.voter_turnout.total_eligible_voters', 6)
            ->assertJsonPath('meta.voter_turnout.total_participating_voters', 3)
            ->assertJsonPath('meta.voter_turnout.turnout_percentage', 50)
            ->assertJsonPath('meta.voter_turnout.departments.0.department', 'BSHM')
            ->assertJsonPath('meta.voter_turnout.departments.0.eligible_voters', 3)
            ->assertJsonPath('meta.voter_turnout.departments.0.participating_voters', 1)
            ->assertJsonPath('meta.voter_turnout.departments.0.turnout_percentage', 33.3)
            ->assertJsonPath('meta.voter_turnout.departments.1.department', 'BSIT')
            ->assertJsonPath('meta.voter_turnout.departments.1.eligible_voters', 3)
            ->assertJsonPath('meta.voter_turnout.departments.1.participating_voters', 2)
            ->assertJsonPath('meta.voter_turnout.departments.1.turnout_percentage', 66.7)
            ->assertJsonMissingPath('meta.voter_turnout.departments.0.serial_number');
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

    public function test_committee_officer_cannot_scan_ballot_outside_assigned_program_and_year(): void
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

        $response->assertStatus(422)
            ->assertJsonPath('message', 'This ballot does not match your assigned department and year level.');
        $this->assertDatabaseMissing('ballot_scans', ['ballot_id' => $ballot->id]);
        $this->assertSame('issued', $ballot->fresh()->status);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/users');

        $response->assertStatus(401);
    }
}
