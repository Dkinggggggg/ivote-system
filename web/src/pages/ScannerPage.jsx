import React, { useEffect, useRef, useState } from 'react';
import apiClient from '../api/apiClient';
import '../pages/ScannerPage.css';

const ANALYSIS_WIDTH = 480;
const REQUIRED_STABLE_FRAMES = 4;

function detectRegistrationFrame(context, width, height) {
  const pixels = context.getImageData(0, 0, width, height).data;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const markers = [];

  for (let start = 0; start < width * height; start += 1) {
    if (visited[start]) continue;
    visited[start] = 1;
    const startOffset = start * 4;
    // Dark marker threshold (allow up to average 90 per channel for indoor lighting)
    if (pixels[startOffset] + pixels[startOffset + 1] + pixels[startOffset + 2] > 270) continue;

    let head = 0;
    let tail = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    queue[tail++] = start;

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [index - 1, index + 1, index - width, index + width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= width * height || visited[neighbor]) continue;
        const neighborX = neighbor % width;
        if (Math.abs(neighborX - x) > 1) continue;
        visited[neighbor] = 1;
        const offset = neighbor * 4;
        if (pixels[offset] + pixels[offset + 1] + pixels[offset + 2] <= 270) {
          queue[tail++] = neighbor;
        }
      }
    }

    const markerWidth = maxX - minX + 1;
    const markerHeight = maxY - minY + 1;
    const ratio = markerWidth / markerHeight;
    const fillRatio = tail / (markerWidth * markerHeight);
    if (
      markerWidth >= 5 && markerHeight >= 5 &&
      markerWidth <= 65 && markerHeight <= 65 &&
      ratio >= 0.65 && ratio <= 1.5 && fillRatio >= 0.55
    ) {
      markers.push({
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        size: (markerWidth + markerHeight) / 2,
      });
    }
  }

  let bestFrame = null;
  let bestArea = 0;
  const alignmentTolerance = Math.max(width, height) * 0.16;
  const matchTolerance = Math.max(width, height) * 0.08;

  for (const topLeft of markers) {
    for (const topRight of markers) {
      const frameWidth = topRight.x - topLeft.x;
      if (frameWidth < width * 0.25 || Math.abs(topRight.y - topLeft.y) > alignmentTolerance) continue;

      for (const bottomLeft of markers) {
        const frameHeight = bottomLeft.y - topLeft.y;
        if (frameHeight < height * 0.25 || Math.abs(bottomLeft.x - topLeft.x) > alignmentTolerance) continue;

        const expectedRight = topRight.x + bottomLeft.x - topLeft.x;
        const expectedBottom = topRight.y + bottomLeft.y - topLeft.y;
        const bottomRight = markers.find((marker) =>
          marker !== topLeft && marker !== topRight && marker !== bottomLeft &&
          Math.hypot(marker.x - expectedRight, marker.y - expectedBottom) <= matchTolerance
        );
        if (!bottomRight) continue;

        const area = frameWidth * frameHeight;
        if (area > bestArea) {
          bestArea = area;
          bestFrame = [topLeft, topRight, bottomRight, bottomLeft];
        }
      }
    }
  }

  return bestFrame;
}

