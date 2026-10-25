<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRequest;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Repositories\Contracts\UserRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Admin-only management of Admin/Committee Officer accounts
 * (the Users page in the web dashboard).
 */
class UserController extends Controller
{
    public function __construct(
        private readonly UserRepositoryInterface $users
    ) {
    }

    public function index()
    {
        return UserResource::collection($this->users->all());
    }

    public function store(StoreUserRequest $request)
    {
        $data = $request->validated();
        $data['email'] = $data['username'];
        unset($data['username']);
        $data['is_active'] ??= true;

        $user = $this->users->create($data);

        // ==============================
        // AUDIT LOG
        // ==============================
        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'Create User',
            'description' => 'Created user "' . $user->name . '"',
            'ip_address' => $request->ip(),
        ]);

        return (new UserResource($user))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(StoreUserRequest $request, int $id)
    {
        $user = $this->users->find($id);

        abort_if(
            ! $user,
            Response::HTTP_NOT_FOUND,
            'User not found.'
        );

        $data = $request->validated();
        $data['email'] = $data['username'];
        unset($data['username']);

        $updated = $this->users->update($user, $data);

        // ==============================
        // AUDIT LOG
        // ==============================
        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'Update User',
            'description' => 'Updated user "' . $updated->name . '"',
            'ip_address' => $request->ip(),
        ]);

        return new UserResource($updated);
    }

    public function destroy(Request $request, int $id)
    {
        abort_if(
            $request->user()->id === $id,
            Response::HTTP_UNPROCESSABLE_ENTITY,
            'You cannot delete your own account.'
        );

        $user = $this->users->find($id);

        abort_if(
            ! $user,
            Response::HTTP_NOT_FOUND,
            'User not found.'
        );

        $deletedName = $user->name;

        $this->users->delete($user);

        // ==============================
        // AUDIT LOG
        // ==============================
        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'Delete User',
            'description' => 'Deleted user "' . $deletedName . '"',
            'ip_address' => $request->ip(),
        ]);

        return response()->json(
            null,
            Response::HTTP_NO_CONTENT
        );
    }
}