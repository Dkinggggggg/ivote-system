<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A contested position within an election (e.g. President, Senator).
 * vote_for_count supports multi-seat positions ("vote for 3 Senators").
 */
class Position extends Model
{
    use HasFactory;

    public const DEFAULT_POSITIONS = [
        ['name' => 'President', 'vote_for_count' => 1, 'display_order' => 1],
        ['name' => 'Vice President', 'vote_for_count' => 1, 'display_order' => 2],
        ['name' => 'Senators', 'vote_for_count' => 12, 'display_order' => 3],
        ['name' => 'Governor - BSIT', 'vote_for_count' => 1, 'display_order' => 4],
        ['name' => 'Governor - BTVTED', 'vote_for_count' => 1, 'display_order' => 5],
        ['name' => 'Governor - BSE', 'vote_for_count' => 1, 'display_order' => 6],
        ['name' => 'Governor - BINDTECH', 'vote_for_count' => 1, 'display_order' => 7],
        ['name' => 'Governor - BSHM', 'vote_for_count' => 1, 'display_order' => 8],
        ['name' => 'Batch Representative - 2nd Year', 'vote_for_count' => 2, 'display_order' => 9],
        ['name' => 'Batch Representative - 3rd Year', 'vote_for_count' => 2, 'display_order' => 10],
        ['name' => 'Batch Representative - 4th Year', 'vote_for_count' => 2, 'display_order' => 11],
    ];

    public static function provisionDefaultsForElection(int $electionId): void
    {
        $legacyNames = [
            'Senator' => 'Senators',
            'Batch Representative' => 'Batch Representative - 2nd Year',
        ];

        foreach ($legacyNames as $legacyName => $defaultName) {
            $legacyPosition = self::where('election_id', $electionId)
                ->where('name', $legacyName)
                ->first();

            $defaultExists = self::where('election_id', $electionId)
                ->where('name', $defaultName)
                ->exists();

            if ($legacyPosition && !$defaultExists) {
                $legacyPosition->update([
                    'name' => $defaultName,
                    'vote_for_count' => collect(self::DEFAULT_POSITIONS)
                        ->firstWhere('name', $defaultName)['vote_for_count'],
                ]);
            }
        }

        foreach (self::DEFAULT_POSITIONS as $position) {
            self::firstOrCreate(
                ['election_id' => $electionId, 'name' => $position['name']],
                $position
            );
        }
    }

    protected $fillable = [
        'election_id',
        'name',
        'vote_for_count',
        'display_order',
    ];

    public function election()
    {
        return $this->belongsTo(Election::class);
    }

    public function candidates()
    {
        return $this->hasMany(Candidate::class)->orderBy('display_order');
    }

    public function votes()
    {
        return $this->hasMany(Vote::class);
    }
}
