import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/Layout/AppLayout';

import CenteredLoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ElectionsPage from './pages/ElectionsPage';
import PositionsPage from './pages/PositionsPage';
import CandidatesPage from './pages/CandidatesPage';
import ElectionCandidatesPage from './pages/ElectionCandidatesPage';
import BallotsPage from './pages/BallotsPage';

import PrintBallotPage from './pages/PrintBallotPage';
import PrintMultipleBallotsPage from './pages/PrintMultipleBallotsPage';

import ScannerPage from './pages/ScannerPage';
import ReportsPage from './pages/ReportsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import UsersPage from './pages/UsersPage';
import PrecinctsPage from './pages/PrecinctsPage';
import SettingsPage from './pages/SettingsPage';
import PublicResultsPage from './pages/PublicResultsPage';
import VerifyBallotPage from './pages/VerifyBallotPage';
import LandingPage from './pages/LandingPage';

export default function App() {

  return (

    <BrowserRouter>

      <AuthProvider>

        <Routes>

          {/* PUBLIC PAGES */}

          <Route
            path="/"
            element={<LandingPage />}
          />

          <Route
            path="/results"
            element={<ThemeProvider><PublicResultsPage /></ThemeProvider>}
          />

          <Route
            path="/verify/:serialNumber"
            element={<VerifyBallotPage />}
          />

          <Route
            path="/login"
            element={<CenteredLoginPage />}
          />

          {/* PROTECTED ROUTES */}

          <Route element={<ProtectedRoute />}>

            {/* PRINT PAGES */}

            <Route
              path="/ballots/print"
              element={<PrintMultipleBallotsPage />}
            />

            <Route
              path="/ballots/:ballotId/print"
              element={<PrintBallotPage />}
            />

            {/* SYSTEM */}

            <Route element={<AppLayout />}>

              <Route
                path="/dashboard"
                element={<DashboardPage />}
              />

              <Route
                path="/elections"
                element={<ElectionsPage />}
              />

              <Route
                path="/election-management"
                element={<ElectionsPage />}
              />

              <Route
                path="/election-management/party-list"
                element={<ElectionCandidatesPage />}
              />

              <Route
                path="/election-management/candidates"
                element={<ElectionCandidatesPage />}
              />

              <Route
                path="/election-management/review"
                element={<ElectionCandidatesPage />}
              />

              <Route
                path="/election-management/:electionId/party-list"
                element={<ElectionCandidatesPage />}
              />

              <Route
                path="/election-management/:electionId/candidates"
                element={<ElectionCandidatesPage />}
              />

              <Route
                path="/election-management/:electionId/review"
                element={<ElectionCandidatesPage />}
              />

              <Route
                path="/elections/:electionId/positions"
                element={<PositionsPage />}
              />

              <Route
                path="/elections/:electionId/candidates"
                element={<ElectionCandidatesPage />}
              />

              <Route
                path="/positions/:positionId/candidates"
                element={<CandidatesPage />}
              />

              <Route
                path="/candidates"
                element={<ElectionsPage />}
              />

              <Route
                path="/ballots"
                element={<BallotsPage />}
              />

              <Route
                path="/scanner"
                element={<ScannerPage />}
              />

              <Route
                path="/reports"
                element={<ReportsPage />}
              />

              <Route
                path="/audit-logs"
                element={<AuditLogsPage />}
              />

              <Route
                path="/users"
                element={<UsersPage />}
              />

              <Route
                path="/precincts"
                element={<PrecinctsPage />}
              />

              <Route
                path="/settings"
                element={<SettingsPage />}
              />

            </Route>

          </Route>

        </Routes>

      </AuthProvider>

    </BrowserRouter>

  );

}