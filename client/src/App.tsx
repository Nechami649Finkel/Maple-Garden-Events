import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Calendar } from './components/Calendar/Calendar';
import { getTakenSlots, type TimeSlot } from './utils/timeSlot';
import { AppLayout } from './components/AppLayout/AppLayout';
import { Login } from './components/Login/Login';
import { PageLoader } from './components/PageLoader/PageLoader';
import { AccessibilityWidget } from './components/AccessibilityWidget/AccessibilityWidget';
import { AccessibilityProvider } from './context/AccessibilityProvider';
import { checkAuthSession } from './services/api';
import { connectSocket, disconnectSocket } from './services/socketService';
import { setupRealtimeSync, teardownRealtimeSync } from './services/realtimeSync';
import { setupOfflineCheckInSync } from './utils/offlineCheckInQueue';
import { queryClient } from './lib/queryClient';

const BookingForm = lazy(() => import('./components/BookingForm/BookingForm'));
const BookingFormDesignExport = lazy(() => import('./components/BookingForm/BookingFormDesignExport'));
const EventFormDesignExport = lazy(() => import('./components/EventFormManager/EventFormDesignExport'));
const OptionsManager = lazy(() => import('./components/OptionsManager/OptionsManager'));
const BookingsManager = lazy(() => import('./components/BookingsManager/BookingsManager'));
const GreetingBlast = lazy(() => import('./components/GreetingBlast/GreetingBlast'));
const EventFormManager = lazy(() => import('./components/EventFormManager/EventFormManager'));
const OptionPage = lazy(() => import('./components/optionPage/OptionPage'));
const MenuDisplay = lazy(() => import('./components/MenuDisplay/MenuDisplay'));
const SettingsManager = lazy(() =>
  import('./components/SettingsManager/SettingsManager').then((m) => ({ default: m.SettingsManager })),
);
const FeedbackPage = lazy(() => import('./components/FeedbackPage/FeedbackPage'));
const FeedbackManager = lazy(() => import('./components/FeedbackManager/FeedbackManager'));
const FeedbackStats = lazy(() => import('./components/FeedbackStats/FeedbackStats'));
const Gallery = lazy(() => import('./components/Gallery/Gallery'));
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'));

const CalendarWrapper = () => {
  const navigate = useNavigate();
  return (
    <AppLayout layout="viewportFill">
      <Calendar
        onDateSelect={(day) => {
          navigate('/booking', {
            state: {
              date: day.date,
              hebrewDate: day.hebrewDate,
              takenSlots: Array.from(getTakenSlots(day.bookings || [])),
              blockedSlots: (day.blockedSlots || []) as TimeSlot[],
            },
          });
        }}
      />
    </AppLayout>
  );
};

const FullWidthShell = ({ children }: { children: React.ReactNode }) => (
  <AppLayout layout="fullWidth">{children}</AppLayout>
);

const Lazy = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

/** Hoisted out of App render so route elements stay stable across renders. */
const ProtectedRoute = ({
  isAuthenticated,
  onLoginSuccess,
  children,
}: {
  isAuthenticated: boolean;
  onLoginSuccess: () => void;
  children: React.ReactNode;
}) => {
  if (!isAuthenticated) {
    return <Login onLoginSuccess={onLoginSuccess} />;
  }
  return <>{children}</>;
};

const isDesignRoute =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  window.location.pathname.startsWith('/__design__/');

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(() =>
    isDesignRoute ? true : null,
  );

  useEffect(() => {
    if (isDesignRoute) return;
    let cancelled = false;
    checkAuthSession().then((authenticated) => {
      if (!cancelled) setIsAuthenticated(authenticated);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      connectSocket();
      setupRealtimeSync(queryClient);
      setupOfflineCheckInSync((result) => {
        if (result.synced > 0) {
          queryClient.invalidateQueries({ queryKey: ['check-in'] });
        }
      });
    } else if (isAuthenticated === false) {
      teardownRealtimeSync();
      disconnectSocket();
    }
  }, [isAuthenticated]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  if (isAuthenticated === null) {
    return <PageLoader />;
  }

  const guard = (children: React.ReactNode) => (
    <ProtectedRoute isAuthenticated={isAuthenticated} onLoginSuccess={handleLoginSuccess}>
      {children}
    </ProtectedRoute>
  );

  return (
    <AccessibilityProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/feedback/:token" element={<Lazy><FeedbackPage /></Lazy>} />
          {import.meta.env.DEV && (
            <Route
              path="/__design__/booking-form"
              element={
                <Lazy>
                  <AppLayout layout="viewportFill">
                    <BookingFormDesignExport />
                  </AppLayout>
                </Lazy>
              }
            />
          )}
          {import.meta.env.DEV && (
            <Route
              path="/__design__/event-form"
              element={
                <Lazy>
                  <AppLayout layout="viewportFill">
                    <EventFormDesignExport />
                  </AppLayout>
                </Lazy>
              }
            />
          )}

          <Route path="/" element={guard(<Navigate to="/dashboard" replace />)} />
          <Route path="/dashboard" element={guard(<Lazy><FullWidthShell><Dashboard /></FullWidthShell></Lazy>)} />
          <Route path="/calendar" element={guard(<CalendarWrapper />)} />
          <Route path="/booking" element={guard(<Lazy><AppLayout layout="viewportFill"><BookingForm /></AppLayout></Lazy>)} />
          <Route path="/booking/close-option/:optionId" element={guard(<Lazy><AppLayout layout="viewportFill"><BookingForm /></AppLayout></Lazy>)} />
          <Route path="/booking/edit/:id" element={guard(<Lazy><AppLayout layout="viewportFill"><BookingForm /></AppLayout></Lazy>)} />
          <Route path="/options-manager" element={guard(<Lazy><FullWidthShell><OptionsManager /></FullWidthShell></Lazy>)} />
          <Route path="/bookings-manager" element={guard(<Lazy><FullWidthShell><BookingsManager /></FullWidthShell></Lazy>)} />
          <Route path="/greeting" element={guard(<Lazy><FullWidthShell><GreetingBlast /></FullWidthShell></Lazy>)} />
          <Route path="/event-form-manager" element={guard(<Lazy><AppLayout layout="viewportFill"><EventFormManager /></AppLayout></Lazy>)} />
          <Route path="/option" element={guard(<Lazy><AppLayout layout="viewportFill"><OptionPage /></AppLayout></Lazy>)} />
          <Route path="/menu" element={guard(<Lazy><AppLayout fullHeight={false}><MenuDisplay /></AppLayout></Lazy>)} />
          <Route path="/settings" element={guard(<Lazy><FullWidthShell><SettingsManager /></FullWidthShell></Lazy>)} />
          <Route path="/feedback-manager" element={guard(<Lazy><FullWidthShell><FeedbackManager /></FullWidthShell></Lazy>)} />
          <Route path="/feedback-stats" element={guard(<Lazy><FullWidthShell><FeedbackStats /></FullWidthShell></Lazy>)} />
          <Route path="/gallery" element={guard(<Lazy><FullWidthShell><Gallery /></FullWidthShell></Lazy>)} />
        </Routes>
        <AccessibilityWidget />
      </BrowserRouter>
    </AccessibilityProvider>
  );
}

export default App;
