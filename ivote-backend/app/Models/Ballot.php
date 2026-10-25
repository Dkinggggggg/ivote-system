<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ballot extends Model
{
    use HasFactory;

    protected $fillable = [
        'election_id',
        'program',
        'year_level',
        'serial_number',
        'qr_code_value',
        'status', // 'issued' | 'counted' | 'duplicate_rejected' | 'manual_review'
        'generated_at',
        'printed_at',
    ];

    protected $casts = [
        'generated_at' => 'datetime',
        'printed_at' => 'datetime',
    ];

    public function election()
    {
        return $this->belongsTo(Election::class);
    }

    public function scans()
    {
        return $this->hasMany(BallotScan::class);
    }
}
