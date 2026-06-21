import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Calendar } from './components/Calendar/Calendar';
import { getTakenSlots, type TimeSlot } from './utils/timeSlot';
import { AppLayout } from './components/AppLayout/AppLayout';
import { Login } from './components/Login/Login';
import { PageLoader } from './components/PageLoader/PageLoader';
import { checkAuthSession } from './services/api';

const BookingForm = lazy(() => import('./components/BookingForm/BookingForm'));
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
const Gallery = lazy(() => import('./components/Gallery/Gallery'));

const CalendarWrapper = () => {
  const navigate = useNavigate();
  return (
    <AppLayout>
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

const PageShell = ({ children }: { children: React.ReactNode }) => (
  <AppLayout>
    <div className="page-content">{children}</div>
  </AppLayout>
);

const Lazy = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuthSession().then(setIsAuthenticated);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  if (isAuthenticated === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        טוען...
      </div>
    );
  }

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!isAuthenticated) {
      return <Login onLoginSuccess={handleLoginSuccess} />;
    }
    return <>{children}</>;
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/feedback/:token" element={<Lazy><AppLayout><FeedbackPage /></AppLayout></Lazy>} />

        <Route path="/" element={<ProtectedRoute><CalendarWrapper /></ProtectedRoute>} />
        <Route path="/booking" element={<ProtectedRoute><Lazy><AppLayout><BookingForm /></AppLayout></Lazy></ProtectedRoute>} />
        <Route path="/booking/edit/:id" element={<ProtectedRoute><Lazy><AppLayout><BookingForm /></AppLayout></Lazy></ProtectedRoute>} />
        <Route path="/options-manager" element={<ProtectedRoute><Lazy><PageShell><OptionsManager /></PageShell></Lazy></ProtectedRoute>} />
        <Route path="/bookings-manager" element={<ProtectedRoute><Lazy><PageShell><BookingsManager /></PageShell></Lazy></ProtectedRoute>} />
        <Route path="/greeting" element={<ProtectedRoute><Lazy><PageShell><GreetingBlast /></PageShell></Lazy></ProtectedRoute>} />
        <Route path="/event-form-manager" element={<ProtectedRoute><Lazy><AppLayout><EventFormManager /></AppLayout></Lazy></ProtectedRoute>} />
        <Route path="/option" element={<ProtectedRoute><Lazy><AppLayout><OptionPage /></AppLayout></Lazy></ProtectedRoute>} />
        <Route path="/menu" element={<ProtectedRoute><Lazy><AppLayout fullHeight={false}><MenuDisplay /></AppLayout></Lazy></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Lazy><PageShell><SettingsManager /></PageShell></Lazy></ProtectedRoute>} />
        <Route path="/feedback-manager" element={<ProtectedRoute><Lazy><PageShell><FeedbackManager /></PageShell></Lazy></ProtectedRoute>} />
        <Route path="/gallery" element={<Lazy><AppLayout><Gallery /></AppLayout></Lazy>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