export default function ScannerPage() {
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraRequestRef = useRef(0);
  const canvasRef = useRef(null);
  const analysisCanvasRef = useRef(null);
  const processingRef = useRef(false);
  const autoCaptureRef = useRef(false);
  const stabilityRef = useRef({ frame: null, count: 0 });

  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState(null);
  const [stream, setStream] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [electionId, setElectionId] = useState(null);
  const [scanFrame, setScanFrame] = useState(null);
  const [scannerReady, setScannerReady] = useState(false);
  const fileInputRef = useRef(null);

  const defaultRecognitionBase = import.meta.env.VITE_RECOGNITION_SERVICE_URL || '/recognition';

  const isLocalCameraHost = () => {
    const host = window.location.hostname;
    return window.location.protocol === 'https:' || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  };

  // Mount effect: load election & initialize camera stream
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const resp = await apiClient.get('/elections/active');
        if (active && resp.data?.data?.id) {
          setElectionId(resp.data.data.id);
        }
      } catch (e) {
        console.warn('Could not fetch active election id:', e);
      }

      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        if (active) {
          setError('Camera APIs are not available in this browser. Try Chrome, Edge, or Safari on a secure page.');
          setCameraFailed(true);
        }
        return;
      }

      if (!window.isSecureContext && !isLocalCameraHost()) {
        if (active) {
          setError(
            `Camera access requires HTTPS or localhost. To use your phone or other device on this network, open: https://${window.location.hostname}:5173/scanner`
          );
          setCameraFailed(true);
        }
        return;
      }

      // Start stream immediately so browser prompts for permission
      if (active) {
        startStream();
      }
    })();

    return () => {
      active = false;
      cameraRequestRef.current += 1;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Frame inspection loop for auto-detection and overlay alignment
  useEffect(() => {
    if (!stream || processing || result) {
      stabilityRef.current = { frame: null, count: 0 };
      setScanFrame(null);
      setScannerReady(false);
      return undefined;
    }

    let animationFrame;
    let lastScanAt = 0;
    let active = true;

    const inspectVideo = (timestamp) => {
      if (!active) return;
      animationFrame = requestAnimationFrame(inspectVideo);
      if (timestamp - lastScanAt < 180) return;
      lastScanAt = timestamp;

      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return;

      const canvas = analysisCanvasRef.current;
      if (!canvas) return;

      const width = ANALYSIS_WIDTH;
      const height = Math.round(width * video.videoHeight / video.videoWidth);
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(video, 0, 0, width, height);

      const detected = detectRegistrationFrame(context, width, height);
      if (!detected) {
        stabilityRef.current = { frame: null, count: 0 };
        setScanFrame(null);
        setScannerReady(false);
        return;
      }

      const previous = stabilityRef.current;
      const isStable = previous.frame && detected.every((point, index) =>
        Math.hypot(point.x - previous.frame[index].x, point.y - previous.frame[index].y) < Math.max(width, height) * 0.03
      );
      const stableCount = isStable ? previous.count + 1 : 1;
      stabilityRef.current = { frame: detected, count: stableCount };
      setScanFrame(detected.map(({ x, y }) => ({ x: x / width, y: y / height })));
      const ready = stableCount >= REQUIRED_STABLE_FRAMES;
      setScannerReady(ready);

      if (ready && !autoCaptureRef.current && !processingRef.current) {
        autoCaptureRef.current = true;
        captureAndRecognize();
      }
    };

    animationFrame = requestAnimationFrame(inspectVideo);
    return () => {
      active = false;
      cancelAnimationFrame(animationFrame);
    };
  }, [stream, processing, result]);

  async function startStream(id = deviceId) {
    const requestId = ++cameraRequestRef.current;
    stopStream();
    setStream(null);
    setError(null);
    setCameraFailed(false);
    setCameraLoading(true);

    const attemptConstraints = [
      ...(id ? [{ video: { deviceId: { exact: id }, aspectRatio: { ideal: 3 / 4 } }, audio: false }] : []),
      { video: { facingMode: { ideal: 'environment' }, aspectRatio: { ideal: 3 / 4 } }, audio: false },
      { video: { aspectRatio: { ideal: 3 / 4 } }, audio: false },
      { video: true, audio: false },
    ];

    let lastError = null;

    for (const constraints of attemptConstraints) {
      let candidateStream = null;

      try {
        candidateStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (requestId !== cameraRequestRef.current) {
          stopStream(candidateStream);
          return;
        }

        cameraStreamRef.current = candidateStream;
        const video = videoRef.current;
        if (!video) throw new Error('Camera preview element is not ready.');

        video.srcObject = candidateStream;
        video.muted = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('muted', 'true');

        try {
          await video.play();
        } catch (playErr) {
          console.warn('Video play deferred or interrupted:', playErr);
        }

        if (requestId !== cameraRequestRef.current) {
          stopStream(candidateStream);
          return;
        }

        setStream(candidateStream);
        setCameraLoading(false);

        // Populate available cameras after permission is granted
        try {
          const list = await navigator.mediaDevices.enumerateDevices();
          const cams = list.filter((d) => d.kind === 'videoinput');
          setDevices(cams);
          const currentTrack = candidateStream.getVideoTracks()[0];
          const settings = currentTrack?.getSettings?.();
          if (settings?.deviceId) {
            setDeviceId(settings.deviceId);
          } else if (cams.length > 0 && !id) {
            setDeviceId(cams[0].deviceId);
          }
        } catch (enumErr) {
          console.warn('enumerateDevices error:', enumErr);
        }

        return;
      } catch (e) {
        if (candidateStream) stopStream(candidateStream);
        if (requestId !== cameraRequestRef.current) return;
        lastError = e;
        console.error('Camera stream attempt failed:', e);
      }
    }

    setCameraLoading(false);
    const code = lastError && lastError.name ? lastError.name : 'UnknownError';
    const message = lastError && lastError.message ? lastError.message : '';

    if (code === 'NotAllowedError' || code === 'PermissionDeniedError') {
      setError('Camera permission denied. Allow camera access in your browser to scan ballots.');
    } else if (code === 'NotFoundError') {
      setError('No camera device was found on this system.');
    } else if (!window.isSecureContext && !isLocalCameraHost()) {
      setError(`Camera access requires HTTPS or localhost. Try opening: https://${window.location.hostname}:5173/scanner`);
    } else if (code === 'NotReadableError' || code === 'TrackStartError' || code === 'AbortError') {
      setError('Camera could not start. Close other applications or browser tabs currently using the camera, then retry.');
    } else {
      setError(`Could not start camera (${code}). ${message}`.trim());
    }
    setCameraFailed(true);
  }

  function stopStream(cameraStream = cameraStreamRef.current) {
    if (!cameraStream) return;
    cameraStream.getTracks().forEach((track) => track.stop());
    if (cameraStreamRef.current === cameraStream) cameraStreamRef.current = null;
    if (videoRef.current?.srcObject === cameraStream) videoRef.current.srcObject = null;
  }

  function switchCamera() {
    if (devices.length < 2) return;
    const idx = devices.findIndex((d) => d.deviceId === deviceId);
    const next = devices[(idx + 1) % devices.length];
    setDeviceId(next.deviceId);
    startStream(next.deviceId);
  }

  function handleCameraChange(e) {
    const selectedId = e.target.value;
    setDeviceId(selectedId);
    startStream(selectedId);
  }

  function retryCamera() {
    startStream(deviceId || undefined);
  }

  function clearResult() {
    setResult(null);
    setSubmissionStatus(null);
    autoCaptureRef.current = false;
    stabilityRef.current = { frame: null, count: 0 };
    setScanFrame(null);
    setScannerReady(false);
  }

  async function captureAndRecognize() {
    if (processingRef.current) return;
    const video = videoRef.current;
    if (
      !stream ||
      !video ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      setError('No live camera frame is available. Ensure camera is running or use "Upload / Take Photo".');
      setCameraFailed(true);
      return;
    }

    processingRef.current = true;
    setProcessing(true);
    setError(null);
    setResult(null);
    setSubmissionStatus(null);

    try {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 960;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Could not capture frame from camera.');

      let eid = electionId;
      if (!eid) {
        try {
          const resp = await apiClient.get('/elections/active');
          eid = resp.data?.data?.id;
          if (eid) setElectionId(eid);
        } catch (e) {
          throw new Error('Could not determine active election. Please check election settings.');
        }
      }

      const form = new FormData();
      form.append('file', blob, 'ballot.jpg');

      const recoUrl = `${defaultRecognitionBase}/recognize?election_id=${eid}`;
      const recoResp = await fetch(recoUrl, { method: 'POST', body: form });

      if (!recoResp.ok) {
        const txt = await recoResp.text();
        throw new Error('Recognition service error: ' + (txt || recoResp.statusText));
      }

      const body = await recoResp.json();
      setResult(body);
    } catch (e) {
      console.error('Scan recognition error:', e);
      setError(e.message || String(e));
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }

  async function sendBlobToRecognition(blob) {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setError(null);
    setResult(null);
    setSubmissionStatus(null);

    try {
      let eid = electionId;
      if (!eid) {
        const resp = await apiClient.get('/elections/active');
        eid = resp.data?.data?.id;
        if (eid) setElectionId(eid);
      }

      const form = new FormData();
      form.append('file', blob, 'ballot.jpg');
      const recoUrl = `${defaultRecognitionBase}/recognize?election_id=${eid}`;

      const recoResp = await fetch(recoUrl, { method: 'POST', body: form });
      if (!recoResp.ok) {
        const txt = await recoResp.text();
        throw new Error('Recognition service error: ' + (txt || recoResp.statusText));
      }

      const body = await recoResp.json();
      setResult(body);
    } catch (e) {
      console.error('File recognition error:', e);
      setError(e.message || String(e));
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }

  function triggerFileInput() {
    fileInputRef.current?.click();
  }

  async function onFileChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    await sendBlobToRecognition(f);
    e.target.value = '';
  }

  async function confirmAndSubmit() {
    if (!result?.serial_number) {
      setError('This scan has no readable ballot serial number and cannot be submitted. Rescan the ballot.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const votesArr = [];
      const votesObj = result.votes || {};
      Object.entries(votesObj).forEach(([positionId, posRes]) => {
        const pid = parseInt(positionId, 10);
        if (posRes.is_abstain) {
          votesArr.push({ position_id: pid, candidate_id: null, is_abstain: true });
        } else if (Array.isArray(posRes.votes)) {
          posRes.votes.forEach((cid) => votesArr.push({ position_id: pid, candidate_id: cid, is_abstain: false }));
        }
      });

      const payload = {
        election_id: electionId,
        serial_number: result.serial_number,
        decoded_via: result.decoded_via,
        omr_confidence: result.confidence,
        votes: votesArr,
      };

      const resp = await apiClient.post('/scans', payload);
      const status = resp.data.data?.status || (resp.status === 201 ? 'counted' : 'unknown');
      setSubmissionStatus(`Ballot ${result.serial_number} successfully recorded (${status}).`);
      setResult(null);
      autoCaptureRef.current = false;
      stabilityRef.current = { frame: null, count: 0 };
      setScanFrame(null);
      setScannerReady(false);
    } catch (e) {
      console.error('Submission error:', e);
      setError(e.response?.data?.message || e.message || String(e));
    } finally {
      setProcessing(false);
    }
  }

  const recognitionFailure = result?.stage_failed === 'serial_decode'
    ? 'The ballot serial and QR code could not be read. Keep the ballot flat and well-lit with the QR code and serial clearly in view.'
    : result?.stage_failed === 'perspective_correction'
      ? 'The ballot outline could not be detected. Place the entire ballot flat, keep all four corner markers in view, or hold the camera closer.'
      : null;

  return (
    <div className="scanner-page">
      <div className="scanner-header">
        <h1>Ballot Scanner</h1>
      </div>

      <div className="scanner-body">
        <div className="preview-shell">
          <video ref={videoRef} className="video-preview" playsInline muted autoPlay />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <canvas ref={analysisCanvasRef} className="analysis-canvas" />

          {cameraLoading && (
            <div className="camera-status-overlay">
              <div className="camera-spinner" />
              <span>Starting camera…</span>
            </div>
          )}

          {!stream && !cameraLoading && (
            <div className="camera-status-overlay">
              <span>📷 Camera not active</span>
              {cameraFailed && (
                <button type="button" className="secondary" onClick={retryCamera} style={{ marginTop: 8 }}>
                  Start Camera
                </button>
              )}
            </div>
          )}

          {stream && (
            <div className={`ballot-guide-frame${scannerReady ? ' is-ready' : ''}`} aria-hidden="true">
              <span className="guide-corner top-left" />
              <span className="guide-corner top-right" />
              <span className="guide-corner bottom-left" />
              <span className="guide-corner bottom-right" />
              <div className="guide-laser-line" />
            </div>
          )}

          {scanFrame && (
            <svg
              className={`alignment-overlay${scannerReady ? ' is-ready' : ''}`}
              viewBox={`0 0 ${ANALYSIS_WIDTH} ${Math.round(ANALYSIS_WIDTH * (videoRef.current?.videoHeight || 4) / (videoRef.current?.videoWidth || 3))}`}
              preserveAspectRatio="xMidYMid slice"
              aria-hidden="true"
            >
              <polygon points={scanFrame.map(({ x, y }) => `${x * ANALYSIS_WIDTH},${y * Math.round(ANALYSIS_WIDTH * (videoRef.current?.videoHeight || 4) / (videoRef.current?.videoWidth || 3))}`).join(' ')} />
            </svg>
          )}

          {stream && (
            <div className={`overlay${scannerReady ? ' is-ready' : ''}`}>
              {scannerReady ? '✓ Ballot detected — Hold steady…' : 'Position portrait ballot in frame'}
            </div>
          )}
        </div>

        <div className="controls">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />

          <button type="button" className="secondary" onClick={triggerFileInput} disabled={processing}>
            Upload / Take Photo
          </button>

          {devices.length > 1 && (
            <>
              <select
                className="camera-select"
                value={deviceId || ''}
                onChange={handleCameraChange}
                disabled={processing}
              >
                {devices.map((d, index) => (
                  <option key={d.deviceId || index} value={d.deviceId}>
                    {d.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
              <button type="button" className="secondary" onClick={switchCamera} disabled={processing}>
                Switch Camera
              </button>
            </>
          )}

          <button
            type="button"
            className="primary"
            onClick={captureAndRecognize}
            disabled={processing || !stream}
          >
            {processing
              ? 'Scanning & Analyzing…'
              : scannerReady
                ? 'Capture Ballot (Aligned ✓)'
                : 'Capture / Scan'}
          </button>

          {submissionStatus && (
            <div className="submit-success" role="status">
              ✓ {submissionStatus}
            </div>
          )}

          {error && (
            <div className="error" role="alert">
              <span>{error}</span>
              {cameraFailed && (
                <button type="button" className="secondary" onClick={retryCamera} disabled={processing}>
                  Retry Camera
                </button>
              )}
            </div>
          )}
        </div>

        {result && (
          <div className="result-card">
            <h3>Recognition Result</h3>
            <p><strong>Serial:</strong> {result.serial_number || 'Not detected'}</p>
            <p><strong>Confidence:</strong> {Math.round((result.confidence || 0) * 100)}%</p>
            {recognitionFailure && <p className="error" role="alert">{recognitionFailure}</p>}

            <div className="votes-list">
              {Object.entries(result.votes || {}).map(([posId, pos]) => (
                <div key={posId} className="vote-row">
                  <div className="vote-pos">Position {posId}:</div>
                  <div className="vote-val">
                    {pos.is_abstain ? 'Abstain' : (pos.votes && pos.votes.length ? pos.votes.join(', ') : 'No mark')}
                  </div>
                </div>
              ))}
            </div>

            <div className="result-actions">
              <button className="secondary" onClick={clearResult} disabled={processing}>Discard</button>
              <button className="primary" onClick={confirmAndSubmit} disabled={processing || !result.serial_number}>
                Confirm and submit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
