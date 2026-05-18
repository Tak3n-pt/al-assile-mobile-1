import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, RefreshCw, Phone, Wallet, Truck, X, CheckCircle, AlertTriangle
} from 'lucide-react';
import { useApi } from '../hooks/useApi.jsx';
import { formatCurrency } from '../utils/currency.js';
import { t } from '../utils/i18n.js';

export default function Notifications() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('debt'); // 'debt' | 'delivery'
  const [deliveringId, setDeliveringId] = useState(null);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get('/api/notifications');
      setData(res?.data || res);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, []);

  const markDelivered = async (saleId) => {
    setDeliveringId(saleId);
    try {
      await api.patch(`/api/sales/${saleId}/deliver`, {});
      await fetchNotifications(true);
    } catch (err) {
      alert(err.message || t('failedToMarkDelivered'));
    } finally {
      setDeliveringId(null);
    }
  };

  const debtAlerts    = data?.debt_alerts     || [];
  const deliveryAlerts = data?.delivery_alerts || [];
  const total = debtAlerts.length + deliveryAlerts.length;

  return (
    <div className="h-full flex flex-col safe-top" style={{ background: 'white', fontFamily: "'Cairo','Tajawal',sans-serif" }}>
      {/* Header */}
      <div className="flex-shrink-0" style={{ background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)', padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 3px 12px rgba(57,73,171,0.4)' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'white', margin: 0 }}>{t('notifications')}</h1>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', margin: '0.1rem 0 0' }}>
            {loading ? t('loading') : `${total} ${t('activeAlerts')}`}
          </p>
        </div>
        <button
          onClick={() => fetchNotifications(true)}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <RefreshCw
            size={18}
            color="white"
            className={refreshing ? 'animate-spin' : ''}
          />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 px-3 py-2" style={{ background: 'white', borderBottom: '1px solid #e5e7eb' }}>
        <div
          className="flex rounded-xl p-1"
          style={{ background: '#f1f5f9', border: '1px solid #e5e7eb' }}
        >
          {[
            { id: 'debt',     label: t('debtRecalls'),     count: debtAlerts.length,     color: '#d32f2f' },
            { id: 'delivery', label: t('lateDeliveries'),  count: deliveryAlerts.length, color: '#f59e0b' },
          ].map(({ id, label, count, color }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all touch-manipulation flex items-center justify-center gap-1.5"
              style={{
                background: tab === id ? 'rgba(57,73,171,0.1)' : 'transparent',
                color:      tab === id ? '#3949AB' : '#6b7280',
                border:     tab === id ? '1px solid rgba(57,73,171,0.3)' : '1px solid transparent',
              }}
            >
              {label}
              {count > 0 && (
                <span
                  className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1"
                  style={{ background: color }}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scroll-touch px-5 pb-4">
        {loading ? (
          <div className="text-center py-12" style={{ color: '#6b7280' }}>{t('loading')}</div>
        ) : tab === 'debt' ? (
          <DebtList alerts={debtAlerts} />
        ) : (
          <DeliveryList alerts={deliveryAlerts} onMarkDelivered={markDelivered} deliveringId={deliveringId} />
        )}
      </div>
    </div>
  );
}

// ── Debt Recalls ─────────────────────────────────────────────────────────────

function DebtList({ alerts }) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle size={48} className="mx-auto mb-3" style={{ color: '#2e7d32' }} />
        <p className="font-semibold" style={{ color: '#1a1a1a' }}>{t('noDebtAlerts')}</p>
        <p className="text-xs mt-1" style={{ color: '#6b7280' }}>{t('noDebtAlertsDesc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-1">
      {alerts.map(a => (
        <DebtCard key={a.client_id} alert={a} />
      ))}
    </div>
  );
}

function DebtCard({ alert: a }) {
  const owed = Math.abs(a.balance || 0);

  const sendWhatsApp = async () => {
    if (!a.client_phone) return;
    const msg = t('whatsappReminderTemplate')
      .replace('{name}', a.client_name || '')
      .replace('{amount}', formatCurrency(owed));
    let phone = String(a.client_phone).replace(/[^0-9]/g, '');
    if (phone.startsWith('00')) phone = phone.slice(2);
    if (phone.startsWith('0'))  phone = '213' + phone.slice(1);
    const e164 = phone.startsWith('213') ? phone : '213' + phone;
    window.open(`https://wa.me/${e164}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const urgencyColor = a.days_overdue === null ? '#6b7280'
    : a.days_overdue >= 60  ? '#d32f2f'
    : a.days_overdue >= 30  ? '#f59e0b'
    : '#6b7280';

  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderLeft: '3px solid #d32f2f',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: '#1a1a1a' }}>{a.client_name}</p>
          {a.client_phone && (
            <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: '#6b7280' }}>
              <Phone size={11} /> {a.client_phone}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-bold" style={{ color: '#d32f2f' }}>
            {formatCurrency(owed)}
          </p>
          <p className="text-[10px]" style={{ color: '#6b7280' }}>{t('owes')}</p>
        </div>
      </div>

      {/* Overdue info */}
      <div className="flex items-center gap-3 mb-2.5">
        {a.days_overdue != null && (
          <div className="flex items-center gap-1">
            <AlertTriangle size={11} style={{ color: urgencyColor }} />
            <span className="text-[11px] font-semibold" style={{ color: urgencyColor }}>
              {a.days_overdue === 0 ? t('today') : `${a.days_overdue} ${t('daysOverdue')}`}
            </span>
          </div>
        )}
        {a.last_contact_at && (
          <span className="text-[11px]" style={{ color: '#6b7280' }}>
            {t('lastContactAt')}: {new Date(a.last_contact_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Actions */}
      {a.client_phone && (
        <button
          onClick={sendWhatsApp}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm touch-manipulation"
          style={{
            background: 'rgba(37,211,102,0.1)',
            border: '1px solid rgba(37,211,102,0.3)',
            color: '#1ea952',
          }}
        >
          <span>💬</span>
          {t('sendWhatsAppReminder')}
        </button>
      )}
    </div>
  );
}

// ── Late Deliveries ───────────────────────────────────────────────────────────

function DeliveryList({ alerts, onMarkDelivered, deliveringId }) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <Truck size={48} className="mx-auto mb-3" style={{ color: '#2e7d32' }} />
        <p className="font-semibold" style={{ color: '#1a1a1a' }}>{t('noDeliveryAlerts')}</p>
        <p className="text-xs mt-1" style={{ color: '#6b7280' }}>{t('noDeliveryAlertsDesc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-1">
      {alerts.map(a => (
        <DeliveryCard
          key={a.sale_id}
          alert={a}
          onMarkDelivered={onMarkDelivered}
          delivering={deliveringId === a.sale_id}
        />
      ))}
    </div>
  );
}

function DeliveryCard({ alert: a, onMarkDelivered, delivering }) {
  const urgencyColor = a.days_overdue >= 7 ? '#d32f2f'
    : a.days_overdue >= 3 ? '#f59e0b'
    : '#ca8a04';

  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderLeft: '3px solid #f59e0b',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold" style={{ color: '#1a1a1a' }}>
              {t('saleLabel')} #{a.sale_id}
            </p>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#b45309' }}
            >
              {a.status}
            </span>
          </div>
          {a.client_name && (
            <p className="text-xs mt-0.5 truncate" style={{ color: '#6b7280' }}>
              {a.client_name}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold" style={{ color: '#f59e0b' }}>
            {formatCurrency(a.total)}
          </p>
        </div>
      </div>

      {/* Due info */}
      <div className="flex items-center gap-3 mb-2.5">
        <div className="flex items-center gap-1">
          <AlertTriangle size={11} style={{ color: urgencyColor }} />
          <span className="text-[11px] font-semibold" style={{ color: urgencyColor }}>
            {a.days_overdue === 1 ? `1 ${t('dayOverdue')}` : `${a.days_overdue} ${t('daysOverdue')}`}
          </span>
        </div>
        <span className="text-[11px]" style={{ color: '#6b7280' }}>
          {t('due')}: {new Date(a.delivery_due_date).toLocaleDateString()}
        </span>
      </div>

      {a.delivery_notes && (
        <p className="text-xs italic mb-2.5" style={{ color: '#6b7280' }}>
          {a.delivery_notes}
        </p>
      )}

      <button
        onClick={() => onMarkDelivered(a.sale_id)}
        disabled={delivering}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm touch-manipulation"
        style={{
          background: delivering ? '#f1f5f9' : 'rgba(46,125,50,0.1)',
          border: delivering ? '1px solid #e5e7eb' : '1px solid rgba(46,125,50,0.3)',
          color: delivering ? '#9ca3af' : '#2e7d32',
          opacity: delivering ? 0.6 : 1,
        }}
      >
        <CheckCircle size={16} />
        {delivering ? t('processing') : t('markDelivered')}
      </button>
    </div>
  );
}
