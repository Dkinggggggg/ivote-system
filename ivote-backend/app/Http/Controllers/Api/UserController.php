<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRequest;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Repositories\Contracts\UserRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

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
        $temporaryPassword = $data['password'] ?? Str::random(24);
        unset($data['password_confirmation']);
        $data['password'] = $temporaryPassword;
        $data['must_change_password'] = $data['role'] === 'admin';
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

        return response()->json([
            'data' => new UserResource($user),
            'temporary_password' => $temporaryPassword,
        ], Response::HTTP_CREATED);
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

    public function resetPassword(Request $request, int $id)
    {
        $data = $request->validate([
            'password' => [
                'required',
                'string',
                'min:8',
                'max:16',
                'confirmed',
                'regex:/[A-Z]/',
                'regex:/[a-z]/',
                'regex:/[0-9]/',
                'regex:/[^A-Za-z0-9]/',
            ],
        ]);

        $user = $this->users->find($id);

        abort_if(!$user, Response::HTTP_NOT_FOUND, 'User not found.');

        $user->forceFill([
            'password' => Hash::make($data['password']),
            'must_change_password' => false,
        ])->save();

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'Reset Password',
            'description' => 'Reset password for "' . $user->name . '"',
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Password reset successfully.',
            'data' => new UserResource($user),
        ]);
    }

    public function setStatus(Request $request, int $id)
    {
        $data = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $user = $this->users->find($id);

        abort_if(
            ! $user,
            Response::HTTP_NOT_FOUND,
            'User not found.'
        );

        abort_if(
            $request->user()->id === $user->id && ! $data['is_active'],
            Response::HTTP_UNPROCESSABLE_ENTITY,
            'You cannot deactivate your own account.'
        );

        $updated = $this->users->update($user, $data);
        $action = $data['is_active'] ? 'Reactivate User' : 'Deactivate User';

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => $action,
            'description' => $action . ' "' . $updated->name . '"',
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