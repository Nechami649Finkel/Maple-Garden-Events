import EventFormManager from './EventFormManager';
import {
  DEMO_BOOKING,
  DEMO_FORM_DATA,
  DEMO_MENU,
  DEMO_NOTES,
} from './eventFormDesignDemoData';

/**
 * Dev-only full-page preview of the event production form for design exports.
 * Route: /__design__/event-form (no auth required in development)
 */
export default function EventFormDesignExport() {
  return (
    <EventFormManager
      designExport={{
        booking: DEMO_BOOKING,
        formData: DEMO_FORM_DATA,
        notesList: DEMO_NOTES,
        selectedMenu: DEMO_MENU,
        hasEntertainers: true,
        hasHonorTable: true,
      }}
    />
  );
}
