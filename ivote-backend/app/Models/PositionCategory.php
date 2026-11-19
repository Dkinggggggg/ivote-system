<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PositionCategory extends Model
{
    use HasFactory;

    public const DEFAULT_CATEGORIES = [
        'Executive Officers' => ['President', 'Vice President'],
        'Senators' => ['Senators'],
        'Governors' => [
            'Governor - BSIT',
            'Governor - BTVTED',
            'Governor - BSE',
            'Governor - BINDTECH',
            'Governor - BSHM',
        ],
        'Batch Representatives' => [
            'Batch Representative - 2nd Year',
            'Batch Representative - 3rd Year',
            'Batch Representative - 4th Year',
        ],
    ];

    protected $fillable = ['election_id', 'name'];

    public static function provisionDefaultsForElection(int $electionId): void
    {
        static::where('election_id', $electionId)
            ->whereIn('name', ['Custom Positions', 'Custom Position'])
            ->delete();

        $categories = static::where('election_id', $electionId)->get()->keyBy('name');

        if ($categories->isEmpty()) {
            foreach (array_keys(self::DEFAULT_CATEGORIES) as $name) {
                static::create([
                    'election_id' => $electionId,
                    'name' => $name,
                ]);
            }

            $categories = static::where('election_id', $electionId)->get()->keyBy('name');
        }

        $categoryByPositionName = [];
        foreach (self::DEFAULT_CATEGORIES as $categoryName => $positionNames) {
            $category = $categories->get($categoryName);
            if (!$category) {
                continue;
            }

            foreach ($positionNames as $positionName) {
                $categoryByPositionName[$positionName] = $category;
            }
        }

        Position::where('election_id', $electionId)
            ->get()
            ->each(function (Position $position) use ($categoryByPositionName): void {
                $category = $categoryByPositionName[$position->name] ?? null;
                if (!$category || (int) $position->category_id === (int) $category->id) {
                    return;
                }

                $position->category()->associate($category);
                $position->save();
            });
    }

    public function election()
    {
        return $this->belongsTo(Election::class);
    }

    public function positions()
    {
        return $this->hasMany(Position::class, 'category_id');
    }
}