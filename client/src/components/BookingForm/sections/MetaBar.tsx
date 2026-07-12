import { useStaffQuery } from '../../../hooks/queries';

const eventTypesList = ['חתונה', 'אירוסין', 'בר מצווה', 'בת מצווה', 'ברית', 'בריתה', 'חינה', 'הרמת כוסית', 'כנס מקצועי', 'אירוע חברה/עסקי', 'השכרת אולם בלי אוכל'];

const MetaBar = ({ formData, handleChange, isOption, orderNumber, optionDurationHours, setOptionDurationHours }: any) => {
  const { data: staffMembers = [] } = useStaffQuery();

  const currentDateDisplay = new Date().toLocaleString('he-IL', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="row row-cols-1 row-cols-md-2 row-cols-xl-5 g-3 mb-3">
      <div className="col">
        <label className="form-label">מספר {isOption ? 'אופציה' : 'הזמנה'}</label>
        <input type="text" value={orderNumber} readOnly className="form-control bg-light" />
      </div>

      <div className="col">
        <label className="form-label">{isOption ? 'מי סגר את האופציה *' : 'שם הנציג / סוכן '}</label>
        <select
          name="createdBy"
          required
          value={formData.createdBy}
          onChange={handleChange}
          className="form-select"
        >
          <option value="" disabled hidden>
            {isOption ? 'בחרי מי סגר את האופציה' : 'בחרי נציג מהרשימה'}
          </option>
          {staffMembers.map(member => (
            <option key={member.id} value={member.name}>{member.name}</option>
          ))}
        </select>
      </div>

      <div className="col">
        <label className="form-label">סוג אירוע{isOption ? '' : ' '}</label>
        <select
          name="eventType"
          required={!isOption}
          value={formData.eventType}
          onChange={handleChange}
          className="form-select"
        >
          <option value="" disabled hidden>
            {isOption ? 'בחירה (אופציונלי)' : 'בחרי מסוגי האירועים'}
          </option>
          {eventTypesList.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>

      {isOption && (
        <div className="col">
          <label className="form-label">תוקף אופציה (בשעות)</label>
          <input type="number" value={optionDurationHours} onChange={(e) => setOptionDurationHours(Number(e.target.value))} className="form-control" />
        </div>
      )}

      <div className="col">
        <label className="form-label">תאריך {isOption ? 'פתיחת האופציה' : 'סגירת האירוע'}</label>
        <input type="text" value={currentDateDisplay} readOnly className="form-control bg-light" style={{ direction: 'ltr', textAlign: 'right' }} />
      </div>
    </div>
  );
};

export default MetaBar;
