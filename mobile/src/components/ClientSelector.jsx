import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, User, Phone, Wallet, UserX, UserPlus, Check } from 'lucide-react';
import { useApi } from '../hooks/useApi.jsx';
import { formatCurrency } from '../utils/currency.js';
import { t } from '../utils/i18n.js';

export default function ClientSelector({ selected, onSelect, onClose }) {
  const api = useApi();
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/api/clients')
      .then(data => setClients(Array.isArray(data) ? data : []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const filtered = clients.filter(c => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.company || '').toLowerCase().includes(q)
    );
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="absolute bottom-0 left-0 right-0 flex flex-col rounded-t-3xl overflow-hidden"
          style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            maxHeight: '85vh',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            fontFamily: "'Cairo','Tajawal',sans-serif",
          }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full" style={{ background: '#cbd5e1' }} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-4">
            <h2 className="text-lg font-bold" style={{ color: '#1a1a1a' }}>{t('selectClient')}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: '#f1f5f9' }}
              aria-label={t('closeLabel')}
            >
              <X size={18} style={{ color: '#6b7280' }} />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: '#9ca3af' }}
              />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('searchClients')}
                className="w-full pl-10 pr-4 py-3 rounded-xl placeholder-gray-400 outline-none"
                style={{
                  background: 'white',
                  border: '1.5px solid #90caf9',
                  fontSize: '16px',
                  color: '#1a1a1a',
                }}
              />
            </div>
          </div>

          {/* Client list */}
          <div className="flex-1 overflow-y-auto scroll-touch px-4 pb-4 space-y-2">
            {/* Add new client */}
            {!showNewForm ? (
              <button
                onClick={() => setShowNewForm(true)}
                className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-colors touch-manipulation"
                style={{
                  background: 'rgba(46,125,50,0.06)',
                  border: '1px solid rgba(46,125,50,0.2)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(46,125,50,0.12)' }}
                >
                  <UserPlus size={20} style={{ color: '#2e7d32' }} />
                </div>
                <p className="font-semibold text-sm" style={{ color: '#2e7d32' }}>{t('addNewClient')}</p>
              </button>
            ) : (
              <div
                className="p-4 rounded-xl space-y-3"
                style={{ background: 'rgba(46,125,50,0.06)', border: '1px solid rgba(46,125,50,0.25)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus size={16} style={{ color: '#2e7d32' }} />
                  <p className="text-sm font-semibold" style={{ color: '#2e7d32' }}>{t('addNewClient')}</p>
                </div>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder={t('clientName')}
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg placeholder-gray-400 outline-none text-sm"
                  style={{ background: 'white', border: '1.5px solid #90caf9', fontSize: '16px', color: '#1a1a1a' }}
                />
                <input
                  type="tel"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  placeholder={t('clientPhone')}
                  className="w-full px-3 py-2.5 rounded-lg placeholder-gray-400 outline-none text-sm"
                  style={{ background: 'white', border: '1.5px solid #90caf9', fontSize: '16px', color: '#1a1a1a' }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowNewForm(false); setNewName(''); setNewPhone(''); }}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold touch-manipulation"
                    style={{ color: '#6b7280', background: '#f1f5f9', border: '1px solid #e5e7eb' }}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={async () => {
                      if (!newName.trim()) return;
                      setCreating(true);
                      try {
                        const created = await api.post('/api/clients', { name: newName.trim(), phone: newPhone.trim() || null });
                        setClients(prev => [...prev, created]);
                        onSelect(created);
                        onClose();
                      } catch (err) {
                        console.error('Create client error:', err);
                      } finally {
                        setCreating(false);
                      }
                    }}
                    disabled={!newName.trim() || creating}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold touch-manipulation"
                    style={{
                      background: newName.trim() ? 'rgba(46,125,50,0.12)' : '#f1f5f9',
                      border: newName.trim() ? '1px solid rgba(46,125,50,0.35)' : '1px solid #e5e7eb',
                      color: newName.trim() ? '#2e7d32' : '#9ca3af',
                      opacity: creating ? 0.5 : 1,
                    }}
                  >
                    {creating ? t('creating') : <><Check size={14} /> {t('create')}</>}
                  </button>
                </div>
              </div>
            )}

            {/* Walk-in option */}
            <button
              onClick={() => { onSelect(null); onClose(); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-colors touch-manipulation"
              style={{
                background: selected === null ? 'rgba(57,73,171,0.06)' : 'white',
                border: selected === null ? '1.5px solid rgba(57,73,171,0.3)' : '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(57,73,171,0.1)' }}
              >
                <UserX size={20} style={{ color: '#3949AB' }} />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>{t('noClient')}</p>
                <p className="text-xs" style={{ color: '#6b7280' }}>{t('noClientRecord')}</p>
              </div>
              {selected === null && (
                <div
                  className="ml-auto w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: '#3949AB' }}
                >
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </button>

            {loading ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <div
                  className="w-8 h-8 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'rgba(57,73,171,0.2)', borderTopColor: '#3949AB' }}
                />
                <p className="text-sm" style={{ color: '#6b7280' }}>{t('loadingClients')}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm" style={{ color: '#6b7280' }}>
                  {query ? t('noClientsMatch') : t('noClientsFound')}
                </p>
              </div>
            ) : (
              filtered.map(client => {
                const isSelected = selected?.id === client.id;
                const balance = client.balance || 0;
                return (
                  <button
                    key={client.id}
                    onClick={() => { onSelect(client); onClose(); }}
                    className="w-full flex items-center gap-3 p-4 rounded-xl text-left touch-manipulation"
                    style={{
                      background: isSelected ? 'rgba(57,73,171,0.06)' : 'white',
                      border: isSelected ? '1.5px solid rgba(57,73,171,0.3)' : '1px solid #e5e7eb',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                      style={{ background: 'rgba(57,73,171,0.1)', color: '#3949AB' }}
                    >
                      {(client.name || 'C').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: '#1a1a1a' }}>{client.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {client.phone && (
                          <span className="flex items-center gap-1 text-xs" style={{ color: '#6b7280' }}>
                            <Phone size={11} />
                            {client.phone}
                          </span>
                        )}
                        {balance > 0 && (
                          <span
                            className="flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-md"
                            style={{
                              color: '#d32f2f',
                              background: 'rgba(211,47,47,0.08)',
                              border: '1px solid rgba(211,47,47,0.2)',
                            }}
                          >
                            <Wallet size={10} />
                            {t('owes')} {formatCurrency(balance)}
                          </span>
                        )}
                        {balance < 0 && (
                          <span
                            className="flex items-center gap-1 text-xs font-medium"
                            style={{ color: '#2e7d32' }}
                          >
                            <Wallet size={10} />
                            {t('creditBalance')} {formatCurrency(Math.abs(balance))}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: '#3949AB' }}
                      >
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
