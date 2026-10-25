<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ElectionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'status' => $this->status,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'finalized_at' => $this->finalized_at?->toIso8601String(),
            'final_results' => $this->final_results,
            'positions' => PositionResource::collection($this->whenLoaded('positions')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
