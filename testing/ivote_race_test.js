/**
 * iVote - Concurrency race demonstration (TC-15)
 * Phase 9: Testing
 *
 * Unlike the PHPUnit test (which proves the DB-level guarantee
 * deterministically), this fires two ACTUAL simultaneous HTTP requests
 * at a running server - the real-world scenario of two Committee
 * Officers scanning the same ballot at nearly the same instant.
 *
 * Run with: k6 run ivote_race_test.js
 * (install k6: https://k6.io/docs/get-started/installation/)
 *
 * Before running: set BASE_URL, TOKEN (a valid Sanctum token), and
 * SERIAL_NUMBER (an 'issued' ballot's serial in your test database).
 */

import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000/api";
const TOKEN = __ENV.TOKEN || "REPLACE_WITH_TEST_TOKEN";
const SERIAL_NUMBER = __ENV.SERIAL_NUMBER || "REPLACE_WITH_ISSUED_SERIAL";
const ELECTION_ID = __ENV.ELECTION_ID || 1;

export const options = {
  scenarios: {
    race: {
      executor: "shared-iterations",
      vus: 2,          // exactly two simulated officers
      iterations: 2,   // each fires exactly once
      maxDuration: "10s",
    },
  },
};

export default function () {
  const payload = JSON.stringify({
    election_id: Number(ELECTION_ID),
    serial_number: SERIAL_NUMBER,
    decoded_via: "qr",
    omr_confidence: 0.95,
    votes: [],
  });

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  };

  const response = http.post(`${BASE_URL}/scans`, payload, { headers });

  check(response, {
    "response is 201 (counted) or 409 (duplicate)": (r) => r.status === 201 || r.status === 409,
  });

  console.log(`VU ${__VU}: status=${response.status} body=${response.body}`);
}

/**
 * Expected outcome across the two VUs:
 *   - Exactly ONE response with status 201 and data.status = "counted"
 *   - Exactly ONE response with status 409 and data.status = "duplicate_rejected"
 * If you ever see two 201s, BR-04 has been violated and the atomic
 * claim in BallotRepository is not working as intended - stop and
 * investigate before this reaches a real election.
 */
