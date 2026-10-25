<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One row per login, scan, or admin action, for full traceability
 * (Audit Logs page in the web dashboard). Previously referenced by
 * ScanController but the model itself didn't exist - added here.
 */
class AuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'action',
        'description',
        'ip_address',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function (AuditLog $log) {
            $log->created_at ??= now();
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
