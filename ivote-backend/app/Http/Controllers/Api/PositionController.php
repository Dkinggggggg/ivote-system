<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePositionRequest;
use App\Http\Resources\PositionResource;
use App\Models\AuditLog;
use App\Models\Position;
use App\Repositories\Contracts\PositionRepositoryInterface;
use Illuminate\Http\Response;

class PositionController extends Controller
{
    public function __construct(
        private readonly PositionRepositoryInterface $positions
    ) {
    }

    public function index(int $electionId)
    {
        Position::provisionDefaultsForElection($electionId);

        return PositionResource::collection(
            $this->positions->allForElection($electionId)->load('candidates')
        );
    }

    public function store(StorePositionRequest $request, int $electionId)
    {
        $data = $request->validated();
        $data['election_id'] = $electionId;

        $position = $this->positions->create($data);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'CREATE_POSITION',
            'description' => 'Created position "' . $position->name . '"',
            'ip_address' => $request->ip(),
        ]);

        return (new PositionResource($position))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(StorePositionRequest $request, int $electionId, int $id)
    {
        $position = $this->positions->find($id);

        abort_if(
            ! $position || $position->election_id !== $electionId,
            Response::HTTP_NOT_FOUND,
            'Position not found.'
        );

        $updated = $this->positions->update(
            $position,
            $request->validated()
        );

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'UPDATE_POSITION',
            'description' => 'Updated position "' . $updated->name . '"',
            'ip_address' => $request->ip(),
        ]);

        return new PositionResource($updated);
    }

    public function destroy(int $electionId, int $id)
    {
        $position = $this->positions->find($id);

        abort_if(
            ! $position || $position->election_id !== $electionId,
            Response::HTTP_NOT_FOUND,
            'Position not found.'
        );

        $positionName = $position->name;

        $this->positions->delete($position);

        AuditLog::create([
            'user_id' => request()->user()->id,
            'action' => 'DELETE_POSITION',
            'description' => 'Deleted position "' . $positionName . '"',
            'ip_address' => request()->ip(),
        ]);

        return response()->json(
            null,
            Response::HTTP_NO_CONTENT
        );
    }
}