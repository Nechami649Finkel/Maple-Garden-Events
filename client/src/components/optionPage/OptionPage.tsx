import { useLocation, useNavigate } from 'react-router-dom';
import React, { Suspense } from 'react';
import { PageLoader } from '../PageLoader/PageLoader';

const BookingForm = React.lazy(() => import('../BookingForm/BookingForm'));
import { EmptyState, Button } from '../ui';
import { useTranslation } from '../../i18n/useTranslation';
import './OptionPage.css';

const OptionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, T } = useTranslation();

  const selectedDates = location.state?.selectedDates || [];

  if (selectedDates.length === 0) {
    return (
      <div className="option-page-container">
        <EmptyState
          title={t(T.OPTIONS.PAGE_NO_DATES)}
          message={t(T.OPTIONS.PAGE_NO_DATES_HINT)}
        />
        <Button variant="primary" onClick={() => navigate('/calendar')}>
          {t(T.NAV.CALENDAR)}
        </Button>
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <BookingForm
        initialDates={selectedDates}
        isOption={true}
      />
    </Suspense>
  );
};

export default OptionPage;
