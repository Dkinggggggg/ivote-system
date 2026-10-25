-- =====================================================================
-- iVote: Mobile Ballot Recognition System
-- Database Schema (MySQL 8.0+)
-- Phase 3 - Database Design
-- =====================================================================
-- Traces to:
--   BR-02  ballots.serial_number + qr_code_value are both UNIQUE
--   BR-03  votes.is_abstain allows a null candidate per position
--   BR-04  UNIQUE constraints prevent duplicate ballot counting
--   BR-06  votes are per-position, so an overvote invalidates only
--          that position (handled at application layer during scan
--          validation, before insert)
--   BR-07  users.role restricts election/position/candidate management
--   BR-09  ballots.status = 'counted' is the only status the live
--          dashboard aggregates over
-- =====================================================================

CREATE DATABASE IF NOT EXISTS ivote_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ivote_db;

-- ---------------------------------------------------------------------
-- Table: users
-- Administrators and Committee Officers. Public Viewers need no account.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    email           VARCHAR(150)    NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    role            ENUM('admin', 'committee_officer') NOT NULL,
    program         ENUM('BSIT', 'BTVTED', 'BSE', 'BINDTECH') NULL,
    year_level      ENUM('2nd Year', '3rd Year', '4th Year') NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Table: elections
-- One row per election event (e.g., "SR Elections A.Y. 2026-2027").
-- ---------------------------------------------------------------------
CREATE TABLE elections (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(150)    NOT NULL,
    status          ENUM('draft', 'active', 'closed') NOT NULL DEFAULT 'draft',
    start_date      DATE            NULL,
    end_date        DATE            NULL,
    finalized_at    TIMESTAMP       NULL,
    final_results   JSON            NULL,
    created_by      INT UNSIGNED    NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_elections_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Table: positions
-- Positions being contested within an election (President, Senator...).
-- vote_for_count supports multi-seat positions.
-- ---------------------------------------------------------------------
CREATE TABLE positions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    election_id     INT UNSIGNED    NOT NULL,
    program         ENUM('BSIT', 'BTVTED', 'BSE', 'BINDTECH') NULL,
    year_level      ENUM('2nd Year', '3rd Year', '4th Year') NULL,
    name            VARCHAR(100)    NOT NULL,
    vote_for_count  TINYINT UNSIGNED NOT NULL DEFAULT 1,
    display_order   TINYINT UNSIGNED NOT NULL DEFAULT 0,
    CONSTRAINT fk_positions_election
        FOREIGN KEY (election_id) REFERENCES elections(id)
        ON DELETE CASCADE,
    INDEX idx_positions_election (election_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Table: candidates
-- ---------------------------------------------------------------------
CREATE TABLE candidates (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    position_id     INT UNSIGNED    NOT NULL,
    name            VARCHAR(150)    NOT NULL,
    party           VARCHAR(100)    NULL,
    photo_url       VARCHAR(255)    NULL,
    display_order   TINYINT UNSIGNED NOT NULL DEFAULT 0,
    CONSTRAINT fk_candidates_position
        FOREIGN KEY (position_id) REFERENCES positions(id)
        ON DELETE CASCADE,
    INDEX idx_candidates_position (position_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Table: ballots
-- One row per physical ballot generated. serial_number is the
-- human-readable fallback; qr_code_value is the primary machine-read
-- source (see Phase 1 BR-02 revision).
-- ---------------------------------------------------------------------
CREATE TABLE ballots (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    election_id     INT UNSIGNED    NOT NULL,
    serial_number   VARCHAR(30)     NOT NULL,
    qr_code_value   VARCHAR(100)    NOT NULL,
    status          ENUM('issued', 'counted', 'duplicate_rejected', 'manual_review')
                                    NOT NULL DEFAULT 'issued',
    generated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ballots_election
        FOREIGN KEY (election_id) REFERENCES elections(id)
        ON DELETE CASCADE,
    UNIQUE KEY uq_ballots_serial (serial_number),
    UNIQUE KEY uq_ballots_qr (qr_code_value),
    INDEX idx_ballots_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Table: ballot_scans
-- One row per scan ATTEMPT (a ballot may have more than one attempt;
-- only one should ever reach status = 'counted', enforced by the
-- application layer checking ballots.status before insert).
-- ---------------------------------------------------------------------
CREATE TABLE ballot_scans (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ballot_id       INT UNSIGNED    NOT NULL,
    scanned_by      INT UNSIGNED    NOT NULL,
    image_path      VARCHAR(255)    NULL,
    ocr_result      VARCHAR(30)     NULL,
    omr_confidence  DECIMAL(4,3)    NULL,
    status          ENUM('counted', 'duplicate_rejected', 'manual_review', 'error')
                                    NOT NULL,
    scanned_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_scans_ballot
        FOREIGN KEY (ballot_id) REFERENCES ballots(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_scans_user
        FOREIGN KEY (scanned_by) REFERENCES users(id)
        ON DELETE RESTRICT,
    INDEX idx_scans_ballot (ballot_id),
    INDEX idx_scans_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Table: votes
-- One row per position, per successful scan. candidate_id is NULL
-- when is_abstain = TRUE (BR-03).
-- ---------------------------------------------------------------------
CREATE TABLE votes (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ballot_scan_id  INT UNSIGNED    NOT NULL,
    position_id     INT UNSIGNED    NOT NULL,
    candidate_id    INT UNSIGNED    NULL,
    is_abstain      BOOLEAN         NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_votes_scan
        FOREIGN KEY (ballot_scan_id) REFERENCES ballot_scans(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_votes_position
        FOREIGN KEY (position_id) REFERENCES positions(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_votes_candidate
        FOREIGN KEY (candidate_id) REFERENCES candidates(id)
        ON DELETE RESTRICT,
    INDEX idx_votes_tally (position_id, candidate_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Table: audit_logs
-- Every login, scan, and admin action for full traceability.
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED    NULL,
    action          VARCHAR(100)    NOT NULL,
    description     TEXT            NULL,
    ip_address      VARCHAR(45)     NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_audit_user_date (user_id, created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Table: settings
-- Simple key-value store for system-wide configuration.
-- ---------------------------------------------------------------------
CREATE TABLE settings (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    setting_key     VARCHAR(100)    NOT NULL,
    setting_value   TEXT            NULL,
    UNIQUE KEY uq_settings_key (setting_key)
) ENGINE=InnoDB;
