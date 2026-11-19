<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePositionCategoryRequest;
use App\Http\Resources\PositionCategoryResource;
use App\Models\AuditLog;
use App\Models\Election;
use App\Models\PositionCategory;
use Illuminate\Http\Response;

class PositionCategoryController extends Controller
{
    public function index(int $electionId)
    {
        Election::findOrFail($electionId);
        PositionCategory::provisionDefaultsForElection($electionId);

        return PositionCategoryResource::collection(
            PositionCategory::where('election_id', $electionId)
                ->whereNotIn('name', ['Custom Positions', 'Custom Position'])
                ->orderBy('id')
                ->get()
        );
    }

    public function store(StorePositionCategoryRequest $request, int $electionId)
    {
        $category = PositionCategory::create([
            ...$request->validated(),
            'election_id' => $electionId,
        ]);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'CREATE_POSITION_CATEGORY',
            'description' => 'Created position category "' . $category->name . '"',
            'ip_address' => $request->ip(),
        ]);

        return (new PositionCategoryResource($category))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(StorePositionCategoryRequest $request, int $electionId, int $id)
    {
        $category = PositionCategory::where('election_id', $electionId)->findOrFail($id);
        $oldName = $category->name;
        $category->update($request->validated());
        $category->refresh();

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'UPDATE_POSITION_CATEGORY',
            'description' => 'Renamed position category "' . $oldName . '" to "' . $category->name . '"',
            'ip_address' => $request->ip(),
        ]);

        return new PositionCategoryResource($category);
    }

    public function destroy(int $electionId, int $id)
    {
        $category = PositionCategory::where('election_id', $electionId)->findOrFail($id);

        abort_if(
            $category->positions()->exists(),
            Response::HTTP_UNPROCESSABLE_ENTITY,
            'Reassign or delete the positions in this category before deleting it.'
        );

        $categoryName = $category->name;
        $category->delete();

        AuditLog::create([
            'user_id' => request()->user()->id,
            'action' => 'DELETE_POSITION_CATEGORY',
            'description' => 'Deleted position category "' . $categoryName . '"',
            'ip_address' => request()->ip(),
        ]);

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}