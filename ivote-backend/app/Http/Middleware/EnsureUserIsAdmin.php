<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks any authenticated user who is not an Admin.
 * Registered as the 'admin' middleware alias in bootstrap/app.php.
 */
class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user() || ! $request->user()->isAdmin()) {
            abort(403, 'This action requires Administrator privileges.');
        }

        return $next($request);
    }
}
