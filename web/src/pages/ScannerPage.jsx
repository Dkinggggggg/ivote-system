import React, { useEffect, useRef, useState } from 'react';
import apiClient from '../api/apiClient';
import Icon from '../components/Icon';
import BrandMark from '../components/BrandMark';
import {
  deleteOfflineCapture,
  getOfflineCapture,
  listOfflineCaptures,
  saveOfflineCapture,
  updateOfflineCapture,
} from '../utils/offlineScannerQueue';
import '../pages/ScannerPage.css';

const ANALYSIS_WIDTH = 480;
const REQUIRED_STABLE_FRAMES = 4;
const ACTIVE_ELECTION_STORAGE_KEY = 'ivote_active_election_id';
const REGISTRATION_TARGETS = [
  { x: 0.14, y: 0.12 },
  { x: 0.86, y: 0.12 },
  { x: 0.86, y: 0.88 },
  { x: 0.14, y: 0.88 },
];
const REGISTRATION_ALIGNMENT_TOLERANCE = 0.055;

function readCachedElectionId() {
  try {
    return localStorage.getItem(ACTIVE_ELECTION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function captureStatusLabel(status) {
  return {
    captured: 'Waiting to be read',
    processing: 'Reading ballot',
    recognized: 'Ready for review',
    failed: 'Needs retry',
    blocked: 'Election changed',
  }[status] || 'Saved on this device';
}

function isScanFrameEquivalent(previous, next) {
  if (!previous || !next || previous.length !== next.length) {
    return false;
  }

  return previous.every((point, index) => {
    const nextPoint = next[index];
    return (
      Math.abs(point.x - nextPoint.x) < 0.018 &&
      Math.abs(point.y - nextPoint.y) < 0.018 &&
      Math.abs(point.size - nextPoint.size) < 0.018 &&
      point.aligned === nextPoint.aligned
    );
  });
}

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

  const [stream, setStream] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [electionId, setElectionId] = useState(readCachedElectionId);
  const [scanFrame, setScanFrame] = useState(null);
  const [scannerReady, setScannerReady] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineCaptures, setOfflineCaptures] = useState([]);
  const [activeOfflineCaptureId, setActiveOfflineCaptureId] = useState(null);
  const [offlineQueueReady, setOfflineQueueReady] = useState(false);
  const [capturePaused, setCapturePaused] = useState(false);
  const [queueMessage, setQueueMessage] = useState('');
  const fileInputRef = useRef(null);
  const queueProcessorRef = useRef(false);
  const scanFrameRef = useRef(null);
  const scannerReadyRef = useRef(false);
  const lastFrameUpdateRef = useRef(0);

  const defaultRecognitionBase = import.meta.env.VITE_RECOGNITION_SERVICE_URL || '/recognition';

  const isLocalCameraHost = () => {
    const host = window.location.hostname;
    return window.location.protocol === 'https:' || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  };

  async function refreshOfflineCaptures() {
    const captures = await listOfflineCaptures();
    setOfflineCaptures(captures);
    return captures;
  }

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const captures = await listOfflineCaptures();
        const recoveredCaptures = [];

        for (const capture of captures) {
          if (capture.status === 'processing') {
            await updateOfflineCapture(capture.id, { status: 'captured', error: '' });
            recoveredCaptures.push({ ...capture, status: 'captured', error: '' });
          } else {
            recoveredCaptures.push(capture);
          }
        }

        if (active) setOfflineCaptures(recoveredCaptures);
      } catch (storageError) {
        if (active) setQueueMessage(storageError.message || 'Offline capture storage is unavailable.');
      } finally {
        if (active) setOfflineQueueReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Mount effect: load election & initialize camera stream
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const resp = await apiClient.get('/elections/active');
        if (active && resp.data?.data?.id) {
          const activeElectionId = String(resp.data.data.id);
          setElectionId(activeElectionId);
          localStorage.setItem(ACTIVE_ELECTION_STORAGE_KEY, activeElectionId);
        }
      } catch (e) {
        if (e.response?.status === 404) {
          setElectionId(null);
          localStorage.removeItem(ACTIVE_ELECTION_STORAGE_KEY);
        }
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
    if (!stream || processing || result || capturePaused) {
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
        if (scanFrameRef.current !== null) {
          scanFrameRef.current = null;
          setScanFrame(null);
        }
        if (scannerReadyRef.current) {
          scannerReadyRef.current = false;
          setScannerReady(false);
        }
        return;
      }

      const previous = stabilityRef.current;
      const isStable = previous.frame && detected.every((point, index) =>
        Math.hypot(point.x - previous.frame[index].x, point.y - previous.frame[index].y) < Math.max(width, height) * 0.03
      );
      const stableCount = isStable ? previous.count + 1 : 1;
      stabilityRef.current = { frame: detected, count: stableCount };
      const markerAlignment = detected.map((marker, index) => ({
        ...marker,
        aligned: Math.hypot(
          marker.x / width - REGISTRATION_TARGETS[index].x,
          marker.y / height - REGISTRATION_TARGETS[index].y
        ) <= REGISTRATION_ALIGNMENT_TOLERANCE,
      }));
      const nextScanFrame = markerAlignment.map(({ x, y, size, aligned }) => ({
        x: x / width,
        y: y / height,
        size: size / width,
        aligned,
      }));
      const nextReady = stableCount >= REQUIRED_STABLE_FRAMES && markerAlignment.every(({ aligned }) => aligned);

      const now = performance.now();
      const shouldUpdateFrame = now - lastFrameUpdateRef.current >= 250;
      if (shouldUpdateFrame) {
        lastFrameUpdateRef.current = now;
        if (!scanFrameRef.current || !isScanFrameEquivalent(scanFrameRef.current, nextScanFrame)) {
          scanFrameRef.current = nextScanFrame;
          setScanFrame(nextScanFrame);
        }
      }

      if (scannerReadyRef.current !== nextReady) {
        scannerReadyRef.current = nextReady;
        setScannerReady(nextReady);
      }

      if (nextReady && !autoCaptureRef.current && !processingRef.current) {
        autoCaptureRef.current = true;
        captureAndRecognize();
      }
    };

    animationFrame = requestAnimationFrame(inspectVideo);
    return () => {
      active = false;
      cancelAnimationFrame(animationFrame);
    };
  }, [stream, processing, result, capturePaused]);

  async function startStream() {
    const requestId = ++cameraRequestRef.current;
    stopStream();
    setStream(null);
    setError(null);
    setCameraFailed(false);
    setCameraLoading(true);

    let lastError = null;

    let candidateStream = null;

    try {
      candidateStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: 'environment' }, aspectRatio: { ideal: 3 / 4 } },
        audio: false,
      });
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
      return;
    } catch (e) {
      if (candidateStream) stopStream(candidateStream);
      if (requestId !== cameraRequestRef.current) return;
      lastError = e;
      console.error('Back camera stream attempt failed:', e);
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

  function retryCamera() {
    startStream();
  }

  async function clearResult() {
    if (activeOfflineCaptureId) {
      try {
        await deleteOfflineCapture(activeOfflineCaptureId);
        await refreshOfflineCaptures();
      } catch (storageError) {
        setQueueMessage(storageError.message || 'Unable to remove the reviewed capture.');
        return;
      }
      setActiveOfflineCaptureId(null);
    }
    setResult(null);
    setSubmissionStatus(null);
    autoCaptureRef.current = false;
    stabilityRef.current = { frame: null, count: 0 };
    scanFrameRef.current = null;
    scannerReadyRef.current = false;
    setScanFrame(null);
    setScannerReady(false);
  }

  async function getElectionIdForCapture() {
    if (!navigator.onLine) {
      if (electionId) return String(electionId);
      throw new Error('Connect while an election is active before capturing ballots offline.');
    }

    try {
      const response = await apiClient.get('/elections/active');
      const activeElectionId = String(response.data?.data?.id || '');
      if (!activeElectionId) throw new Error('No active election is available for scanning.');

      setElectionId(activeElectionId);
      localStorage.setItem(ACTIVE_ELECTION_STORAGE_KEY, activeElectionId);
      return activeElectionId;
    } catch (requestError) {
      if (electionId && !requestError.response) return String(electionId);
      throw requestError;
    }
  }

  async function recognizeImage(blob, targetElectionId) {
    const form = new FormData();
    form.append('file', blob, 'ballot.jpg');

    const recoUrl = `${defaultRecognitionBase}/recognize?election_id=${targetElectionId}`;
    const response = await fetch(recoUrl, { method: 'POST', body: form });

    if (!response.ok) {
      const responseText = await response.text();
      const recognitionError = new Error(`Recognition service error: ${responseText || response.statusText}`);
      recognitionError.status = response.status;
      throw recognitionError;
    }

    return response.json();
  }

  async function saveCapturedImageOffline(blob, targetElectionId) {
    const captureId = await saveOfflineCapture(blob, targetElectionId);
    await refreshOfflineCaptures();
    setQueueMessage('Capture saved on this device. It will be read when the connection returns.');
    setSubmissionStatus('Ballot image saved offline. It has not been counted.');
    setCapturePaused(true);
    autoCaptureRef.current = true;
    return captureId;
  }

  async function analyzeOrQueueImage(blob) {
    const targetElectionId = await getElectionIdForCapture();

    if (!navigator.onLine) {
      await saveCapturedImageOffline(blob, targetElectionId);
      return;
    }

    try {
      setResult(await recognizeImage(blob, targetElectionId));
      setActiveOfflineCaptureId(null);
    } catch (recognitionError) {
      if (!navigator.onLine || !recognitionError.status || recognitionError.status >= 500) {
        await saveCapturedImageOffline(blob, targetElectionId);
        return;
      }

      throw recognitionError;
    }
  }

  async function processNextOfflineCapture() {
    if (
      queueProcessorRef.current || !navigator.onLine || !electionId ||
      processingRef.current || result
    ) return;

    let captures = [];
    try {
      captures = await listOfflineCaptures();
    } catch (storageError) {
      setQueueMessage(storageError.message || 'Offline capture storage is unavailable.');
      return;
    }

    const waitingCapture = captures.find((item) => item.status === 'captured');
    if (!waitingCapture) return;

    queueProcessorRef.current = true;
    processingRef.current = true;
    setProcessing(true);

    let capture = null;
    try {
      capture = waitingCapture;

      const activeResponse = await apiClient.get('/elections/active');
      const currentElectionId = String(activeResponse.data?.data?.id || '');
      if (currentElectionId !== capture.electionId) {
        await updateOfflineCapture(capture.id, {
          status: 'blocked',
          error: 'The active election changed. This image was not sent to another election.',
        });
        setQueueMessage('A saved capture belongs to a different election and was not processed.');
        return;
      }

      await updateOfflineCapture(capture.id, { status: 'processing', error: '' });
      await refreshOfflineCaptures();

      const fullCapture = await getOfflineCapture(capture.id);
      if (!fullCapture?.image) throw new Error('The saved ballot image is missing.');

      const recognitionResult = await recognizeImage(fullCapture.image, capture.electionId);
      await updateOfflineCapture(capture.id, {
        status: 'recognized',
        result: recognitionResult,
        error: '',
      });
      setResult(recognitionResult);
      setActiveOfflineCaptureId(capture.id);
      setCapturePaused(true);
      setQueueMessage('Saved image read. Review the recognized votes before submitting.');
    } catch (processingError) {
      if (capture) {
        const status = !navigator.onLine ? 'captured' : processingError.response?.status === 404 ? 'blocked' : 'failed';
        await updateOfflineCapture(capture.id, {
          status,
          error: processingError.message || 'Unable to read this ballot image.',
        }).catch(() => {});
      }
      setQueueMessage(processingError.message || 'Unable to read the saved ballot image.');
      setIsOnline(navigator.onLine);
    } finally {
      queueProcessorRef.current = false;
      processingRef.current = false;
      setProcessing(false);
      await refreshOfflineCaptures().catch(() => {});
    }
  }

  useEffect(() => {
    if (!offlineQueueReady || result) return;

    const recognizedCapture = offlineCaptures.find((capture) => capture.status === 'recognized');
    if (recognizedCapture?.result) {
      setResult(recognizedCapture.result);
      setActiveOfflineCaptureId(recognizedCapture.id);
      setCapturePaused(true);
      return;
    }

    const hasWaitingCapture = offlineCaptures.some((capture) => capture.status === 'captured');
    if (isOnline && electionId && hasWaitingCapture) {
      processNextOfflineCapture();
    }
  }, [offlineQueueReady, offlineCaptures, result, isOnline, electionId]);

  async function removeOfflineCapture(captureId) {
    if (!window.confirm('Remove this saved ballot image from this device?')) return;

    try {
      await deleteOfflineCapture(captureId);
      await refreshOfflineCaptures();
      if (activeOfflineCaptureId === captureId) {
        setActiveOfflineCaptureId(null);
        setResult(null);
      }
      setQueueMessage('Saved capture removed from this device.');
    } catch (storageError) {
      setQueueMessage(storageError.message || 'Unable to remove the saved capture.');
    }
  }

  async function retryOfflineCapture(captureId) {
    try {
      await updateOfflineCapture(captureId, { status: 'captured', error: '' });
      await refreshOfflineCaptures();
      setQueueMessage('Retrying saved ballot image…');
      processNextOfflineCapture();
    } catch (storageError) {
      setQueueMessage(storageError.message || 'Unable to retry the saved capture.');
    }
  }

  function resumeCapturing() {
    setCapturePaused(false);
    setSubmissionStatus(null);
    autoCaptureRef.current = false;
    stabilityRef.current = { frame: null, count: 0 };
    scanFrameRef.current = null;
    scannerReadyRef.current = false;
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

      await analyzeOrQueueImage(blob);
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
      await analyzeOrQueueImage(blob);
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
        if (!posRes.is_overvote && Array.isArray(posRes.votes)) {
          posRes.votes.forEach((cid) => votesArr.push({ position_id: pid, candidate_id: cid, is_abstain: false }));
        }
      });

      const queuedCapture = activeOfflineCaptureId
        ? offlineCaptures.find((capture) => capture.id === activeOfflineCaptureId)
        : null;
      const payload = {
        election_id: queuedCapture?.electionId || electionId,
        serial_number: result.serial_number,
        decoded_via: result.decoded_via,
        omr_confidence: result.confidence,
        votes: votesArr,
      };

      const resp = await apiClient.post('/scans', payload);
      const status = resp.data.data?.status || (resp.status === 201 ? 'counted' : 'unknown');
      setSubmissionStatus('Ballot Successfully Scanned! Your vote has been received and recorded. Thank you for your participation.');
      if (activeOfflineCaptureId) {
        await deleteOfflineCapture(activeOfflineCaptureId);
        setActiveOfflineCaptureId(null);
        await refreshOfflineCaptures();
      }
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
    ? 'The printed serial could not be read. Keep the ballot flat and well-lit, with the serial clearly in view.'
    : result?.stage_failed === 'perspective_correction'
      ? 'The ballot outline could not be detected. Place the entire ballot flat, keep all four corner markers in view, or hold the camera closer.'
      : null;

  return (
    <div className="scanner-page">
      <div className="scanner-header">
        <div className="scanner-brand">
          <BrandMark className="scanner-brand-mark" />
          <div>
            <h1>Official Ballot Scanner</h1>
          </div>
        </div>
      </div>

      <div className="scanner-body">
        <div className="preview-shell">
          <video ref={videoRef} className="video-preview" playsInline muted autoPlay aria-label="Back camera preview" />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <canvas ref={analysisCanvasRef} className="analysis-canvas" />
          {stream && (
            <svg className="privacy-mask" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M0 0H1000V1000H0Z M30 45H237V182H30Z M763 45H970V182H763Z M763 818H970V955H763Z M30 818H237V955H30Z"
              />
            </svg>
          )}
          <div className="privacy-indicator" aria-hidden="true">BALLOT DETAILS MASKED</div>

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
              {scanFrame.map((marker, index) => {
                const markerSize = marker.size * ANALYSIS_WIDTH;
                const frameHeight = Math.round(ANALYSIS_WIDTH * (videoRef.current?.videoHeight || 4) / (videoRef.current?.videoWidth || 3));
                return (
                  <rect
                    key={index}
                    className={`detected-registration-box${marker.aligned ? ' is-aligned' : ''}`}
                    x={marker.x * ANALYSIS_WIDTH - markerSize / 2}
                    y={marker.y * frameHeight - markerSize / 2}
                    width={markerSize}
                    height={markerSize}
                  />
                );
              })}
            </svg>
          )}

          {stream && (
            <div className={`overlay${scannerReady ? ' is-ready' : ''}`}>
              {scannerReady ? 'Registration markers aligned - Hold steady' : 'Align all four registration markers'}
            </div>
          )}
        </div>

        <div className="controls">
          <div className="scanner-controls-heading">
            <h2>Capture Controls</h2>
          </div>
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

          <button
            type="button"
            className="primary"
            onClick={captureAndRecognize}
            disabled={processing || !stream}
          >
            {processing
              ? 'Scanning & Analyzing…'
              : scannerReady
                ? <>Capture Ballot <span className="scanner-aligned-state"><Icon name="check" size={14} /> Aligned</span></>
                : 'Capture / Scan'}
          </button>

          {submissionStatus && (
            <div className="submit-success" role="status">
              <Icon name="check" size={16} /> {submissionStatus}
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

        <section className="offline-capture-queue" aria-labelledby="offline-queue-title">
          <div className="offline-queue-heading">
            <div>
              <h2 id="offline-queue-title">Saved Captures</h2>
              <p>{offlineCaptures.length} ballot image{offlineCaptures.length === 1 ? '' : 's'} on this device</p>
            </div>
            <span className={`connection-status${isOnline ? ' is-online' : ' is-offline'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {!electionId && (
            <p className="offline-queue-notice">
              Load an active election while online before capturing ballots for offline processing.
            </p>
          )}
          {queueMessage && <p className="offline-queue-message" role="status">{queueMessage}</p>}
          {capturePaused && !result && (
            <button type="button" className="secondary offline-next-capture" onClick={resumeCapturing}>
              Capture Next Ballot
            </button>
          )}

          {offlineCaptures.length > 0 ? (
            <ul className="offline-queue-list">
              {offlineCaptures.map((capture) => (
                <li key={capture.id} className="offline-queue-item">
                  <div className="offline-capture-details">
                    <strong>{new Date(capture.capturedAt).toLocaleString()}</strong>
                    <span>{captureStatusLabel(capture.status)}</span>
                    {capture.error && <small>{capture.error}</small>}
                  </div>
                  <div className="offline-capture-actions">
                    {capture.status === 'recognized' && !result && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setResult(capture.result);
                          setActiveOfflineCaptureId(capture.id);
                          setCapturePaused(true);
                        }}
                      >
                        Review
                      </button>
                    )}
                    {capture.status === 'failed' && isOnline && (
                      <button type="button" className="secondary" onClick={() => retryOfflineCapture(capture.id)} disabled={processing}>
                        Retry
                      </button>
                    )}
                    <button type="button" className="offline-remove-button" onClick={() => removeOfflineCapture(capture.id)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="offline-queue-empty">No saved captures.</p>
          )}
        </section>

        {result && (
          <div className="result-card">
            <h3>Ballot Check</h3>
            <p><strong>Ballot identifier:</strong> {result.serial_number ? 'Read successfully' : 'Not detected'}</p>
            <p><strong>Confidence:</strong> {Math.round((result.confidence || 0) * 100)}%</p>
            <p className="privacy-result-note">Candidate selections are hidden on this screen.</p>
            {recognitionFailure && <p className="error" role="alert">{recognitionFailure}</p>}

            <div className="votes-list">
              {Object.entries(result.votes || {}).map(([posId, pos]) => (
                <div
                  key={posId}
                  className={`vote-row${pos.is_overvote ? ' is-overvote' : ''}${pos.is_abstain ? ' is-blank' : ''}`}
                >
                  <div className="vote-pos">Position {posId}</div>
                  <div className="vote-val">
                    {pos.is_overvote
                      ? 'Overvote - position not counted'
                      : pos.is_abstain
                        ? 'No mark - position not counted'
                        : (pos.votes && pos.votes.length
                          ? `${pos.votes.length} selection${pos.votes.length === 1 ? '' : 's'} detected`
                          : 'No mark - position not counted')}
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
