<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BallotController;
use App\Http\Controllers\Api\CandidateController;
use App\Http\Controllers\Api\ElectionController;
use App\Http\Controllers\Api\PositionController;
use App\Http\Controllers\Api\PositionCategoryController;
use App\Http\Controllers\Api\PartyController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ScanController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// ---------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------
Route::post('/login', [AuthController::class, 'login']);

Route::get('/elections/active', [ElectionController::class, 'active']);
Route::get('/elections/current/public-results', [ElectionController::class, 'currentPublicResults']);
Route::get('/elections/{election}/public-results', [ElectionController::class, 'publicResults']);

/*
|--------------------------------------------------------------------------
| Public QR Ballot Verification
|--------------------------------------------------------------------------
*/
Route::get('/ballots/verify/{serialNumber}', [BallotController::class, 'verify']);

// ---------------------------------------------------------------------
// Authenticated routes
// ---------------------------------------------------------------------
Route::middleware('auth.token')->group(function () {

    Route::post('/logout', [AuthController::class, 'logout'])->name('auth.logout');
    Route::post('/change-password', [AuthController::class, 'changePassword'])->name('auth.change-password');

    // Elections
    Route::get('/elections', [ElectionController::class, 'index']);
    Route::get('/elections/{election}', [ElectionController::class, 'show']);
    Route::get('/elections/{election}/results', [ElectionController::class, 'results']);

    // Positions & Candidates
    Route::get('/positions/{position}/candidates', [CandidateController::class, 'index']);
    Route::get('/elections/{election}/positions', [PositionController::class, 'index']);
    Route::get('/elections/{election}/position-categories', [PositionCategoryController::class, 'index']);

    // Ballots
    Route::get('/ballots/print-selected', [BallotController::class, 'printSelected']);
    Route::get('/ballots/{ballot}', [BallotController::class, 'show']);

    // Scanner
    Route::post('/scans', [ScanController::class, 'store']);
    Route::get('/scans/recent', [ScanController::class, 'recent']);
});

// ---------------------------------------------------------------------
// Admin-only routes
// ---------------------------------------------------------------------
Route::middleware(['auth.token', 'admin'])->group(function () {

    // =====================================================
    // Elections
    // =====================================================
    Route::post('/elections', [ElectionController::class, 'store']);
    Route::put('/elections/{election}', [ElectionController::class, 'update']);
    Route::delete('/elections/{election}', [ElectionController::class, 'destroy']);

    Route::patch('/elections/{election}/activate', [ElectionController::class, 'activate']);
    Route::patch('/elections/{election}/close', [ElectionController::class, 'close']);
    Route::post('/elections/{election}/finalize', [ElectionController::class, 'finalize']);

    // =====================================================
    // Positions
    // =====================================================
    Route::post('/elections/{election}/positions', [PositionController::class, 'store']);
    Route::put('/elections/{election}/positions/{position}', [PositionController::class, 'update']);
    Route::delete('/elections/{election}/positions/{position}', [PositionController::class, 'destroy']);
    Route::post('/elections/{election}/position-categories', [PositionCategoryController::class, 'store']);
    Route::put('/elections/{election}/position-categories/{category}', [PositionCategoryController::class, 'update']);
    Route::delete('/elections/{election}/position-categories/{category}', [PositionCategoryController::class, 'destroy']);

    // =====================================================
    // Candidates
    // =====================================================
    Route::get('/elections/{election}/parties', [PartyController::class, 'index']);
    Route::post('/elections/{election}/parties', [PartyController::class, 'store']);
    Route::put('/elections/{election}/parties/{id}', [PartyController::class, 'update']);
    Route::delete('/elections/{election}/parties/{id}', [PartyController::class, 'destroy']);

    Route::get('/elections/{election}/candidates', [CandidateController::class, 'indexForElection']);
    Route::post('/elections/{election}/candidates', [CandidateController::class, 'storeForElection']);
    Route::put('/elections/{election}/candidates/{id}', [CandidateController::class, 'updateForElection']);
    Route::delete('/elections/{election}/candidates/{id}', [CandidateController::class, 'destroyForElection']);

    Route::post('/positions/{position}/candidates', [CandidateController::class, 'store']);
    Route::put('/positions/{position}/candidates/{candidate}', [CandidateController::class, 'update']);
    Route::delete('/positions/{position}/candidates/{candidate}', [CandidateController::class, 'destroy']);

    // =====================================================
    // Ballots
    // =====================================================
    Route::get('/ballots', [BallotController::class, 'index']);
    Route::get('/ballots/print-next-batch', [BallotController::class, 'printNextBatch']);
    Route::get('/ballots/print/{quantity}', [BallotController::class, 'printByQuantity'])
        ->whereNumber('quantity');
    Route::post('/ballots/generate', [BallotController::class, 'generate']);
    Route::post('/ballots/mark-printed', [BallotController::class, 'markPrinted']);
    Route::post('/ballots/delete-multiple', [BallotController::class, 'destroyMultiple']);
    Route::delete('/ballots/{ballot}', [BallotController::class, 'destroy']);

    // =====================================================
    // Users
    // =====================================================
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{user}', [UserController::class, 'update']);
    Route::patch('/users/{user}/status', [UserController::class, 'setStatus']);
    Route::delete('/users/{user}', [UserController::class, 'destroy']);

    // =====================================================
    // Reports & Audit Logs
    // =====================================================
    Route::get('/audit-logs', [AuditLogController::class, 'index']);

    // Returns the winners for display in the Reports page
    Route::get('/reports/winners', [ReportController::class, 'winners']);

    // Downloads CSV reports
    Route::get('/reports/{type}', [ReportController::class, 'show']);
});
