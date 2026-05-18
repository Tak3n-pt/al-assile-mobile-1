import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, Share2, X, Bluetooth, BluetoothOff, Check, Loader2 } from 'lucide-react';
import {
  connectPrinter,
  printReceipt,
  isSupported,
  isConnected,
  formatReceiptText,
} from '../utils/bluetooth.js';
import { t, getLanguage } from '../utils/i18n.js';

/**
 * Full-screen bottom-sheet preview of a receipt. Renders the exact text that
 * will be sent to the thermal printer (via formatReceiptText) inside a white
 * "paper" card sized to the ~58mm thermal roll so the cashier sees exactly
 * what will come out of the printer.
 *
 * Shows Print (Bluetooth) and Share buttons at the bottom — tapping either
 * does the same thing as the old ReceiptPrinter direct actions, but now the
 * cashier can double-check the receipt first and dismiss if something is wrong.
 */
export default function ReceiptPreview({ sale, settings, isOpen, onClose }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | printing | done | error
  const [message, setMessage] = useState('');

  const lang = getLanguage();
  const isRTL = lang === 'ar';
  const bluetoothSupported = isSupported();

  // Regenerate the rendered receipt whenever the sale or language changes.
  // Doing this inside the component (not via useMemo) keeps it simple — the
  // preview is only mounted while the sheet is open anyway.
  const receiptText = isOpen && sale ? formatReceiptText(sale, settings, lang) : '';

  // Reset transient status when the sheet reopens, so a previous "error"
  // doesn't persist into a fresh preview session.
  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setMessage('');
    }
  }, [isOpen]);

  const handlePrint = async () => {
    if (status === 'connecting' || status === 'printing') return;

    try {
      if (!isConnected()) {
        setStatus('connecting');
        setMessage(t('searchingPrinter'));
        await connectPrinter();
      }

      setStatus('printing');
      setMessage(t('sendingReceipt'));
      await printReceipt(sale, settings);
      setStatus('done');
      setMessage(t('receiptPrinted'));

      // Auto-close the sheet a moment after success so the cashier can move on
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || t('printFailed'));
    }
  };

  const handleShare = async () => {
    const text = formatReceiptText(sale, settings, lang);
    try {
      if (navigator.share) {
        await navigator.share({ title: t('receiptPreview'), text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setStatus('done');
        setMessage(t('receiptCopied'));
        setTimeout(() => { setStatus('idle'); setMessage(''); }, 2000);
      }
    } catch {
      // User cancelled share — no error state needed
    }
  };

  const isBusy = status === 'connecting' || status === 'printing';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            onClick={isBusy ? undefined : onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            className="absolute inset-x-0 bottom-0 rounded-t-3xl overflow-hidden"
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: "'Cairo','Tajawal',sans-serif",
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: '#e5e7eb' }}
              />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="text-lg font-semibold" style={{ color: '#1a1a1a' }}>
                {t('receiptPreview')}
              </h2>
              <button
                onClick={onClose}
                disabled={isBusy}
                className="p-2 rounded-full touch-manipulation"
                style={{
                  background: 'transparent',
                  color: '#6b7280',
                  opacity: isBusy ? 0.4 : 1,
                }}
                aria-label={t('closePreview')}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable receipt paper */}
            <div
              className="flex-1 overflow-y-auto px-4 pb-4"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div className="flex justify-center py-3">
                <div
                  style={{
                    // 58mm thermal roll = ~220-240px at typical DPI. Slightly
                    // narrower than phone width so the user sees "paper" edges.
                    maxWidth: '280px',
                    width: '100%',
                    background: '#ffffff',
                    color: '#111111',
                    borderRadius: '6px',
                    padding: '16px 12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.08)',
                    border: '1px solid #e5e7eb',
                    // Simulated torn edges top/bottom
                    clipPath:
                      'polygon(0% 4px, 3% 0%, 6% 4px, 9% 0%, 12% 4px, 15% 0%, 18% 4px, 21% 0%, 24% 4px, 27% 0%, 30% 4px, 33% 0%, 36% 4px, 39% 0%, 42% 4px, 45% 0%, 48% 4px, 51% 0%, 54% 4px, 57% 0%, 60% 4px, 63% 0%, 66% 4px, 69% 0%, 72% 4px, 75% 0%, 78% 4px, 81% 0%, 84% 4px, 87% 0%, 90% 4px, 93% 0%, 96% 4px, 100% 0%, 100% calc(100% - 4px), 97% 100%, 94% calc(100% - 4px), 91% 100%, 88% calc(100% - 4px), 85% 100%, 82% calc(100% - 4px), 79% 100%, 76% calc(100% - 4px), 73% 100%, 70% calc(100% - 4px), 67% 100%, 64% calc(100% - 4px), 61% 100%, 58% calc(100% - 4px), 55% 100%, 52% calc(100% - 4px), 49% 100%, 46% calc(100% - 4px), 43% 100%, 40% calc(100% - 4px), 37% 100%, 34% calc(100% - 4px), 31% 100%, 28% calc(100% - 4px), 25% 100%, 22% calc(100% - 4px), 19% 100%, 16% calc(100% - 4px), 13% 100%, 10% calc(100% - 4px), 7% 100%, 4% calc(100% - 4px), 0% 100%)',
                  }}
                >
                  <pre
                    style={{
                      margin: 0,
                      fontFamily:
                        "'Menlo', 'Courier New', 'Liberation Mono', monospace",
                      fontSize: '12px',
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      textAlign: isRTL ? 'right' : 'left',
                      direction: isRTL ? 'rtl' : 'ltr',
                    }}
                  >
                    {receiptText}
                  </pre>
                </div>
              </div>

              {/* Status message (appears below the receipt card) */}
              {message && (
                <div
                  className="text-center text-sm mt-2"
                  style={{
                    color:
                      status === 'error'
                        ? '#d32f2f'
                        : status === 'done'
                        ? '#2e7d32'
                        : '#6b7280',
                  }}
                >
                  {message}
                </div>
              )}
            </div>

            {/* Action bar — sticky bottom inside the sheet */}
            <div
              className="px-4 py-3"
              style={{
                borderTop: '1px solid #e5e7eb',
                background: 'white',
                // Safe-area padding for phones with a home bar
                paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
              }}
            >
              <div className="flex gap-2">
                {/* Share — always available */}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleShare}
                  disabled={isBusy}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm touch-manipulation"
                  style={{
                    background: 'white',
                    border: '1.5px solid #90caf9',
                    color: '#1a1a1a',
                    fontFamily: "'Cairo','Tajawal',sans-serif",
                    opacity: isBusy ? 0.4 : 1,
                  }}
                >
                  <Share2 size={17} />
                  {t('share')}
                </motion.button>

                {/* Print — primary action when Bluetooth is available */}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handlePrint}
                  disabled={!bluetoothSupported || isBusy || status === 'done'}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm touch-manipulation"
                  style={{
                    background:
                      status === 'done'
                        ? '#c8e6c9'
                        : status === 'error'
                        ? '#ffcdd2'
                        : !bluetoothSupported
                        ? '#cfd8dc'
                        : 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)',
                    border: 'none',
                    color:
                      status === 'done'
                        ? '#1b5e20'
                        : status === 'error'
                        ? '#b71c1c'
                        : !bluetoothSupported
                        ? '#546e7a'
                        : 'white',
                    fontFamily: "'Cairo','Tajawal',sans-serif",
                    opacity: isBusy ? 0.7 : !bluetoothSupported ? 0.7 : 1,
                  }}
                >
                  {status === 'idle' && <><Printer size={17} />{t('print')}</>}
                  {status === 'connecting' && <><Bluetooth size={17} className="animate-pulse" />{t('connecting')}</>}
                  {status === 'printing' && <><Loader2 size={17} className="animate-spin" />{t('printing')}</>}
                  {status === 'done' && <><Check size={17} />{t('printed')}</>}
                  {status === 'error' && <><BluetoothOff size={17} />{t('printFailed')}</>}
                </motion.button>
              </div>

              {!bluetoothSupported && (
                <p className="text-xs text-center mt-2" style={{ color: '#6b7280' }}>
                  {t('bluetoothNotAvailable')}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
