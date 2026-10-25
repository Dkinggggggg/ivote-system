<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One row per election event (e.g. "SR Elections A.Y. 2026-2027").
 * Everything else - positions, candidates, ballots - is scoped under an election.
 */
class Election extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'status', // 'draft' | 'active' | 'closed'
        'start_date',
        'end_date',
        'created_by',
        'finalized_at',
        'final_results',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'finalized_at' => 'datetime',
        'final_results' => 'array',
    ];

    public function positions()
    {
        return $this->hasMany(Position::class);
    }

    public function ballots()
    {
        return $this->hasMany(Ballot::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * True if this election currently accepts ballot scans.
     * Enforced again server-side in ScanService - never trust the client alone.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
