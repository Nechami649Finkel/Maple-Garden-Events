import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './AppHeader.css';

const NAV_ITEMS = [
  { label: 'לוח שנה', path: '/', icon: '📅' },
  { label: 'הגדרות מתחם', path: '/settings', icon: '⚙️' },
  { label: 'ניהול אופציות', path: '/options-manager', icon: '' },
  { label: 'ניהול הזמנות', path: '/bookings-manager', icon: '' },
  { label: 'משובי לקוחות', path: '/feedback-manager', icon: '⭐' },
  { label: 'שליחת ברכה', path: '/greeting', icon: '💌' },
  { label: 'טופס הפקת אירוע', path: '/event-form-manager', icon: '' },
];

export const AppHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const goTo = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <>
      <header className="app-header">
        <div className="app-header-start">
          <button
            type="button"
            className="app-header-hamburger"
            onClick={() => setMenuOpen(true)}
            aria-label="פתיחת תפריט"
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>

          <button
            type="button"
            className="app-header-brand"
            onClick={() => goTo('/')}
            aria-label="חזרה ללוח השנה"
          >
            <img src="/logo.png" alt="מיפל - גן אירועים בעיר" className="app-header-logo" />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="nav-drawer-overlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      <nav className={`nav-drawer ${menuOpen ? 'nav-drawer-open' : ''}`} aria-hidden={!menuOpen}>
        <div className="nav-drawer-header">
          <img src="/logo.png" alt="" className="nav-drawer-logo" />
          <button
            type="button"
            className="nav-drawer-close"
            onClick={() => setMenuOpen(false)}
            aria-label="סגירת תפריט"
          >
            ✕
          </button>
        </div>
        <ul className="nav-drawer-list">
          {NAV_ITEMS.map((item) => (
            <li key={item.path}>
              <button
                type="button"
                className={`nav-drawer-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => goTo(item.path)}
              >
                {item.icon && <span className="nav-drawer-icon">{item.icon}</span>}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
};
