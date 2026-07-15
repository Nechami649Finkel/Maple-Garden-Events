import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NAV_ITEMS, isNavItemActive } from '../../utils/navConfig';
import { useSidebar } from '../../context/sidebarContext';
import { Icon } from '../ui/Icon';
import './AppSidebar.css';

export const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, close } = useSidebar();

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const goTo = (path: string) => {
    close();
    navigate(path);
  };

  const navContent = (
    <>
      <div className="app-sidebar-brand">
        <button
          type="button"
          className="app-sidebar-brand-btn"
          onClick={() => goTo('/dashboard')}
          aria-label="חזרה ללוח הבקרה"
        >
          <img src="/logo.png" alt="" className="app-sidebar-logo" />
          <span className="app-sidebar-venue">מיפל — גן אירועים</span>
        </button>
        <button
          type="button"
          className="app-sidebar-close"
          onClick={close}
          aria-label="סגירת תפריט"
        >
          ✕
        </button>
      </div>

      <ul className="app-sidebar-list">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(location.pathname, item.path);
          return (
            <li key={item.path}>
              <button
                type="button"
                className={`app-sidebar-item ${active ? 'app-sidebar-item-active' : ''}`}
                onClick={() => goTo(item.path)}
                aria-current={active ? 'page' : undefined}
              >
                <span className="app-sidebar-icon" aria-hidden="true">
                  <Icon name={item.icon} size={20} />
                </span>
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="app-sidebar app-sidebar-desktop" aria-label="ניווט ראשי">
        {navContent}
      </aside>

      {/* Mobile drawer overlay */}
      {isOpen && (
        <div
          className="app-sidebar-overlay"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <nav
        className={`app-sidebar app-sidebar-drawer ${isOpen ? 'app-sidebar-drawer-open' : ''}`}
        aria-label="ניווט ראשי"
        aria-hidden={!isOpen}
      >
        {navContent}
      </nav>
    </>
  );
};
