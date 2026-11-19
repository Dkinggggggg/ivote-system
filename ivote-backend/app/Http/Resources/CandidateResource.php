<?php

namespace App\Http\Resources;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CandidateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'position_id' => $this->position_id,
            'position_name' => $this->position?->name,
            'name' => $this->name,
            'party' => $this->party,
            'photo_url' => $this->resolvedPhotoUrl(),
            'vote_count' => $this->voteCount(),
            'display_order' => $this->display_order,
        ];
    }

    private function resolvedPhotoUrl(): ?string
    {
        if (! $this->photo_url) {
            return null;
        }

        if (Str::startsWith($this->photo_url, ['http://', 'https://'])) {
            return $this->photo_url;
        }

        return Storage::disk('public')->url($this->photo_url);
    }
}
