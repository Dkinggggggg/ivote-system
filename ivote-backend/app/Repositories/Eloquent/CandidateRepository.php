<?php

namespace App\Repositories\Eloquent;

use App\Models\Candidate;
use App\Repositories\Contracts\CandidateRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class CandidateRepository implements CandidateRepositoryInterface
{
    public function allForPosition(int $positionId): Collection
    {
        return Candidate::where('position_id', $positionId)
            ->orderBy('display_order')
            ->get();
    }

    public function allForElection(int $electionId): Collection
    {
        return Candidate::whereHas('position', fn ($query) => $query->where('election_id', $electionId))
            ->with('position:id,name')
            ->orderBy('name')
            ->get();
    }

    public function find(int $id): ?Candidate
    {
        return Candidate::find($id);
    }

    public function create(array $data): Candidate
    {
        return Candidate::create($data);
    }

    public function update(Candidate $candidate, array $data): Candidate
    {
        $candidate->update($data);

        return $candidate->fresh();
    }

    public function delete(Candidate $candidate): bool
    {
        return (bool) $candidate->delete();
    }
}
