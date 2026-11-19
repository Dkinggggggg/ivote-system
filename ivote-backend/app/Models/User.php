<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

/**
 * Represents an Administrator or Committee Officer account.
 * Public Viewers are NOT represented here - they need no account.
 *
 * Upgraded: this project previously depended on Laravel Sanctum for API
 * tokens, but the package was never actually installed (composer.json
 * never required it), so login/logout was fatal-erroring in practice.
 * Rather than depend on installing a package, this now uses a small,
 * self-contained bearer-token scheme: a single hashed token per user,
 * stored on this table and verified in AuthenticateApiToken. It is
 * intentionally simple (one active session per user, exactly like the
 * old Laravel `api_token` convention) which is appropriate for this
 * system's scale. Swapping in Sanctum later is a drop-in change if
 * multi-device sessions per user are ever needed.
 */
class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'must_change_password',
        'role', // 'admin' | 'committee_officer'
        'precinct',
        'program',
        'year_level',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'api_token',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'must_change_password' => 'boolean',
    ];

    /**
     * True if this user has the admin role.
     * Used throughout controllers/policies to enforce BR-07
     * (only Admin can manage elections/positions/candidates).
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function getPrecinctAttribute($value): ?string
    {
        if ($value !== null && $value !== '') {
            return $value;
        }

        if ($this->role === 'committee_officer' && $this->program && $this->year_level) {
            return $this->program . ' - ' . $this->year_level;
        }

        return $value;
    }

    /**
     * Scans this user (as a Committee Officer) has performed.
     */
    public function ballotScans()
    {
        return $this->hasMany(BallotScan::class, 'scanned_by');
    }

    /**
     * Issues a fresh bearer token for this user, invalidating any
     * previous one, and returns the PLAINTEXT token (only ever
     * available at issuance time - only the hash is persisted).
     */
    public function issueApiToken(): string
    {
        $plainTextToken = Str::random(64);

        $this->forceFill([
            'api_token' => hash('sha256', $plainTextToken),
        ])->save();

        return $plainTextToken;
    }

    /**
     * Revokes the current token, logging this user out everywhere.
     */
    public function revokeApiToken(): void
    {
        $this->forceFill(['api_token' => null])->save();
    }

    public static function findForToken(string $plainTextToken): ?self
    {
        return static::where('api_token', hash('sha256', $plainTextToken))->first();
    }
}
