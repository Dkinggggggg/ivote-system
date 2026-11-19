<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Vote extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'ballot_scan_id',
        'position_id',
        'candidate_id',
        'is_abstain',
    ];

    protected $casts = [
        'is_abstain' => 'boolean',
    ];

    public function ballotScan()
    {
        return $this->belongsTo(BallotScan::class);
    }

    public function position()
    {
        return $this->belongsTo(Position::class);
    }

    public function candidate()
    {
        return $this->belongsTo(Candidate::class);
    }
}
