<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;

class AuditLogController extends Controller
{
    /**
     * GET /api/audit-logs (Admin only, enforced by route middleware).
     * Most recent 200 entries - full history is available via the
     * Audit report CSV export on the Reports page.
     */
    public function index()
    {
        $logs = AuditLog::with('user')->latest('created_at')->limit(200)->get();

        return AuditLogResource::collection($logs);
    }
}
