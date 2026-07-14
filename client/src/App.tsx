import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Calendar } from './components/Calendar/Calendar';
import { getTakenSlots, type TimeSlot } from './utils/timeSlot';
import { AppLayout } from './components/AppLayout/AppLayout';
import { Login } from './components/Login/Login';
import { PageLoader } from './components/PageLoader/PageLoader';
import { AccessibilityWidget } from './components/AccessibilityWidget/AccessibilityWidget';
import { AccessibilityProvider } from './context/AccessibilityContext';
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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    if (import.meta.env.DEV && window.location.pathname.startsWith('/__design__/')) {
      setIsAuthenticated(true);
      return;
    }
    checkAuthSession().then(setIsAuthenticated);
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

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!isAuthenticated) {
      return <Login onLoginSuccess={handleLoginSuccess} />;
    }
    return <>{children}</>;
  };

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

          <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Lazy><FullWidthShell><Dashboard /></FullWidthShell></Lazy></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarWrapper /></ProtectedRoute>} />
          <Route path="/booking" element={<ProtectedRoute><Lazy><AppLayout layout="viewportFill"><BookingForm /></AppLayout></Lazy></ProtectedRoute>} />
          <Route path="/booking/close-option/:optionId" element={<ProtectedRoute><Lazy><AppLayout layout="viewportFill"><BookingForm /></AppLayout></Lazy></ProtectedRoute>} />
          <Route path="/booking/edit/:id" element={<ProtectedRoute><Lazy><AppLayout layout="viewportFill"><BookingForm /></AppLayout></Lazy></ProtectedRoute>} />
          <Route path="/options-manager" element={<ProtectedRoute><Lazy><FullWidthShell><OptionsManager /></FullWidthShell></Lazy></ProtectedRoute>} />
          <Route path="/bookings-manager" element={<ProtectedRoute><Lazy><FullWidthShell><BookingsManager /></FullWidthShell></Lazy></ProtectedRoute>} />
          <Route path="/greeting" element={<ProtectedRoute><Lazy><FullWidthShell><GreetingBlast /></FullWidthShell></Lazy></ProtectedRoute>} />
          <Route path="/event-form-manager" element={<ProtectedRoute><Lazy><AppLayout layout="viewportFill"><EventFormManager /></AppLayout></Lazy></ProtectedRoute>} />
          <Route path="/option" element={<ProtectedRoute><Lazy><AppLayout layout="viewportFill"><OptionPage /></AppLayout></Lazy></ProtectedRoute>} />
          <Route path="/menu" element={<ProtectedRoute><Lazy><AppLayout fullHeight={false}><MenuDisplay /></AppLayout></Lazy></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Lazy><FullWidthShell><SettingsManager /></FullWidthShell></Lazy></ProtectedRoute>} />
          <Route path="/feedback-manager" element={<ProtectedRoute><Lazy><FullWidthShell><FeedbackManager /></FullWidthShell></Lazy></ProtectedRoute>} />
          <Route path="/feedback-stats" element={<ProtectedRoute><Lazy><FullWidthShell><FeedbackStats /></FullWidthShell></Lazy></ProtectedRoute>} />
          <Route path="/gallery" element={<ProtectedRoute><Lazy><FullWidthShell><Gallery /></FullWidthShell></Lazy></ProtectedRoute>} />
        </Routes>
        <AccessibilityWidget />
      </BrowserRouter>
    </AccessibilityProvider>
  );
}

export default App;
