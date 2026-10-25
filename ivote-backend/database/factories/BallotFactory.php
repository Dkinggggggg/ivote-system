<?php

namespace Database\Factories;

use App\Models\Ballot;
use App\Models\Election;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Ballot> */
class BallotFactory extends Factory
{
    protected $model = Ballot::class;

    public function definition(): array
    {
        return [
            'election_id' => Election::factory(),
            'serial_number' => 'BAL-'.fake()->unique()->numerify('######'),
            'qr_code_value' => Str::upper(Str::random(24)),
            'status' => 'issued',
            'generated_at' => now(),
        ];
    }
}
