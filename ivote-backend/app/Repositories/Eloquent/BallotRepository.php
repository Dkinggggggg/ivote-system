<?php

namespace App\Repositories\Eloquent;

use App\Models\Ballot;
use App\Repositories\Contracts\BallotRepositoryInterface;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BallotRepository implements BallotRepositoryInterface
{
    public function findBySerial(string $serialNumber): ?Ballot
    {
        return Ballot::where('serial_number', $serialNumber)->first();
    }

    public function claimForCounting(Ballot $ballot): bool
    {
        $affectedRows = Ballot::where('id', $ballot->id)
            ->where('status', 'issued')
            ->update(['status' => 'counted']);

        return $affectedRows === 1;
    }

    public function all(): EloquentCollection
    {
        return Ballot::with('election')->latest('generated_at')->get();
    }

    public function find(int $id): ?Ballot
    {
        return Ballot::find($id);
    }

    /**
     * NEW
     * Return multiple ballots with all relationships
     * needed for printing.
     */
    public function findMany(array $ids): EloquentCollection
    {
        return Ballot::with('election.positions.candidates')
            ->whereIn('id', $ids)
            ->get();
    }

    public function generateForElection(int $electionId, int $quantity, string $program, string $yearLevel): EloquentCollection
    {
        $departmentCodes = [
            'BSIT' => '01',
            'BSHM' => '02',
            'BSE' => '03',
            'BTVTED' => '04',
            'BINDTECH' => '05',
        ];
        $yearCodes = [
            '2nd Year' => '002',
            '3rd Year' => '003',
            '4th Year' => '004',
        ];
        $prefix = $departmentCodes[$program] . $yearCodes[$yearLevel];

        return DB::transaction(function () use ($electionId, $quantity, $program, $yearLevel, $prefix) {
            $lastSerial = Ballot::query()
                ->lockForUpdate()
                ->where('serial_number', 'like', $prefix . '%')
                ->orderByDesc('serial_number')
                ->value('serial_number');
            $lastNumber = $lastSerial ? (int) substr($lastSerial, -4) : 0;

            if ($lastNumber + $quantity > 9999) {
                throw ValidationException::withMessages([
                    'quantity' => 'This department and year group has reached its 9,999 ballot limit.',
                ]);
            }

            $ballots = new EloquentCollection();

            for ($i = 1; $i <= $quantity; $i++) {
                $serial = $prefix . str_pad((string) ($lastNumber + $i), 4, '0', STR_PAD_LEFT);

                $ballots->push(Ballot::create([
                    'election_id' => $electionId,
                    'program' => $program,
                    'year_level' => $yearLevel,
                    'serial_number' => $serial,
                    'qr_code_value' => Str::upper(Str::random(24)),
                    'status' => 'issued',
                    'generated_at' => now(),
                ]));
            }

            return $ballots;
        });
    }

    public function nextUnprintedForElection(int $electionId, int $batchSize, string $program, string $yearLevel): EloquentCollection
    {
        return Ballot::with('election.positions.candidates')
            ->where('election_id', $electionId)
            ->where('program', $program)
            ->where('year_level', $yearLevel)
            ->whereNull('printed_at')
            ->orderBy('serial_number')
            ->limit($batchSize)
            ->get();
    }

    public function markPrinted(array $ids): int
    {
        return Ballot::whereIn('id', $ids)
            ->whereNull('printed_at')
            ->update(['printed_at' => now()]);
    }

    public function delete(Ballot $ballot): bool
    {
        return (bool) $ballot->delete();
    }

    public function deleteMany(array $ids): int
    {
        return Ballot::whereIn('id', $ids)->delete();
    }
}