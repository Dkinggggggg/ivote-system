<?php

namespace App\Repositories\Contracts;

use App\Models\Candidate;
use Illuminate\Database\Eloquent\Collection;

interface CandidateRepositoryInterface
{
    public function allForPosition(int $positionId): Collection;

    public function allForElection(int $electionId): Collection;

    public function find(int $id): ?Candidate;

    public function create(array $data): Candidate;

    public function update(Candidate $candidate, array $data): Candidate;

    public function delete(Candidate $candidate): bool;
}
