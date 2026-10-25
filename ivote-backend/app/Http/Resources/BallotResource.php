<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BallotResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'election_id' => $this->election_id,
            'program' => $this->program,
            'year_level' => $this->year_level,
            'election' => $this->whenLoaded('election', fn () => new ElectionResource($this->election)),
            'serial_number' => $this->serial_number,
            'qr_code_value' => $this->qr_code_value,
            'status' => $this->status,
            'generated_at' => $this->generated_at?->toIso8601String(),
            'printed_at' => $this->printed_at?->toIso8601String(),
        ];
    }
}
