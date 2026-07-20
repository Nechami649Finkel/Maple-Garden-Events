import { useNavigate, useLocation } from 'react-router-dom';

import { useNavigationContext } from '../../context/navigationContext';

import { useSidebar } from '../../context/sidebarContext';

import { useTranslation } from '../../i18n/useTranslation';

import { resolveRouteTitleKey, resolveRouteIcon } from '@shared/i18n/navigationLookups';

import { Icon } from '../ui/Icon';

import {

  resolveDefaultBackPath,

  shouldShowGlobalBack,

} from '../../utils/appNavigation';

import './AppHeader.css';



export const AppHeader = () => {

  const navigate = useNavigate();

  const location = useLocation();

  const { override } = useNavigationContext();

  const { open } = useSidebar();

  const { t, T } = useTranslation();



  const showBack = shouldShowGlobalBack(location.pathname) || !!override;

  const titleKey = resolveRouteTitleKey(location.pathname);
  const pageTitle = titleKey ? t(titleKey) : '';
  const pageIcon = resolveRouteIcon(location.pathname);



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

          aria-label={t(T.COMMON.A11Y.OPEN_MENU)}

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

            aria-label={

              pageTitle

                ? t(T.NAV.HEADER_BACK_WITH_TITLE, { title: pageTitle })

                : t(T.COMMON.ACTIONS.BACK)

            }

          >

            <span className="app-header-back-icon" aria-hidden="true">

              →

            </span>

            <span className="app-header-back-text">{t(T.COMMON.ACTIONS.BACK)}</span>

          </button>

        )}



        {pageTitle && (
          <p className="app-header-title" title={pageTitle}>
            {pageIcon && (
              <span className="app-header-title-icon" aria-hidden="true">
                <Icon name={pageIcon} size={18} />
              </span>
            )}
            {pageTitle}
          </p>
        )}

      </div>

    </header>

  );

};

