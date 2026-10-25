<?php

namespace Database\Seeders;

use App\Models\Candidate;
use App\Models\Election;
use App\Models\Position;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::create([
            'name' => 'System Admin',
            'email' => 'admin@ivote.com',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        User::create([
            'name' => 'Committee Officer',
            'email' => 'officer@ivote.com',
            'password' => Hash::make('password123'),
            'role' => 'committee_officer',
            'is_active' => true,
        ]);

        // A ready-to-scan demo election so a fresh install has something
        // to see on the Dashboard/Public Results pages immediately.
        $election = Election::create([
            'title' => 'Student Council Elections A.Y. 2026-2027',
            'status' => 'active',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDay()->toDateString(),
            'created_by' => $admin->id,
        ]);

        $president = Position::create([
            'election_id' => $election->id,
            'name' => 'President',
            'vote_for_count' => 1,
            'display_order' => 0,
        ]);

        Candidate::insert([
            ['position_id' => $president->id, 'name' => 'Maria Santos', 'party' => 'Unity Party', 'display_order' => 0, 'created_at' => now(), 'updated_at' => now()],
            ['position_id' => $president->id, 'name' => 'Juan Dela Cruz', 'party' => 'Progress Coalition', 'display_order' => 1, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $vp = Position::create([
            'election_id' => $election->id,
            'name' => 'Vice President',
            'vote_for_count' => 1,
            'display_order' => 1,
        ]);

        Candidate::insert([
            ['position_id' => $vp->id, 'name' => 'Ana Reyes', 'party' => 'Unity Party', 'display_order' => 0, 'created_at' => now(), 'updated_at' => now()],
            ['position_id' => $vp->id, 'name' => 'Carlos Villanueva', 'party' => 'Progress Coalition', 'display_order' => 1, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}
