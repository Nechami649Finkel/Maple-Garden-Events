import React from 'react';
import { AppHeader } from '../AppHeader/AppHeader';
import './AppLayout.css';

interface AppLayoutProps {
  children: React.ReactNode;
  fullHeight?: boolean;
}

export const AppLayout = ({ children, fullHeight = true }: AppLayoutProps) => {
  return (
    <div className={`app-layout ${fullHeight ? 'app-layout-full' : ''}`}>
      <AppHeader />
      <main className="app-layout-main">{children}</main>
    </div>
  );
};
