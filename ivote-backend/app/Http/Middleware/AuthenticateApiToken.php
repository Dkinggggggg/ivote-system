<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lightweight bearer-token authentication, replacing the previously
 * broken auth:sanctum setup (Sanctum was never installed - see the
 * note on App\Models\User). Reads "Authorization: Bearer <token>",
 * hashes it, and looks up the matching active user.
 *
 * Register as the 'auth.token' middleware alias in bootstrap/app.php.
 */
class AuthenticateApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            abort(401, 'Authentication required.');
        }

        $user = User::findForToken($token);

        if (! $user || ! $user->is_active) {
            abort(401, 'Invalid or expired token.');
        }

        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
