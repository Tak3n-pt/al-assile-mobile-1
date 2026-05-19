import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ScanLine, Check, AlertTriangle } from 'lucide-react';
import { t } from '../utils/i18n.js';

export default function BarcodeScanner({ isOpen, onScan, onClose }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const rafRef     = useRef(null);
  const pollRef    = useRef(null);
  const closeTimer = useRef(null);
  const stoppedRef = useRef(false);

  const [scanned,     setScanned]     = useState(false);
  const [startError,  setStartError]  = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  const onScanRef  = useRef(onScan);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onScanRef.current  = onScan;  }, [onScan]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      setScanned(false);
      setStartError(null);
      setCameraReady(false);
      return;
    }

    stoppedRef.current = false;

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
      try { onScanRef.current?.(rawValue); } catch (e) { console.error(e); }
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        onCloseRef.current?.();
      }, 180);
    };

    const scanWithNative = (detector) => {
      const tick = async () => {
        if (stoppedRef.current) return;
        const v = videoRef.current;
        if (v && v.readyState >= 2) {
          try {
            const results = await detector.detect(v);
            if (results.length > 0) { handleDetected(results[0].rawValue); return; }
          } catch { /* per-frame error, ignore */ }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const scanWithFallback = () => {
      const canvas = document.createElement('canvas');
      const ctx    = canvas.getContext('2d');
      let   lib    = null;
      const poll = async () => {
        if (stoppedRef.current) return;
        const v = videoRef.current;
        if (!v || v.videoWidth === 0) { pollRef.current = setTimeout(poll, 300); return; }
        canvas.width = v.videoWidth; canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        try {
          if (!lib) { const m = await import('html5-qrcode'); lib = m.Html5Qrcode; }
          const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
          const file = new File([blob], 'f.jpg', { type: 'image/jpeg' });
          const result = await lib.scanFile(file, false);
          if (result) { handleDetected(result); return; }
        } catch { /* no barcode in frame */ }
        pollRef.current = setTimeout(poll, 250);
      };
      pollRef.current = setTimeout(poll, 600);
    };

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    }).then(stream => {
      if (stoppedRef.current) { stream.getTracks().forEach(tr => tr.stop()); return; }
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) { stopAll(); return; }
      v.srcObject = stream;
      v.play().then(() => {
        setCameraReady(true);
        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({
            formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','code_93','codabar','itf','qr_code','data_matrix','pdf417'],
          });
          scanWithNative(detector);
        } else {
          scanWithFallback();
        }
      });
    }).catch(err => {
      const msg = String(err?.message || err?.name || '');
      if (/NotAllowed|Permission|denied/i.test(msg)) setStartError('permission');
      else if (/NotFound|NotReadable/i.test(msg))    setStartError('no-camera');
      else if (/secure|https/i.test(msg))            setStartError('insecure');
      else                                            setStartError('unknown');
    });

    return () => {
      if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
      stopAll();
    };
  }, [isOpen]);

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

          <div className="mb-8 text-center px-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ScanLine size={20} style={{ color: '#3949AB' }} />
              <h2 className="text-lg font-bold text-white">{t('scanBarcode')}</h2>
            </div>
            <p className="text-sm" style={{ color: '#4a5568' }}>{t('pointCamera')}</p>
          </div>

          <div className="relative" style={{ width: 300, height: 300 }}>
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                border: '2px solid rgba(212,165,116,0.6)',
                animation: 'scannerPulse 2s ease-in-out infinite',
                boxShadow: '0 0 20px rgba(212,165,116,0.2), inset 0 0 20px rgba(212,165,116,0.05)',
                zIndex: 2,
              }}
            />
            {[
              { top:-2,    left:-2,  borderTop:'3px solid #D4A574',    borderLeft:'3px solid #D4A574',   borderTopLeftRadius:12 },
              { top:-2,    right:-2, borderTop:'3px solid #D4A574',    borderRight:'3px solid #D4A574',  borderTopRightRadius:12 },
              { bottom:-2, left:-2,  borderBottom:'3px solid #D4A574', borderLeft:'3px solid #D4A574',   borderBottomLeftRadius:12 },
              { bottom:-2, right:-2, borderBottom:'3px solid #D4A574', borderRight:'3px solid #D4A574',  borderBottomRightRadius:12 },
            ].map((s, i) => <div key={i} className="absolute" style={{ width:24, height:24, zIndex:3, ...s }} />)}
            <div
              className="absolute left-2 right-2 pointer-events-none"
              style={{ height:2, background:'linear-gradient(90deg,transparent,#D4A574,transparent)', animation:'scanLine 1.8s ease-in-out infinite', borderRadius:1, zIndex:2 }}
            />
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full rounded-2xl"
              style={{ objectFit:'cover', background:'#111' }}
            />
            {!cameraReady && !startError && (
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center" style={{ background:'#111', zIndex:1 }}>
                <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor:'rgba(212,165,116,0.2)', borderTopColor:'#D4A574' }} />
              </div>
            )}

            <AnimatePresence>
              {startError && (
                <motion.div
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center px-5 text-center"
                  style={{ background:'rgba(185,28,28,0.95)', zIndex:4 }}
                  role="alert"
                >
                  <AlertTriangle size={34} style={{ color:'#fff' }} />
                  <p className="mt-3 text-white font-bold text-sm">
                    {startError === 'permission' ? t('cameraPermissionDenied')
                      : startError === 'no-camera' ? t('noCameraFound')
                      : startError === 'insecure'  ? t('cameraNeedsHttps')
                      : t('cameraUnavailable')}
                  </p>
                  {startError === 'permission' && (
                    <p className="mt-2 text-xs leading-relaxed" style={{ color:'rgba(255,255,255,0.8)' }}>
                      {t('cameraPermissionHint')}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {scanned && (
                <motion.div
                  initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
                  transition={{ duration:0.15 }}
                  className="absolute inset-0 rounded-2xl flex items-center justify-center"
                  style={{ background:'linear-gradient(135deg,rgba(16,185,129,0.92),rgba(5,150,105,0.92))', zIndex:4 }}
                >
                  <motion.div
                    initial={{ scale:0.5 }} animate={{ scale:1 }}
                    transition={{ type:'spring', stiffness:300, damping:18 }}
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background:'rgba(255,255,255,0.25)' }}
                  >
                    <Check size={44} strokeWidth={3} style={{ color:'#fff' }} />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-8 flex items-center gap-2" aria-live="polite">
            <div className="w-2 h-2 rounded-full" style={{ background: scanned ? '#10b981' : '#3949AB', animation: scanned ? 'none' : 'statusBlink 1.2s ease-in-out infinite' }} />
            <p className="text-sm font-medium" style={{ color: scanned ? '#10b981' : '#8B7355' }}>
              {scanned ? t('scanned') : t('scanning')}
            </p>
          </div>

          <style>{`
            @keyframes scannerPulse {
              0%,100% { border-color:rgba(212,165,116,0.5); box-shadow:0 0 16px rgba(212,165,116,0.15); }
              50%     { border-color:rgba(212,165,116,0.9); box-shadow:0 0 28px rgba(212,165,116,0.35); }
            }
            @keyframes scanLine {
              0%   { top:10%; opacity:0; }
              10%  { opacity:1; }
              90%  { opacity:1; }
              100% { top:88%; opacity:0; }
            }
            @keyframes statusBlink {
              0%,100% { opacity:1; }
              50%     { opacity:0.3; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
