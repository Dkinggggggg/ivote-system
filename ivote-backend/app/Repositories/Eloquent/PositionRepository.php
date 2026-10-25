<?php

namespace App\Repositories\Eloquent;

use App\Models\Position;
use App\Repositories\Contracts\PositionRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class PositionRepository implements PositionRepositoryInterface
{
    public function allForElection(int $electionId): Collection
    {
        return Position::where('election_id', $electionId)
            ->orderBy('display_order')
            ->get();
    }

    public function find(int $id): ?Position
    {
        return Position::find($id);
    }

    public function create(array $data): Position
    {
        return Position::create($data);
    }

    public function update(Position $position, array $data): Position
    {
        $position->update($data);

        return $position->fresh();
    }

    public function delete(Position $position): bool
    {
        return (bool) $position->delete();
    }
}
