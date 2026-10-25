<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Log in an Admin or Committee Officer and issue a bearer token.
     * Rate-limited to slow down credential-stuffing / brute-force attempts.
     */
    public function login(Request $request)
    {
        $request->validate([
            'username' => ['required_without:email', 'nullable', 'string', 'max:150'],
            'email' => ['required_without:username', 'nullable', 'string', 'max:150'],
            'password' => ['required', 'string'],
            'role' => ['required', Rule::in(['admin', 'committee_officer'])],
        ]);

        $identifier = $request->input('username') ?? $request->input('email');
        $throttleKey = strtolower($identifier) . '|' . $request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            throw ValidationException::withMessages([
                'username' => "Too many login attempts. Try again in {$seconds} seconds.",
            ]);
        }

        if (!Auth::once(['email' => $identifier, 'password' => $request->input('password')])) {

            RateLimiter::hit($throttleKey, 60);

            // OPTIONAL: Log failed login attempts
            AuditLog::create([
                'user_id' => null,
                'action' => 'failed_login',
                'description' => "Failed login attempt for {$identifier}",
                'ip_address' => $request->ip(),
            ]);

            throw ValidationException::withMessages([
                'username' => 'The provided credentials are incorrect.',
            ]);
        }

        RateLimiter::clear($throttleKey);

        /** @var User $user */
        $user = Auth::user();

        if ($user->role !== $request->input('role')) {

            AuditLog::create([
                'user_id' => $user->id,
                'action' => 'login_blocked',
                'description' => "{$user->name} selected an invalid role during login.",
                'ip_address' => $request->ip(),
            ]);

            throw ValidationException::withMessages([
                'role' => 'The selected role does not match this account.',
            ]);
        }

        if (!$user->is_active) {

            AuditLog::create([
                'user_id' => $user->id,
                'action' => 'login_blocked',
                'description' => "{$user->name} attempted to log in while account is inactive.",
                'ip_address' => $request->ip(),
            ]);

            throw ValidationException::withMessages([
                'username' => 'This account has been deactivated.',
            ]);
        }

        $token = $user->issueApiToken();

        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'login',
            'description' => "{$user->name} logged in.",
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
            ],
        ]);
    }

    /**
     * Revoke the current bearer token (log out of this device).
     */
    public function logout(Request $request)
    {
        $user = $request->user();

        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'logout',
            'description' => "{$user->name} logged out.",
            'ip_address' => $request->ip(),
        ]);

        $user->revokeApiToken();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }
}