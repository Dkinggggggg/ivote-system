<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BallotScan extends Model
{
    protected $fillable = [
        'ballot_id',
        'scanned_by',
        'image_path',
        'ocr_result',
        'omr_confidence',
        'status', // 'counted' | 'duplicate_rejected' | 'manual_review' | 'error'
    ];

    protected $casts = [
        'scanned_at' => 'datetime',
        'omr_confidence' => 'float',
    ];

    public function ballot()
    {
        return $this->belongsTo(Ballot::class);
    }

    public function scannedBy()
    {
        return $this->belongsTo(User::class, 'scanned_by');
    }

    public function votes()
    {
        return $this->hasMany(Vote::class);
    }
}
