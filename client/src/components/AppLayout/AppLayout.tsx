import { AppHeader } from '../AppHeader/AppHeader';
import { AppSidebar } from '../AppSidebar/AppSidebar';
import { NavigationProvider } from '../../context/NavigationContext';
import { SidebarProvider } from '../../context/SidebarContext';
import { useTranslation } from '../../i18n/useTranslation';
import './AppLayout.css';

export type AppLayoutMode = 'default' | 'viewportFill' | 'fullWidth';

interface AppLayoutProps {
  children: React.ReactNode;
  layout?: AppLayoutMode;
  /** @deprecated use layout prop */
  fullHeight?: boolean;
  /** @deprecated use layout="viewportFill" */
  viewportFill?: boolean;
}

function resolveLayout(
  layout?: AppLayoutMode,
  viewportFill?: boolean,
  fullHeight?: boolean,
): AppLayoutMode {
  if (layout) return layout;
  if (viewportFill) return 'viewportFill';
  if (fullHeight === false) return 'default';
  return 'default';
}

export const AppLayout = ({
  children,
  layout,
  fullHeight = true,
  viewportFill = false,
}: AppLayoutProps) => {
  const mode = resolveLayout(layout, viewportFill, fullHeight);
  const isViewportFill = mode === 'viewportFill';
  const isFullWidth = mode === 'fullWidth';
  const { t, T } = useTranslation();

  return (
    <NavigationProvider>
      <SidebarProvider>
        <a href="#main-content" className="skip-link">
          {t(T.COMMON.A11Y.SKIP_TO_CONTENT)}
        </a>
        <div
          className={[
            'app-layout',
            fullHeight !== false ? 'app-layout-full' : '',
            isViewportFill ? 'app-layout-viewport-fill' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <AppSidebar />
          <AppHeader />
          <main
            id="main-content"
            role="main"
            className={[
              'app-layout-main',
              isViewportFill ? 'app-layout-main-fill' : '',
              isFullWidth ? 'app-layout-main-fullwidth' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {isFullWidth ? <div className="page-content-full">{children}</div> : children}
          </main>
        </div>
      </SidebarProvider>
    </NavigationProvider>
  );
};
