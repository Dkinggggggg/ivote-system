<?php

namespace App\Providers;

use App\Repositories\Contracts\BallotRepositoryInterface;
use App\Repositories\Contracts\CandidateRepositoryInterface;
use App\Repositories\Contracts\ElectionRepositoryInterface;
use App\Repositories\Contracts\PositionRepositoryInterface;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Repositories\Eloquent\BallotRepository;
use App\Repositories\Eloquent\CandidateRepository;
use App\Repositories\Eloquent\ElectionRepository;
use App\Repositories\Eloquent\PositionRepository;
use App\Repositories\Eloquent\UserRepository;
use Illuminate\Support\ServiceProvider;

/**
 * Binds each repository interface to its Eloquent implementation.
 * Registered in bootstrap/providers.php.
 *
 * This is the ONLY place in the whole app that knows the concrete
 * repository classes - everywhere else, controllers type-hint the
 * interface and Laravel's container resolves it here.
 */
class RepositoryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(ElectionRepositoryInterface::class, ElectionRepository::class);
        $this->app->bind(PositionRepositoryInterface::class, PositionRepository::class);
        $this->app->bind(CandidateRepositoryInterface::class, CandidateRepository::class);
        $this->app->bind(BallotRepositoryInterface::class, BallotRepository::class);
        $this->app->bind(UserRepositoryInterface::class, UserRepository::class);
    }
}
