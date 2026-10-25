<?php

namespace Database\Factories;

use App\Models\Election;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Election> */
class ElectionFactory extends Factory
{
    protected $model = Election::class;

    public function definition(): array
    {
        return [
            'title' => fake()->sentence(3),
            'status' => 'draft',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDay()->toDateString(),
            'created_by' => User::factory()->state(['role' => 'admin']),
        ];
    }
}
