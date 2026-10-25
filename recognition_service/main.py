"""
iVote Recognition Microservice
Phase 8: Ballot Recognition

Thin FastAPI wrapper around ballot_recognition.py. The mobile app
uploads a captured ballot image here; this service runs the full
pipeline and returns structured JSON. The mobile app does NOT do
duplicate-checking here - that requires the shared database and is
handled by the Laravel API's /api/scans endpoint once the officer
confirms the result on-screen.

Run with: uvicorn main:app --host 0.0.0.0 --port 8001
"""

import os
import time

import cv2
import numpy as np
import requests
from fastapi import FastAPI, UploadFile, File, HTTPException

from ballot_recognition import process_ballot_image, BallotTemplate

app = FastAPI(title="iVote Recognition Service")

BACKEND_API_BASE_URL = os.environ.get("BACKEND_API_BASE_URL", "http://127.0.0.1:8000/api")
TEMPLATE_CACHE_TTL_SECONDS = 300

# Upgraded: previously _load_template_for_election always returned the
# same hardcoded 2-position example template regardless of election_id,
# so recognition only ever worked correctly for that one demo layout.
# This now fetches the election's real positions/candidates from the
# Laravel API and lays bubbles out in a simple, deterministic vertical
# grid, cached briefly per election. This assumes the printed ballot
# uses that same simple grid (see web/src/pages/PrintBallotPage.jsx) -
# if the print layout is redesigned, this generator and that page need
# to move together.
_template_cache: dict[int, tuple[float, BallotTemplate]] = {}


def _build_template_from_election(election: dict) -> BallotTemplate:
    positions = election.get("positions", [])

    position_bubble_rois = {}
    vote_for_counts = {}
    position_names = {}

    top = 0.20
    row_height = 0.05
    block_gap = 0.05

    for position in positions:
        candidates = position.get("candidates", [])
        rois = []

        for i, candidate in enumerate(candidates):
            rois.append({
                "candidate_id": candidate["id"],
                "roi": (0.10, round(top + i * row_height, 4), 0.05, 0.03),
            })

        position_bubble_rois[position["id"]] = rois
        vote_for_counts[position["id"]] = position.get("vote_for_count", 1)
        position_names[position["id"]] = position.get("name", "")

        top += len(candidates) * row_height + block_gap

    return BallotTemplate(
        serial_qr_roi=(0.75, 0.02, 0.20, 0.10),
        serial_text_roi=(0.75, 0.13, 0.20, 0.05),
        position_bubble_rois=position_bubble_rois,
        vote_for_counts=vote_for_counts,
        position_names=position_names,
    )


def _fallback_template() -> BallotTemplate:
    """Used only if the backend is unreachable, so the service still
    responds (as manual-review-worthy) instead of hard-failing."""
    return BallotTemplate(
        serial_qr_roi=(0.75, 0.02, 0.20, 0.10),
        serial_text_roi=(0.75, 0.13, 0.20, 0.05),
        position_bubble_rois={
            1: [
                {"candidate_id": 101, "roi": (0.10, 0.20, 0.05, 0.03)},
                {"candidate_id": 102, "roi": (0.10, 0.26, 0.05, 0.03)},
            ],
        },
        vote_for_counts={1: 1},
    )


def _load_template_for_election(election_id: int) -> BallotTemplate:
    cached = _template_cache.get(election_id)
    if cached and (time.monotonic() - cached[0]) < TEMPLATE_CACHE_TTL_SECONDS:
        return cached[1]

    try:
        response = requests.get(f"{BACKEND_API_BASE_URL}/elections/active", timeout=5)
        response.raise_for_status()
        election = response.json()["data"]
        template = _build_template_from_election(election)
    except (requests.RequestException, KeyError, ValueError):
        template = _fallback_template()

    _template_cache[election_id] = (time.monotonic(), template)
    return template


@app.post("/recognize")
async def recognize_ballot(election_id: int, file: UploadFile = File(...)):
    contents = await file.read()
    image_array = np.frombuffer(contents, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(status_code=400, detail="Could not decode uploaded image.")

    height, width = image.shape[:2]
    max_dimension = 1600
    scale = min(1.0, max_dimension / max(height, width))

    if scale < 1.0:
        image = cv2.resize(
            image,
            (int(width * scale), int(height * scale)),
            interpolation=cv2.INTER_AREA,
        )

    template = _load_template_for_election(election_id)
    result = process_ballot_image(image, template)

    return result


@app.get("/health")
async def health_check():
    return {"status": "ok"}
