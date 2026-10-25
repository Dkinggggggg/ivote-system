<?php

namespace Database\Factories;

use App\Models\Election;
use App\Models\Position;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Position> */
class PositionFactory extends Factory
{
    protected $model = Position::class;

    public function definition(): array
    {
        return [
            'election_id' => Election::factory(),
            'name' => fake()->jobTitle(),
            'vote_for_count' => 1,
            'display_order' => 0,
        ];
    }
}
