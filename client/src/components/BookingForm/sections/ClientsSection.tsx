import { useState } from 'react';
import type { BookingFormChangeHandler, BookingFormData } from '../bookingFormTypes';
import { useTranslation } from '../../../i18n/useTranslation';

interface ClientsSectionProps {
  formData: BookingFormData;
  handleChange: BookingFormChangeHandler;
  errors: Record<string, string>;
  isWedding: boolean;
  isOption: boolean;
}

const ClientsSection = ({ formData, handleChange, errors, isWedding, isOption }: ClientsSectionProps) => {
  const { t, T } = useTranslation();
  const [activeEmailField, setActiveEmailField] = useState<string | null>(null);
  const emailSuffixes = ['@gmail.com', '@hotmail.com', '@yahoo.com', '@walla.co.il'];

  const handleEmailSelect = (fieldName: 'clientAEmail' | 'clientBEmail', suffix: string) => {
    const baseEmail = formData[fieldName].split('@')[0];
    handleChange({ target: { name: fieldName, value: baseEmail + suffix } } as React.ChangeEvent<HTMLInputElement>);
    setActiveEmailField(null);
  };

  const renderEmailField = (
    fieldName: 'clientAEmail' | 'clientBEmail',
    labelKey: typeof T.BOOKING.CLIENTS.EMAIL | typeof T.BOOKING.CLIENTS.EMAIL_REQUIRED,
    required = false,
  ) => (
    <div className="mb-3 position-relative">
      <label className="form-label">{t(labelKey)}</label>
      <input
        type="email"
        name={fieldName}
        required={required}
        value={formData[fieldName]}
        onChange={(e) => { handleChange(e); setActiveEmailField(fieldName); }}
        dir="ltr"
        style={{ textAlign: 'right' }}
        className="form-control"
        autoComplete="off"
      />
      {activeEmailField === fieldName && formData[fieldName].includes('@') && (
        <ul className="maple-email-suggestions">
          {emailSuffixes.map(s => (
            <li key={s} onClick={() => handleEmailSelect(fieldName, s)} dir="ltr">
              {formData[fieldName].split('@')[0]}{s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="card mb-3">
      <div className="card-header maple-section-header">{t(T.BOOKING.CLIENTS.SECTION_TITLE)}</div>
      <div className="card-body">
        <div className={isWedding ? 'row g-3' : ''}>
          <div className={isWedding ? 'col-lg-6' : ''}>
            <h4 className="maple-client-block-title">
              {isWedding ? t(T.BOOKING.CLIENTS.GROOM_SIDE) : t(T.BOOKING.CLIENTS.CLIENT_SIDE)}
            </h4>
            <div className="row g-3">
              {isOption ? (
                <>
                  <div className="col-md-6">
                    <label className="form-label">{t(T.BOOKING.CLIENTS.FIRST_NAME)}</label>
                    <input type="text" name="clientAFirstName" required value={formData.clientAFirstName} onChange={handleChange} className={`form-control ${errors?.clientAFirstName ? 'is-invalid' : ''}`} />
                    {errors?.clientAFirstName && <div className="invalid-feedback">{errors.clientAFirstName}</div>}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">{t(T.BOOKING.CLIENTS.LAST_NAME)}</label>
                    <input type="text" name="clientALastName" required value={formData.clientALastName} onChange={handleChange} className={`form-control ${errors?.clientALastName ? 'is-invalid' : ''}`} />
                    {errors?.clientALastName && <div className="invalid-feedback">{errors.clientALastName}</div>}
                  </div>
                </>
              ) : (
                <>
                  <div className="col-md-6">
                    <label className="form-label">{t(T.BOOKING.CLIENTS.FULL_NAME)}</label>
                    <input type="text" name="clientAFullName" required value={formData.clientAFullName} onChange={handleChange} className={`form-control ${errors?.clientAFullName ? 'is-invalid' : ''}`} />
                    {errors?.clientAFullName && <div className="invalid-feedback">{errors.clientAFullName}</div>}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">{t(T.BOOKING.CLIENTS.ID_NUMBER)}</label>
                    <input type="text" name="clientAIdNumber" value={formData.clientAIdNumber} onChange={handleChange} className="form-control" />
                  </div>
                </>
              )}
            </div>
            {isOption && (
              <div className="row g-3 mt-0">
                <div className="col-md-6">
                  <label className="form-label">{t(T.BOOKING.CLIENTS.ID_NUMBER)}</label>
                  <input type="text" name="clientAIdNumber" value={formData.clientAIdNumber} onChange={handleChange} className="form-control" />
                </div>
              </div>
            )}
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">{t(T.BOOKING.CLIENTS.PHONE_1)}</label>
                <input type="tel" name="clientAPhone" required value={formData.clientAPhone} onChange={handleChange} className={`form-control ${errors?.clientAPhone ? 'is-invalid' : ''}`} />
                {errors?.clientAPhone && <div className="invalid-feedback">{errors.clientAPhone}</div>}
              </div>
              <div className="col-md-6">
                <label className="form-label">{t(T.BOOKING.CLIENTS.PHONE_2)}</label>
                <input type="tel" name="clientAPhone2" value={formData.clientAPhone2} onChange={handleChange} className="form-control" />
              </div>
            </div>
            {renderEmailField(
              'clientAEmail',
              isOption ? T.BOOKING.CLIENTS.EMAIL_REQUIRED : T.BOOKING.CLIENTS.EMAIL,
              isOption,
            )}
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">{t(T.BOOKING.CLIENTS.CITY)}</label>
                <input type="text" name="clientACity" value={formData.clientACity} onChange={handleChange} className="form-control" />
              </div>
              <div className="col-md-6">
                <label className="form-label">{t(T.BOOKING.CLIENTS.ADDRESS)}</label>
                <input type="text" name="clientAAddress" value={formData.clientAAddress} onChange={handleChange} className="form-control" />
              </div>
            </div>
          </div>

          {isWedding && !isOption && (
            <div className="col-lg-6">
              <h4 className="maple-client-block-title">{t(T.BOOKING.CLIENTS.BRIDE_SIDE)}</h4>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">{t(T.BOOKING.CLIENTS.FULL_NAME)}</label>
                  <input type="text" name="clientBFullName" required value={formData.clientBFullName} onChange={handleChange} className={`form-control ${errors?.clientBFullName ? 'is-invalid' : ''}`} />
                  {errors?.clientBFullName && <div className="invalid-feedback">{errors.clientBFullName}</div>}
                </div>
                <div className="col-md-6">
                  <label className="form-label">{t(T.BOOKING.CLIENTS.ID_NUMBER)}</label>
                  <input type="text" name="clientBIdNumber" value={formData.clientBIdNumber} onChange={handleChange} className="form-control" />
                </div>
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">{t(T.BOOKING.CLIENTS.PHONE_1)}</label>
                  <input type="tel" name="clientBPhone" required value={formData.clientBPhone} onChange={handleChange} className={`form-control ${errors?.clientBPhone ? 'is-invalid' : ''}`} />
                  {errors?.clientBPhone && <div className="invalid-feedback">{errors.clientBPhone}</div>}
                </div>
                <div className="col-md-6">
                  <label className="form-label">{t(T.BOOKING.CLIENTS.PHONE_2)}</label>
                  <input type="tel" name="clientBPhone2" value={formData.clientBPhone2} onChange={handleChange} className="form-control" />
                </div>
              </div>
              {renderEmailField('clientBEmail', T.BOOKING.CLIENTS.EMAIL)}
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">{t(T.BOOKING.CLIENTS.CITY)}</label>
                  <input type="text" name="clientBCity" value={formData.clientBCity} onChange={handleChange} className="form-control" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">{t(T.BOOKING.CLIENTS.ADDRESS)}</label>
                  <input type="text" name="clientBAddress" value={formData.clientBAddress} onChange={handleChange} className="form-control" />
                </div>
              </div>
            </div>
          )}

          {isWedding && isOption && (
            <div className="col-lg-6">
              <h4 className="maple-client-block-title">{t(T.BOOKING.CLIENTS.BRIDE_SIDE_OPTIONAL)}</h4>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">{t(T.BOOKING.CLIENTS.FULL_NAME)}</label>
                  <input type="text" name="clientBFullName" value={formData.clientBFullName} onChange={handleChange} className="form-control" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">{t(T.BOOKING.CLIENTS.ID_NUMBER)}</label>
                  <input type="text" name="clientBIdNumber" value={formData.clientBIdNumber} onChange={handleChange} className="form-control" />
                </div>
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">{t(T.BOOKING.CLIENTS.PHONE_1)}</label>
                  <input type="tel" name="clientBPhone" value={formData.clientBPhone} onChange={handleChange} className="form-control" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">{t(T.BOOKING.CLIENTS.PHONE_2)}</label>
                  <input type="tel" name="clientBPhone2" value={formData.clientBPhone2} onChange={handleChange} className="form-control" />
                </div>
              </div>
              {renderEmailField('clientBEmail', T.BOOKING.CLIENTS.EMAIL)}
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">{t(T.BOOKING.CLIENTS.CITY)}</label>
                  <input type="text" name="clientBCity" value={formData.clientBCity} onChange={handleChange} className="form-control" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">{t(T.BOOKING.CLIENTS.ADDRESS)}</label>
                  <input type="text" name="clientBAddress" value={formData.clientBAddress} onChange={handleChange} className="form-control" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientsSection;
