<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Precinct extends Model
{
    protected $fillable = [
        'room',
        'program',
        'year_level',
        'year_levels',
        'commissioner',
        'commissioner_user_id',
        'precinct_number',
    ];

    protected $appends = ['precinct_number'];

    protected $casts = [
        'year_levels' => 'array',
    ];

    public function getPrecinctNumberAttribute($value): int
    {
        if (! $this->exists) {
            return (int) ($value ?? 1);
        }

        return (int) static::query()->where('id', '<=', $this->id)->count();
    }

    public function commissionerUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'commissioner_user_id');
    }
}