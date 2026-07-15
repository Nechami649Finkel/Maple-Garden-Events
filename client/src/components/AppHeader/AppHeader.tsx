import { useNavigate, useLocation } from 'react-router-dom';
import { useNavigationContext } from '../../context/navigationContext';
import { useSidebar } from '../../context/sidebarContext';
import {
  resolveDefaultBackPath,
  resolveRouteTitle,
  shouldShowGlobalBack,
} from '../../utils/appNavigation';
import './AppHeader.css';

export const AppHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { override } = useNavigationContext();
  const { open } = useSidebar();

  const showBack = shouldShowGlobalBack(location.pathname) || !!override;
  const pageTitle = resolveRouteTitle(location.pathname);

  const handleBack = () => {
    if (override?.onBack) {
      override.onBack();
      return;
    }
    const fallback = resolveDefaultBackPath(location.pathname);
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallback);
  };

  return (
    <header className="app-header">
      <div className="app-header-start">
        <button
          type="button"
          className="app-header-hamburger"
          onClick={open}
          aria-label="פתיחת תפריט"
        >
          <span />
          <span />
          <span />
        </button>

        {showBack && (
          <button
            type="button"
            className="app-header-back"
            onClick={handleBack}
            aria-label={pageTitle ? `חזרה — ${pageTitle}` : 'חזרה'}
          >
            <span className="app-header-back-icon" aria-hidden="true">
              →
            </span>
            <span className="app-header-back-text">חזרה</span>
          </button>
        )}

        {pageTitle && (
          <p className="app-header-title" title={pageTitle}>
            {pageTitle}
          </p>
        )}
      </div>

      <button
        type="button"
        className="app-header-brand"
        onClick={() => navigate('/dashboard')}
        aria-label="חזרה ללוח הבקרה"
      >
        <img src="/logo.png" alt="מיפל - גן אירועים בעיר" className="app-header-logo" />
      </button>
    </header>
  );
};
