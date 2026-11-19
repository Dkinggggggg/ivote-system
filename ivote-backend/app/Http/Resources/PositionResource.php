<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class PositionResource extends JsonResource
{
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'election_id' => $this->election_id,
            'name' => $this->name,
            'department_serial_code' => $this->department_serial_code,
            'category_id' => $this->category_id,
            'category_name' => $this->whenLoaded('category', fn () => $this->category?->name),
            'vote_for_count' => $this->vote_for_count,
            'display_order' => $this->display_order,

            'candidates' => CandidateResource::collection(
                $this->whenLoaded('candidates')
            ),

            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}