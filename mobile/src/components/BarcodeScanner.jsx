import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ScanLine, Check, AlertTriangle, Camera } from 'lucide-react';
import { t } from '../utils/i18n.js';

/*
  Strategy:
  1. getUserMedia directly → <video> is visible immediately (no black-screen startup)
  2. If BarcodeDetector API available (Android Chrome): rAF loop on video → instant native scan
  3. Else (iOS Safari): draw video frame to canvas every 250ms → Html5Qrcode.scanFile

  PWA permission fallback:
  - When installed as a standalone WebAPK, Chrome needs its OWN camera permission
    which is separate from the browser's. If denied and the user can't find the
    Android app permission settings, we offer a "Take a Photo Instead" button.
  - This uses <input capture="environment"> which opens the native camera app
    directly — no getUserMedia permission required at all.
*/

export default function BarcodeScanner({ isOpen, onScan, onClose }) {
  const videoRef     = useRef(null);
  const streamRef    = useRef(null);
  const rafRef       = useRef(null);
  const pollRef      = useRef(null);
  const closeTimer   = useRef(null);
  const stoppedRef   = useRef(false);
  const fileInputRef = useRef(null);

  const [scanned,       setScanned]       = useState(false);
  const [startError,    setStartError]    = useState(null);
  const [cameraReady,   setCameraReady]   = useState(false);
  const [photoError,    setPhotoError]    = useState(false);

  const onScanRef  = useRef(onScan);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onScanRef.current  = onScan;  }, [onScan]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      setScanned(false);
      setStartError(null);
      setCameraReady(false);
      setPhotoError(false);
      return;
    }

    stoppedRef.current = false;

    // ── helpers ──────────────────────────────────────────────
    const stopAll = () => {
      stoppedRef.current = true;
      cancelAnimationFrame(rafRef.current);
      clearTimeout(pollRef.current);
      streamRef.current?.getTracks().forEach(tr => tr.stop());
      streamRef.current = null;
    };

    const handleDetected = (rawValue) => {
      if (stoppedRef.current) return;
      stopAll();
      setScanned(true);
      try { onScanRef.current?.(rawValue); } catch (e) { console.error('onScan threw:', e); }
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        onCloseRef.current?.();
      }, 180);
    };

    // ── BarcodeDetector path (Chrome/Android — very fast) ────
    const scanWithNative = (detector) => {
      const tick = async () => {
        if (stoppedRef.current) return;
        const v = videoRef.current;
        if (v && v.readyState >= 2) {
          try {
            const results = await detector.detect(v);
            if (results.length > 0) { handleDetected(results[0].rawValue); return; }
          } catch { /* ignore per-frame errors */ }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    // ── Html5Qrcode.scanFile fallback (iOS / older browsers) ─
    const scanWithFallback = () => {
      const canvas = document.createElement('canvas');
      const ctx    = canvas.getContext('2d');
      let   html5QrcodeModule = null;

      const poll = async () => {
        if (stoppedRef.current) return;
        const v = videoRef.current;
        if (!v || v.videoWidth === 0) { pollRef.current = setTimeout(poll, 300); return; }

        canvas.width  = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);

        try {
          if (!html5QrcodeModule) {
            const mod = await import('html5-qrcode');
            html5QrcodeModule = mod.Html5Qrcode;
          }
          const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
          const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
          const result = await html5QrcodeModule.scanFile(file, false);
          if (result) { handleDetected(result); return; }
        } catch { /* no barcode in this frame — normal */ }

        pollRef.current = setTimeout(poll, 250);
      };

      pollRef.current = setTimeout(poll, 600);
    };

    // ── start camera ─────────────────────────────────────────
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode:  'environment',
            width:  { ideal: 1280 },
            height: { ideal: 720 },
          }
        });

        if (stoppedRef.current) { stream.getTracks().forEach(tr => tr.stop()); return; }
        streamRef.current = stream;

        const v = videoRef.current;
        if (!v) { stopAll(); return; }

        v.srcObject = stream;
        await v.play();
        setCameraReady(true);

        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({
            formats: [
              'ean_13', 'ean_8', 'upc_a', 'upc_e',
              'code_128', 'code_39', 'code_93', 'codabar',
              'itf', 'qr_code', 'data_matrix', 'pdf417',
            ]
          });
          scanWithNative(detector);
        } else {
          scanWithFallback();
        }
      } catch (err) {
        const msg = String(err?.message || err?.name || '');
        if (/NotAllowed|Permission|denied/i.test(msg)) setStartError('permission');
        else if (/NotFound|NotReadable/i.test(msg))    setStartError('no-camera');
        else if (/secure|https/i.test(msg))            setStartError('insecure');
        else                                            setStartError('unknown');
      }
    };

    startCamera();

    return () => {
      if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
      stopAll();
    };
  }, [isOpen]);

  // ── File-capture fallback (bypasses getUserMedia permission) ──
  // Opens the native Android camera app via <input capture="environment">.
  // No Chrome camera permission needed — the camera app handles it itself.
  const handleFileCapture = async (e) => {
    const file = e.target.files?.[0];
    // Reset immediately so the same file can trigger again
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setPhotoError(false);
    try {
      let barcode = null;

      // Try BarcodeDetector first (available on Android Chrome)
      if ('BarcodeDetector' in window) {
        try {
          const bitmap = await createImageBitmap(file);
          const detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          });
          const results = await detector.detect(bitmap);
          if (results.length > 0) barcode = results[0].rawValue;
        } catch { /* fall through to html5-qrcode */ }
      }

      // Fallback: html5-qrcode
      if (!barcode) {
        const mod = await import('html5-qrcode');
        barcode = await mod.Html5Qrcode.scanFile(file, false);
      }

      if (barcode) {
        setScanned(true);
        try { onScanRef.current?.(barcode); } catch (e) { console.error('onScan threw:', e); }
        closeTimer.current = setTimeout(() => {
          closeTimer.current = null;
          onCloseRef.current?.();
        }, 180);
      } else {
        setPhotoError(true);
      }
    } catch {
      setPhotoError(true);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(6px)' }}
        >
          {/* Hidden file input — opens native camera app, no getUserMedia perm needed */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileCapture}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 w-11 h-11 flex items-center justify-center rounded-full z-10 touch-manipulation"
            style={{
              top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
            aria-label={t('closeScanner')}
          >
            <X size={20} style={{ color: '#fff' }} />
          </button>

          {/* Title */}
          <div className="mb-8 text-center px-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ScanLine size={20} style={{ color: '#3949AB' }} />
              <h2 className="text-lg font-bold text-white">{t('scanBarcode')}</h2>
            </div>
            <p className="text-sm" style={{ color: '#4a5568' }}>
              {t('pointCamera')}
            </p>
          </div>

          {/* Camera viewfinder */}
          <div className="relative" style={{ width: 300, height: 300 }}>
            {/* Animated border */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                border: '2px solid rgba(212,165,116,0.6)',
                animation: 'scannerPulse 2s ease-in-out infinite',
                boxShadow: '0 0 20px rgba(212,165,116,0.2), inset 0 0 20px rgba(212,165,116,0.05)',
                zIndex: 2,
              }}
            />

            {/* Corner accents */}
            {[
              { top: -2,  left:  -2, borderTop:    '3px solid #D4A574', borderLeft:  '3px solid #D4A574', borderTopLeftRadius:     12 },
              { top: -2,  right: -2, borderTop:    '3px solid #D4A574', borderRight: '3px solid #D4A574', borderTopRightRadius:    12 },
              { bottom: -2, left: -2, borderBottom: '3px solid #D4A574', borderLeft:  '3px solid #D4A574', borderBottomLeftRadius:  12 },
              { bottom: -2, right: -2, borderBottom:'3px solid #D4A574', borderRight: '3px solid #D4A574', borderBottomRightRadius: 12 },
            ].map((style, i) => (
              <div key={i} className="absolute" style={{ width: 24, height: 24, zIndex: 3, ...style }} />
            ))}

            {/* Scan line animation */}
            <div
              className="absolute left-2 right-2 pointer-events-none"
              style={{
                height: 2,
                background: 'linear-gradient(90deg, transparent, #D4A574, transparent)',
                animation: 'scanLine 1.8s ease-in-out infinite',
                borderRadius: 1,
                zIndex: 2,
              }}
            />

            {/* Live video */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full rounded-2xl"
              style={{ objectFit: 'cover', background: '#111' }}
            />

            {/* Startup shimmer */}
            {!cameraReady && !startError && (
              <div
                className="absolute inset-0 rounded-2xl flex items-center justify-center"
                style={{ background: '#111', zIndex: 1 }}
              >
                <div
                  className="w-8 h-8 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'rgba(212,165,116,0.2)', borderTopColor: '#D4A574' }}
                />
              </div>
            )}

            {/* Error overlay */}
            <AnimatePresence>
              {startError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center px-4 text-center"
                  style={{ background: 'rgba(185,28,28,0.94)', zIndex: 4 }}
                  role="alert"
                >
                  <AlertTriangle size={32} style={{ color: '#fff' }} />
                  <p className="mt-3 text-white font-semibold text-sm">
                    {startError === 'permission' ? t('cameraPermissionDenied')
                      : startError === 'no-camera' ? t('noCameraFound')
                      : startError === 'insecure'  ? t('cameraNeedsHttps')
                      : t('cameraUnavailable')}
                  </p>

                  {/* Permission denied: show hint + Take Photo button */}
                  {startError === 'permission' && (
                    <>
                      <p className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                        {t('cameraPermissionHint')}
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm touch-manipulation"
                        style={{ background: '#fff', color: '#b91c1c' }}
                      >
                        <Camera size={16} />
                        {t('useCameraApp')}
                      </button>
                      {photoError && (
                        <p className="mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>
                          {t('noBarcodeInPhoto')}
                        </p>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success overlay */}
            <AnimatePresence>
              {scanned && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.92) 0%, rgba(5,150,105,0.92) 100%)',
                    zIndex: 4,
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.25)' }}
                  >
                    <Check size={44} strokeWidth={3} style={{ color: '#fff' }} />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Scanning status */}
          <div className="mt-8 flex items-center gap-2" aria-live="polite" aria-atomic="true">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: scanned ? '#10b981' : '#3949AB',
                animation: scanned ? 'none' : 'statusBlink 1.2s ease-in-out infinite',
              }}
            />
            <p className="text-sm font-medium" style={{ color: scanned ? '#10b981' : '#8B7355' }}>
              {scanned ? t('scanned') : t('scanning')}
            </p>
          </div>

          <style>{`
            @keyframes scannerPulse {
              0%, 100% { border-color: rgba(212,165,116,0.5); box-shadow: 0 0 16px rgba(212,165,116,0.15); }
              50%       { border-color: rgba(212,165,116,0.9); box-shadow: 0 0 28px rgba(212,165,116,0.35); }
            }
            @keyframes scanLine {
              0%   { top: 10%; opacity: 0; }
              10%  { opacity: 1; }
              90%  { opacity: 1; }
              100% { top: 88%; opacity: 0; }
            }
            @keyframes statusBlink {
              0%, 100% { opacity: 1; }
              50%       { opacity: 0.3; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
