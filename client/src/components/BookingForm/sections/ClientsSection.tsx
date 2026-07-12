import { useState } from 'react';

const ClientsSection = ({ formData, handleChange, errors, isWedding, isOption }: any) => {
  const [activeEmailField, setActiveEmailField] = useState<string | null>(null);
  const emailSuffixes = ['@gmail.com', '@hotmail.com', '@yahoo.com', '@walla.co.il'];

  const handleEmailSelect = (fieldName: string, suffix: string) => {
    const baseEmail = formData[fieldName].split('@')[0];
    handleChange({ target: { name: fieldName, value: baseEmail + suffix } });
    setActiveEmailField(null);
  };

  const renderEmailField = (fieldName: string, label: string, required = false) => (
    <div className="mb-3 position-relative">
      <label className="form-label">{label}</label>
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
      <div className="card-header maple-section-header">פרטי בעלי השמחה</div>
      <div className="card-body">
        <div className={isWedding ? 'row g-3' : ''}>
          <div className={isWedding ? 'col-lg-6' : ''}>
            <h4 className="maple-client-block-title">{isWedding ? 'פרטי צד החתן' : 'פרטי בעל השמחה / הלקוח'}</h4>
            <div className="row g-3">
              {isOption ? (
                <>
                  <div className="col-md-6">
                    <label className="form-label">שם פרטי</label>
                    <input type="text" name="clientAFirstName" required value={formData.clientAFirstName} onChange={handleChange} className={`form-control ${errors?.clientAFirstName ? 'is-invalid' : ''}`} />
                    {errors?.clientAFirstName && <div className="invalid-feedback">{errors.clientAFirstName}</div>}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">שם משפחה</label>
                    <input type="text" name="clientALastName" required value={formData.clientALastName} onChange={handleChange} className={`form-control ${errors?.clientALastName ? 'is-invalid' : ''}`} />
                    {errors?.clientALastName && <div className="invalid-feedback">{errors.clientALastName}</div>}
                  </div>
                </>
              ) : (
                <>
                  <div className="col-md-6">
                    <label className="form-label">שם מלא</label>
                    <input type="text" name="clientAFullName" required value={formData.clientAFullName} onChange={handleChange} className={`form-control ${errors?.clientAFullName ? 'is-invalid' : ''}`} />
                    {errors?.clientAFullName && <div className="invalid-feedback">{errors.clientAFullName}</div>}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">תעודת זהות</label>
                    <input type="text" name="clientAIdNumber" value={formData.clientAIdNumber} onChange={handleChange} className="form-control" />
                  </div>
                </>
              )}
            </div>
            {isOption && (
              <div className="row g-3 mt-0">
                <div className="col-md-6">
                  <label className="form-label">תעודת זהות</label>
                  <input type="text" name="clientAIdNumber" value={formData.clientAIdNumber} onChange={handleChange} className="form-control" />
                </div>
              </div>
            )}
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">טלפון 1</label>
                <input type="tel" name="clientAPhone" required value={formData.clientAPhone} onChange={handleChange} className={`form-control ${errors?.clientAPhone ? 'is-invalid' : ''}`} />
                {errors?.clientAPhone && <div className="invalid-feedback">{errors.clientAPhone}</div>}
              </div>
              <div className="col-md-6">
                <label className="form-label">טלפון 2</label>
                <input type="tel" name="clientAPhone2" value={formData.clientAPhone2} onChange={handleChange} className="form-control" />
              </div>
            </div>
            {renderEmailField('clientAEmail', `אימייל${isOption ? ' *' : ''}`, isOption)}
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">עיר</label>
                <input type="text" name="clientACity" value={formData.clientACity} onChange={handleChange} className="form-control" />
              </div>
              <div className="col-md-6">
                <label className="form-label">כתובת</label>
                <input type="text" name="clientAAddress" value={formData.clientAAddress} onChange={handleChange} className="form-control" />
              </div>
            </div>
          </div>

          {isWedding && !isOption && (
            <div className="col-lg-6">
              <h4 className="maple-client-block-title">פרטי צד הכלה</h4>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">שם מלא</label>
                  <input type="text" name="clientBFullName" required value={formData.clientBFullName} onChange={handleChange} className={`form-control ${errors?.clientBFullName ? 'is-invalid' : ''}`} />
                  {errors?.clientBFullName && <div className="invalid-feedback">{errors.clientBFullName}</div>}
                </div>
                <div className="col-md-6">
                  <label className="form-label">תעודת זהות</label>
                  <input type="text" name="clientBIdNumber" value={formData.clientBIdNumber} onChange={handleChange} className="form-control" />
                </div>
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">טלפון 1</label>
                  <input type="tel" name="clientBPhone" required value={formData.clientBPhone} onChange={handleChange} className={`form-control ${errors?.clientBPhone ? 'is-invalid' : ''}`} />
                  {errors?.clientBPhone && <div className="invalid-feedback">{errors.clientBPhone}</div>}
                </div>
                <div className="col-md-6">
                  <label className="form-label">טלפון 2</label>
                  <input type="tel" name="clientBPhone2" value={formData.clientBPhone2} onChange={handleChange} className="form-control" />
                </div>
              </div>
              {renderEmailField('clientBEmail', 'אימייל')}
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">עיר</label>
                  <input type="text" name="clientBCity" value={formData.clientBCity} onChange={handleChange} className="form-control" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">כתובת</label>
                  <input type="text" name="clientBAddress" value={formData.clientBAddress} onChange={handleChange} className="form-control" />
                </div>
              </div>
            </div>
          )}

          {isWedding && isOption && (
            <div className="col-lg-6">
              <h4 className="maple-client-block-title">פרטי צד הכלה (אופציונלי)</h4>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">שם מלא</label>
                  <input type="text" name="clientBFullName" value={formData.clientBFullName} onChange={handleChange} className="form-control" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">תעודת זהות</label>
                  <input type="text" name="clientBIdNumber" value={formData.clientBIdNumber} onChange={handleChange} className="form-control" />
                </div>
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">טלפון 1</label>
                  <input type="tel" name="clientBPhone" value={formData.clientBPhone} onChange={handleChange} className="form-control" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">טלפון 2</label>
                  <input type="tel" name="clientBPhone2" value={formData.clientBPhone2} onChange={handleChange} className="form-control" />
                </div>
              </div>
              {renderEmailField('clientBEmail', 'אימייל')}
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">עיר</label>
                  <input type="text" name="clientBCity" value={formData.clientBCity} onChange={handleChange} className="form-control" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">כתובת</label>
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
