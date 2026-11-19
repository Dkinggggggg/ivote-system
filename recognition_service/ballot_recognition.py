"""
iVote Ballot Recognition Pipeline - Reference Implementation
Phase 8: Ballot Recognition

This module implements the full pipeline described in the Phase 8 write-up:
perspective correction -> preprocessing -> thresholding -> OCR serial
decoding -> OMR bubble detection -> vote validation -> confidence scoring.

Use this to:
  1. Tune the constants (FILL_THRESHOLD, CONFIDENCE_WEIGHTS, etc.) against
     a folder of real sample ballot photos before locking values in.
  2. Measure accuracy for Phase 9 (Testing) - run it over a labeled batch
     and compare detected votes against known ground truth.
  3. Serve as the exact spec to port into native Android (Kotlin +
     OpenCV4Android + Tesseract4Android) for the production Flutter app,
     since re-implementing OpenCV calls from scratch in production without
     a tuned reference is how accuracy problems creep in silently.

Requires: opencv-python, pytesseract, numpy
"""

import os
import cv2
import numpy as np
import re
import pytesseract

# Configure Tesseract path if found on Windows
if os.path.exists(r"C:\Program Files\Tesseract-OCR\tesseract.exe"):
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
elif os.environ.get("TESSERACT_CMD"):
    pytesseract.pytesseract.tesseract_cmd = os.environ.get("TESSERACT_CMD")

# ---------------------------------------------------------------------
# Tunable constants - adjust these against real sample ballots.
# ---------------------------------------------------------------------
FILL_THRESHOLD = 0.35          # fraction of dark pixels in a bubble ROI to count as "shaded"
MIN_PERSPECTIVE_AREA = 0.5     # detected ballot outline must cover >=50% of frame area
CONFIDENCE_THRESHOLD = 0.85    # below this, route to manual review (matches ScanResult.needsManualReview)


class BallotTemplate:
    """
    Describes where things live on a flattened (perspective-corrected)
    ballot image, in normalized 0-1 coordinates so it's resolution-independent.
    In production this would be loaded per-election from the ballot layout
    generated in Phase 5 (FR-3.2), rather than hardcoded.
    """
    def __init__(self, serial_text_roi, position_bubble_rois, vote_for_counts=None, position_names=None, department_codes=None, position_department_codes=None):
        self.serial_text_roi = serial_text_roi      # (x, y, w, h) normalized
        self.position_bubble_rois = position_bubble_rois
        self.position_names = position_names or {}
        self.department_codes = department_codes or {}
        self.position_department_codes = position_department_codes or {}
        # position_bubble_rois: { position_id: [ {candidate_id, roi:(x,y,w,h)}, ... ] }
        # vote_for_counts: { position_id: int } - how many candidates may be
        # selected for that position (1 for most races, >1 for e.g. "Board
        # Member, vote for 3"). Previously this was read off a
        # candidate-level 'vote_for_count' key that was never populated,
        # so every position was silently treated as vote-for-1.
        self.vote_for_counts = vote_for_counts or {}

    def vote_for_count(self, position_id):
        return self.vote_for_counts.get(position_id, 1)


def _denormalize_roi(roi, image_width, image_height):
    x, y, w, h = roi
    return (
        int(x * image_width), int(y * image_height),
        int(w * image_width), int(h * image_height),
    )


def correct_perspective(image):
    """
    Finds the ballot's outer boundary and warps it to a flat, top-down
    rectangle. Returns (warped_image, success, quality_score).
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return image, False, 0.0

    largest = max(contours, key=cv2.contourArea)
    frame_area = image.shape[0] * image.shape[1]

    if cv2.contourArea(largest) / frame_area < MIN_PERSPECTIVE_AREA:
        return image, False, 0.0

    peri = cv2.arcLength(largest, True)
    approx = cv2.approxPolyDP(largest, 0.02 * peri, True)

    if len(approx) != 4:
        # Ballot outline wasn't cleanly a quadrilateral - likely a bad angle or occlusion.
        return image, False, 0.0

    pts = approx.reshape(4, 2).astype("float32")
    ordered = _order_corners(pts)

    (tl, tr, br, bl) = ordered
    width = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
    height = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))

    destination = np.array([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype="float32")
    matrix = cv2.getPerspectiveTransform(ordered, destination)
    warped = cv2.warpPerspective(image, matrix, (width, height))

    quality_score = min(1.0, cv2.contourArea(largest) / frame_area)
    return warped, True, quality_score


def _order_corners(pts):
    """Orders 4 points as top-left, top-right, bottom-right, bottom-left."""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def preprocess(image):
    """Grayscale + denoise + adaptive threshold. Returns the binary image."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    binary = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 25, 10,
    )
    return binary


def decode_serial_ocr(image, template, image_width, image_height):
    """Read the printed serial number region with OCR."""
    try:
        x, y, w, h = _denormalize_roi(template.serial_text_roi, image_width, image_height)
        roi = image[y:y + h, x:x + w]

        data = pytesseract.image_to_data(
            roi, config="--psm 7 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-",
            output_type=pytesseract.Output.DICT,
        )
        text_parts = [t for t in data["text"] if t.strip()]
        confidences = [int(c) for c in data["conf"] if c not in ("-1", "")]

        if not text_parts:
            return None, 0.0

        serial = "".join(text_parts).strip()
        avg_confidence = (sum(confidences) / len(confidences)) / 100 if confidences else 0.0
        return serial, avg_confidence
    except Exception as e:
        return None, 0.0


