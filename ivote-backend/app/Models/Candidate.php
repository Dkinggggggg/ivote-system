<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Candidate extends Model
{
    use HasFactory;

    protected $fillable = [
        'position_id',
        'name',
        'party',
        'photo_url',
        'display_order',
    ];

    public function position()
    {
        return $this->belongsTo(Position::class);
    }

    public function votes()
    {
        return $this->hasMany(Vote::class);
    }

    /**
     * Current vote count for this candidate.
     * Used by the live dashboard (Phase 7) - only counts votes attached to
     * ballot_scans with status = 'counted', per BR-09.
     */
    public function voteCount(): int
    {
        return $this->votes()
            ->where('is_abstain', false)
            ->whereHas('ballotScan', fn ($q) => $q->where('status', 'counted'))
            ->count();
    }
}
