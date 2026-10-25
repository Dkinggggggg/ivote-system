<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCandidateRequest;
use App\Http\Resources\CandidateResource;
use App\Models\AuditLog;
use App\Models\Position;
use App\Repositories\Contracts\CandidateRepositoryInterface;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CandidateController extends Controller
{
    public function __construct(
        private readonly CandidateRepositoryInterface $candidates
    ) {
    }

    public function index(int $positionId)
    {
        $position = Position::findOrFail($positionId);

        $candidates = $this->candidates->allForPosition($positionId);

        return response()->json([
            'position' => [
                'id' => $position->id,
                'name' => $position->name,
                'vote_for_count' => $position->vote_for_count,
            ],

            'total_candidates' => $candidates->count(),

            'data' => CandidateResource::collection($candidates),
        ]);
    }

    public function store(StoreCandidateRequest $request, int $positionId)
    {
        $data = $this->prepareData($request->validated(), $request);
        $data['position_id'] = $positionId;

        $candidate = $this->candidates->create($data);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'CREATE_CANDIDATE',
            'description' => 'Created candidate "' . $candidate->name . '".',
            'ip_address' => $request->ip(),
        ]);

        return (new CandidateResource($candidate))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(StoreCandidateRequest $request, int $positionId, int $id)
    {
        $candidate = $this->candidates->find($id);

        abort_if(
            ! $candidate || $candidate->position_id !== $positionId,
            Response::HTTP_NOT_FOUND,
            'Candidate not found.'
        );

        $oldPhotoUrl = $candidate->photo_url;

        $updated = $this->candidates->update(
            $candidate,
            $this->prepareData($request->validated(), $request)
        );

        if ($request->hasFile('photo_url')) {
            $this->deleteStoredPhoto($oldPhotoUrl);
        }

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'UPDATE_CANDIDATE',
            'description' => 'Updated candidate "' . $updated->name . '".',
            'ip_address' => $request->ip(),
        ]);

        return new CandidateResource($updated);
    }

    public function destroy(int $positionId, int $id)
    {
        $candidate = $this->candidates->find($id);

        abort_if(
            ! $candidate || $candidate->position_id !== $positionId,
            Response::HTTP_NOT_FOUND,
            'Candidate not found.'
        );

        $name = $candidate->name;
        $photoUrl = $candidate->photo_url;

        $this->candidates->delete($candidate);

        $this->deleteStoredPhoto($photoUrl);

        AuditLog::create([
            'user_id' => auth()->id(),
            'action' => 'DELETE_CANDIDATE',
            'description' => 'Deleted candidate "' . $name . '".',
            'ip_address' => request()->ip(),
        ]);

        return response()->json(
            null,
            Response::HTTP_NO_CONTENT
        );
    }

    private function prepareData(array $data, StoreCandidateRequest $request): array
    {
        if ($request->hasFile('photo_url')) {
            $data['photo_url'] = $request->file('photo_url')->store('candidates', 'public');
        } else {
            unset($data['photo_url']);
        }

        return $data;
    }

    private function deleteStoredPhoto(?string $photoUrl): void
    {
        if (! $photoUrl || Str::startsWith($photoUrl, ['http://', 'https://'])) {
            return;
        }

        Storage::disk('public')->delete($photoUrl);
    }
}