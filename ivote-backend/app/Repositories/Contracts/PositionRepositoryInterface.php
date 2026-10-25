<?php

namespace App\Repositories\Contracts;

use App\Models\Position;
use Illuminate\Database\Eloquent\Collection;

interface PositionRepositoryInterface
{
    public function allForElection(int $electionId): Collection;

    public function find(int $id): ?Position;

    public function create(array $data): Position;

    public function update(Position $position, array $data): Position;

    public function delete(Position $position): bool;
}
