<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [

            'id' => $this->id,

            'user_name' => $this->user?->name,

            'user_role' => $this->user?->role,

            // Audit actions have historically been stored in a mixture of
            // formats (CREATE_POSITION, Create User, ballot_scanned). Return
            // one consistent, human-readable label for every existing row.
            'action' => Str::of($this->action)
                ->replace('_', ' ')
                ->lower()
                ->title()
                ->value(),

            'description' => $this->description,

            'ip_address' => $this->ip_address,

            'created_at' => $this->created_at
                ? $this->created_at->format('F d, Y h:i A')
                : null,

        ];
    }
}
