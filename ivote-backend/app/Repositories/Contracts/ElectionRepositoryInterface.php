<?php

namespace App\Repositories\Contracts;

use App\Models\Election;
use Illuminate\Database\Eloquent\Collection;

/**
 * Contract for election data access. Controllers and services depend on
 * this interface - never on the Eloquent implementation directly.
 * This is what lets us swap the storage layer or write tests with a
 * fake repository without touching a single controller.
 */
interface ElectionRepositoryInterface
{
    public function all(): Collection;

    public function find(int $id): ?Election;

    public function create(array $data): Election;

    public function update(Election $election, array $data): Election;

    public function delete(Election $election): bool;

    /**
     * The election currently open for scanning, if any.
     * Used by the mobile app to know which election it's scanning against.
     */
    public function findActive(): ?Election;
}
