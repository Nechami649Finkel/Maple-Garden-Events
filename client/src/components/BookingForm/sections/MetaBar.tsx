import { useStaffQuery } from '../../../hooks/queries';
import { useTranslation } from '../../../i18n/useTranslation';
import { formatDateTime } from '@shared/i18n/formatters';
import {
  EVENT_TYPE_VALUES,
  EVENT_TYPE_KEY_BY_VALUE,
  translateByValue,
} from '@shared/i18n/bookingLookups';

const MetaBar = ({ formData, handleChange, isOption, orderNumber, optionDurationHours, setOptionDurationHours, calendarEventTypeFilter }: any) => {
  const { data: staffMembers = [] } = useStaffQuery();
  const { t, T, locale } = useTranslation();

  const currentDateDisplay = formatDateTime(new Date(), locale);

  return (
    <div className="row row-cols-1 row-cols-md-2 row-cols-xl-5 g-3 mb-3">
      <div className="col">
        <label className="form-label">
          {isOption ? t(T.BOOKING.META.ORDER_NUMBER_OPTION) : t(T.BOOKING.META.ORDER_NUMBER_BOOKING)}
        </label>
        <input
          type="text"
          value={
            orderNumber ||
            (isOption
              ? t(T.BOOKING.META.ORDER_NUMBER_PENDING_OPTION)
              : t(T.BOOKING.META.ORDER_NUMBER_PENDING_BOOKING))
          }
          readOnly
          className="form-control bg-light text-dark fw-semibold"
        />
      </div>

      <div className="col">
        <label className="form-label">
          {isOption ? t(T.BOOKING.META.CREATED_BY_OPTION) : t(T.BOOKING.META.CREATED_BY_BOOKING)}
        </label>
        <select
          name="createdBy"
          required
          value={formData.createdBy}
          onChange={handleChange}
          className="form-select"
        >
          <option value="" disabled hidden>
            {isOption ? t(T.BOOKING.META.SELECT_CREATED_BY_OPTION) : t(T.BOOKING.META.SELECT_CREATED_BY_BOOKING)}
          </option>
          {staffMembers.map(member => (
            <option key={member.id} value={member.name}>{member.name}</option>
          ))}
        </select>
      </div>

      <div className="col">
        <label className="form-label">{t(T.BOOKING.META.EVENT_TYPE)}</label>
        <select
          name="eventType"
          required={!isOption}
          value={formData.eventType}
          onChange={handleChange}
          className="form-select"
        >
          <option value="" disabled hidden>
            {isOption ? t(T.BOOKING.META.SELECT_EVENT_TYPE_OPTIONAL) : t(T.BOOKING.META.SELECT_EVENT_TYPE)}
          </option>
          {EVENT_TYPE_VALUES.filter(type => {
            // Never hide the currently selected value — otherwise the select falls back
            // to the empty "בחירה" placeholder even when eventType is set (e.g. חתונה).
            if (type === formData.eventType) return true;
            // Option forms always offer the full list (incl. Wedding default).
            if (isOption) return true;
            const isOtherEvent = calendarEventTypeFilter === 'אירוע אחר' || formData.eventType === 'אירוע אחר';
            return !(isOtherEvent && type === 'חתונה');
          }).map(type => (
            <option key={type} value={type}>
              {translateByValue(t, EVENT_TYPE_KEY_BY_VALUE, type)}
            </option>
          ))}
        </select>
      </div>

      {isOption && (
        <div className="col">
          <label className="form-label">{t(T.BOOKING.META.OPTION_DURATION_HOURS)}</label>
          <input type="number" value={optionDurationHours} onChange={(e) => setOptionDurationHours(Number(e.target.value))} className="form-control" />
        </div>
      )}

      <div className="col">
        <label className="form-label">
          {isOption ? t(T.BOOKING.META.DATE_OPTION_OPEN) : t(T.BOOKING.META.DATE_EVENT_CLOSE)}
        </label>
        <input type="text" value={currentDateDisplay} readOnly className="form-control bg-light" style={{ direction: 'ltr', textAlign: 'right' }} />
      </div>
    </div>
  );
};

export default MetaBar;
