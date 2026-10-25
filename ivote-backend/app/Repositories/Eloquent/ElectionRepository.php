<?php

namespace App\Repositories\Eloquent;

use App\Models\Election;
use App\Repositories\Contracts\ElectionRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class ElectionRepository implements ElectionRepositoryInterface
{
    public function all(): Collection
    {
        return Election::with('positions.candidates')
            ->orderBy('created_at', 'desc')
            ->get();
    }

    public function find(int $id): ?Election
    {
        return Election::find($id);
    }

    public function create(array $data): Election
    {
        return Election::create($data);
    }

    public function update(Election $election, array $data): Election
    {
        $election->update($data);

        return $election->fresh();
    }

    public function delete(Election $election): bool
    {
        return (bool) $election->delete();
    }

    public function findActive(): ?Election
    {
        return Election::where('status', 'active')->first();
    }
}