def detect_votes(binary_image, template, image_width, image_height, serial_number=None):
    """
    Runs OMR across every position's candidate bubbles.
    Returns { position_id: {"votes": [candidate_id, ...], "is_abstain": bool,
                             "is_overvote": bool, "clarity": float} }
    """
    results = {}
    serial_match = re.fullmatch(r"(\d{2})(\d{3})\d{4}", serial_number or "")
    legacy_department_codes = {
        "01": "BSIT",
        "02": "BSHM",
        "03": "BSE",
        "04": "BTVTED",
        "05": "BINDTECH",
    }
    year_codes = {
        "002": "2nd Year",
        "003": "3rd Year",
        "004": "4th Year",
    }
    department = (
        template.department_codes.get(serial_match.group(1), legacy_department_codes.get(serial_match.group(1)))
        if serial_match else None
    )
    year_level = year_codes.get(serial_match.group(2)) if serial_match else None
    scoped_positions = {}
    top = 0.20

    for position_id, candidates in template.position_bubble_rois.items():
        position_name = template.position_names.get(position_id, "")
        position_department_code = template.position_department_codes.get(position_id)
        if serial_match and position_department_code and str(position_department_code).zfill(2) != serial_match.group(1):
            continue
        if not position_department_code and department and position_name.startswith("Governor - ") and position_name != f"Governor - {department}":
            continue
        if year_level and position_name.startswith("Batch Representative - ") and position_name != f"Batch Representative - {year_level}":
            continue

        if department and year_level:
            scoped_positions[position_id] = []
            for index, candidate in enumerate(candidates):
                x, _, width, height = candidate["roi"]
                scoped_positions[position_id].append({
                    **candidate,
                    "roi": (x, round(top + index * 0.05, 4), width, height),
                })
            top += len(candidates) * 0.05 + 0.05
        else:
            scoped_positions[position_id] = candidates

    for position_id, candidates in scoped_positions.items():

        shaded_candidates = []
        clarity_scores = []

        for candidate in candidates:
            x, y, w, h = _denormalize_roi(candidate["roi"], image_width, image_height)
            roi = binary_image[y:y + h, x:x + w]

            fill_ratio = cv2.countNonZero(roi) / (w * h)
            clarity_scores.append(abs(fill_ratio - FILL_THRESHOLD))  # how decisive the mark is

            if fill_ratio >= FILL_THRESHOLD:
                shaded_candidates.append(candidate["candidate_id"])

        vote_for_count = template.vote_for_count(position_id)
        is_overvote = len(shaded_candidates) > vote_for_count
        is_abstain = len(shaded_candidates) == 0

        results[position_id] = {
            "votes": [] if is_overvote else shaded_candidates,
            "is_abstain": is_abstain,
            "is_overvote": is_overvote,
            "clarity": sum(clarity_scores) / len(clarity_scores) if clarity_scores else 0.0,
        }

    return results


def compute_confidence(perspective_ok, perspective_quality, serial_found, ocr_confidence, avg_bubble_clarity):
    """
    Combines every stage's signal into one confidence score used to decide
    auto-count vs manual review (Phase 4 activity diagram, step 5).
    """
    if not perspective_ok or not serial_found:
        return 0.0

    bubble_score = min(1.0, avg_bubble_clarity / FILL_THRESHOLD)

    # Weighted: serial correctness matters most (duplicate/attribution integrity),
    # then perspective quality, then bubble clarity.
    return (0.5 * ocr_confidence) + (0.25 * perspective_quality) + (0.25 * bubble_score)


def process_ballot_image(image, template: BallotTemplate):
    """
    Runs the full pipeline end to end. Returns a structured result dict
    ready to be submitted to POST /api/scans (Phase 8.3 below).
    """
    warped, perspective_ok, perspective_quality = correct_perspective(image)

    serial_number = None
    ocr_confidence = 0.0

    if not perspective_ok:
        # If the paper boundary is unclear, try OCR on the original frame.
        image_height, image_width = image.shape[:2]
        serial_number, ocr_confidence = decode_serial_ocr(
            image, template, image_width, image_height
        )
        if serial_number:
            warped = image
            perspective_ok = True
            perspective_quality = 0.70
        else:
            return {
                "stage_failed": "perspective_correction",
                "serial_number": None,
                "confidence": 0.0,
                "votes": {},
            }

    height, width = warped.shape[:2]
    binary = preprocess(warped)

    if serial_number is None:
        serial_number, ocr_confidence = decode_serial_ocr(warped, template, width, height)

    votes = detect_votes(binary, template, width, height, serial_number)
    avg_clarity = sum(v["clarity"] for v in votes.values()) / len(votes) if votes else 0.0

    confidence = compute_confidence(
        perspective_ok, perspective_quality,
        serial_number is not None, ocr_confidence, avg_clarity,
    )

    return {
        "stage_failed": None if serial_number else "serial_decode",
        "serial_number": serial_number,
        "decoded_via": "ocr" if serial_number else "none",
        "confidence": round(confidence, 3),
        "needs_manual_review": confidence < CONFIDENCE_THRESHOLD or serial_number is None,
        "votes": votes,
    }
