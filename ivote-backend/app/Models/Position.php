<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

/**
 * A contested position within an election (e.g. President, Senator).
 * vote_for_count supports multi-seat positions ("vote for 3 Senators").
 */
class Position extends Model
{
    use HasFactory;

    public const LEGACY_DEPARTMENT_SERIAL_CODES = [
        'BSIT' => '01',
        'BSHM' => '02',
        'BSE' => '03',
        'BTVTED' => '04',
        'BINDTECH' => '05',
    ];

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

        $categoryByPositionName = [];
        foreach (PositionCategory::DEFAULT_CATEGORIES as $categoryName => $positionNames) {
            $category = PositionCategory::where('election_id', $electionId)
                ->where('name', $categoryName)
                ->first();

            if (!$category) {
                continue;
            }

            foreach ($positionNames as $positionName) {
                $categoryByPositionName[$positionName] = $category->id;
            }
        }

        foreach (self::DEFAULT_POSITIONS as $position) {
            $createdPosition = self::firstOrCreate(
                ['election_id' => $electionId, 'name' => $position['name']],
                $position
            );

            if (is_null($createdPosition->category_id) && isset($categoryByPositionName[$createdPosition->name])) {
                $createdPosition->forceFill(['category_id' => $categoryByPositionName[$createdPosition->name]])->save();
            }

            $createdPosition->ensureDepartmentSerialCode();
        }

        self::where('election_id', $electionId)
            ->where(function ($query) {
                $query->where('name', 'like', 'Governor - %')
                    ->orWhereHas('category', fn ($categoryQuery) => $categoryQuery->where('name', 'Governors'));
            })
            ->get()
            ->each(fn (Position $position) => $position->ensureDepartmentSerialCode());
    }

    public function ensureDepartmentSerialCode(): void
    {
        $prefix = 'Governor - ';
        $isGovernor = str_starts_with($this->name, $prefix)
            || ($this->category_id && $this->category()->where('name', 'Governors')->exists());
        if (!$isGovernor || $this->department_serial_code) {
            return;
        }

        $department = str_starts_with($this->name, $prefix)
            ? trim(substr($this->name, strlen($prefix)))
            : trim($this->name);
        if ($department === '') {
            return;
        }

        $serialCode = self::LEGACY_DEPARTMENT_SERIAL_CODES[$department] ?? null;

        if ($serialCode === null) {
            $usedCodes = self::where('election_id', $this->election_id)
                ->whereNotNull('department_serial_code')
                ->pluck('department_serial_code')
                ->map(fn ($code) => (string) $code)
                ->all();
            $usedBallotCodes = Ballot::where('election_id', $this->election_id)
                ->pluck('serial_number')
                ->map(fn ($serial) => substr((string) $serial, 0, 2))
                ->all();

            $usedCodes = array_merge($usedCodes, $usedBallotCodes);
            for ($code = 6; $code <= 99; $code++) {
                $candidateCode = str_pad((string) $code, 2, '0', STR_PAD_LEFT);
                if (!in_array($candidateCode, $usedCodes, true)) {
                    $serialCode = $candidateCode;
                    break;
                }
            }
        }

        if ($serialCode === null) {
            throw ValidationException::withMessages([
                'program' => 'No department serial codes remain for this election.',
            ]);
        }

        $this->forceFill(['department_serial_code' => $serialCode])->save();
    }

    protected $fillable = [
        'election_id',
        'category_id',
        'name',
        'vote_for_count',
        'display_order',
    ];

    public function election()
    {
        return $this->belongsTo(Election::class);
    }

    public function category()
    {
        return $this->belongsTo(PositionCategory::class, 'category_id');
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
