import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, ChevronLeft, UserPlus, Wallet, Clock,
  FileText, BarChart2, Search, CheckCircle,
} from 'lucide-react';

const MENU_ITEMS = [
  {
    to: '/clients/list',
    state: { action: 'add' },
    icon: UserPlus,
    label: 'اضافة عميل جديد',
    iconColor: '#2E7D32',
    iconBg: '#E8F5E9',
  },
  {
    to: '/clients/list',
    state: { action: 'opening-balances' },
    icon: Wallet,
    label: 'الارصدة الافتتاحية والمبالغ النقدية للعملاء',
    iconColor: '#1565C0',
    iconBg: '#E3F2FD',
  },
  {
    to: '/clients/list',
    state: { filter: 'owes' },
    icon: Clock,
    label: 'ذمم العملاء - المبالغ المتبقية عند العملاء من الفواتير الاجل',
    iconColor: '#E65100',
    iconBg: '#FFF8E1',
  },
  {
    to: '/clients/list',
    state: { filter: 'owes', report: true },
    icon: BarChart2,
    label: 'ذمم العملاء - تقرير',
    iconColor: '#B71C1C',
    iconBg: '#FFEBEE',
  },
  {
    to: '/clients/list',
    state: { filter: 'credit', report: true },
    icon: FileText,
    label: 'العملاء المتبقي لهم أرصدة - تقرير',
    iconColor: '#6A1B9A',
    iconBg: '#F3E5F5',
  },
  {
    to: '/clients/list',
    state: { action: 'audit' },
    icon: CheckCircle,
    label: 'فحص ارصدة العملاء',
    iconColor: '#00695C',
    iconBg: '#E0F2F1',
  },
  {
    to: '/clients/list',
    state: {},
    icon: Search,
    label: 'عرض العملاء',
    iconColor: '#3949AB',
    iconBg: '#E8EAF6',
  },
];

export default function Clients() {
  const navigate = useNavigate();

  return (
    <div
      dir="rtl"
      style={{
        height: '100%',
        background: '#F0F2F5',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Cairo','Tajawal','Noto Sans Arabic',sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #3949AB 0%, #5C6BC0 100%)',
          padding: '0.9rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 3px 12px rgba(57,73,171,0.4)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ArrowRight size={20} color="white" />
        </button>
        <span style={{ color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>
          العملاء
        </span>
        <div style={{ width: '36px' }} />
      </div>

      {/* Menu items */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {MENU_ITEMS.map(({ to, state, icon: Icon, label, iconColor, iconBg }, idx) => (
          <button
            key={idx}
            onClick={() => navigate(to, { state })}
            style={{
              background: 'white',
              border: 'none',
              borderRadius: '14px',
              padding: '0.95rem 1.1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              width: '100%',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={22} color={iconColor} />
            </div>
            <span
              style={{
                flex: 1,
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#1a1a1a',
                textAlign: 'right',
                lineHeight: 1.4,
              }}
            >
              {label}
            </span>
            <ChevronLeft size={16} color="#ccc" style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}
