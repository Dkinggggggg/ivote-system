<?php

namespace App\Repositories\Contracts;

use App\Models\Ballot;
use Illuminate\Database\Eloquent\Collection;

interface BallotRepositoryInterface
{
    public function findBySerial(string $serialNumber): ?Ballot;

    /**
     * Atomically marks a ballot as counted, but ONLY if it isn't already.
     * Returns true if this call successfully claimed the ballot, false if
     * another request already counted it first.
     */
    public function claimForCounting(Ballot $ballot): bool;

    public function all(): Collection;

    public function find(int $id): ?Ballot;

    /**
     * Creates $quantity new 'issued' ballots for an election, each with
     * a unique serial number and QR value, continuing the numbering
     * sequence rather than restarting it.
     */
    public function generateForElection(int $electionId, int $quantity, string $program, string $yearLevel): Collection;

    /**
     * NEW
     * Returns multiple ballots by IDs for batch printing.
     */
    public function findMany(array $ids): Collection;

    public function nextUnprintedForElection(int $electionId, int $batchSize, string $program, string $yearLevel): Collection;

    public function markPrinted(array $ids): int;

    public function delete(Ballot $ballot): bool;

    public function deleteMany(array $ids): int;
}