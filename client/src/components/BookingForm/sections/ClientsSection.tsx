import React, { useState } from 'react';

const ClientsSection = ({ formData, handleChange, errors, isWedding, isOption, styles }: any) => {
  const [activeEmailField, setActiveEmailField] = useState<string | null>(null);
  const emailSuffixes = ['@gmail.com', '@hotmail.com', '@yahoo.com', '@walla.co.il'];

  const handleEmailSelect = (fieldName: string, suffix: string) => {
    const baseEmail = formData[fieldName].split('@')[0];
    handleChange({ target: { name: fieldName, value: baseEmail + suffix } });
    setActiveEmailField(null);
  };

  return (
    <div className={styles.sectionCard}>
      <h3 className={styles.sectionHeader}>פרטי בעלי השמחה</h3>
      <div className={isWedding ? styles.clientsSectionWedding : styles.clientsSectionSingle}>
        
        {/* צד החתן / בעל השמחה */}
        <div className={styles.clientBlock}>
          <h3 className={styles.sectionTitlePrimary}>{isWedding ? "פרטי צד החתן" : "פרטי בעל השמחה / הלקוח"}</h3>
          <div className={styles.inputRow}>
            {isOption ? (
              <>
                <div className={styles.inputGroup}>
                  <label>שם פרטי </label>
                  <input type="text" name="clientAFirstName" required value={formData.clientAFirstName} onChange={handleChange} className={`${styles.input} ${errors?.clientAFirstName ? styles.inputError : ''}`} />
                </div>
                <div className={styles.inputGroup}>
                  <label>שם משפחה </label>
                  <input type="text" name="clientALastName" required value={formData.clientALastName} onChange={handleChange} className={`${styles.input} ${errors?.clientALastName ? styles.inputError : ''}`} />
                </div>
              </>
            ) : (
              <>
                <div className={styles.inputGroup}>
                  <label>שם מלא</label>
                  <input type="text" name="clientAFullName" required value={formData.clientAFullName} onChange={handleChange} className={`${styles.input} ${errors?.clientAFullName ? styles.inputError : ''}`} />
                </div>
                <div className={styles.inputGroup}>
                  <label>תעודת זהות</label>
                  <input type="text" name="clientAIdNumber" value={formData.clientAIdNumber} onChange={handleChange} className={styles.input} />
                </div>
              </>
            )}
          </div>
          {isOption && (
            <div className={styles.inputRow}>
              <div className={styles.inputGroup}>
                <label>תעודת זהות</label>
                <input type="text" name="clientAIdNumber" value={formData.clientAIdNumber} onChange={handleChange} className={styles.input} />
              </div>
            </div>
          )}
          <div className={styles.inputRow}>
            <div className={styles.inputGroup}>
              <label>טלפון 1 </label>
              <input type="tel" name="clientAPhone" required value={formData.clientAPhone} onChange={handleChange} className={`${styles.input} ${errors?.clientAPhone ? styles.inputError : ''}`} />
            </div>
            <div className={styles.inputGroup}>
              <label>טלפון 2</label>
              <input type="tel" name="clientAPhone2" value={formData.clientAPhone2} onChange={handleChange} className={styles.input} />
            </div>
          </div>
          <div className={`${styles.inputGroup} ${styles.emailWrap}`}>
            <label>אימייל</label>
            <input type="email" name="clientAEmail" value={formData.clientAEmail} onChange={(e) => { handleChange(e); setActiveEmailField('clientAEmail'); }} dir="ltr" style={{ textAlign: 'right' }} className={styles.input} autoComplete="off" />
            {activeEmailField === 'clientAEmail' && formData.clientAEmail.includes('@') && (
              <ul className={styles.emailSuggestions}>
                {emailSuffixes.map(s => <li key={s} onClick={() => handleEmailSelect('clientAEmail', s)} dir="ltr">{formData.clientAEmail.split('@')[0]}{s}</li>)}
              </ul>
            )}
          </div>
          <div className={styles.inputRow}>
            <div className={styles.inputGroup}><label>עיר</label><input type="text" name="clientACity" value={formData.clientACity} onChange={handleChange} className={styles.input} /></div>
            <div className={styles.inputGroup}><label>כתובת</label><input type="text" name="clientAAddress" value={formData.clientAAddress} onChange={handleChange} className={styles.input} /></div>
          </div>
        </div>

        {/* צד הכלה (מוצג רק בחתונות) */}
        {isWedding && !isOption && (
          <div className={styles.clientBlock}>
            <h3 className={styles.sectionTitleSecondary}>פרטי צד הכלה</h3>
            <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label>שם מלא</label>
                  <input type="text" name="clientBFullName" required value={formData.clientBFullName} onChange={handleChange} className={`${styles.input} ${errors?.clientBFullName ? styles.inputError : ''}`} />
                </div>
                <div className={styles.inputGroup}>
                  <label>תעודת זהות</label>
                  <input type="text" name="clientBIdNumber" value={formData.clientBIdNumber} onChange={handleChange} className={styles.input} />
                </div>
              </div>
              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label>טלפון 1 </label>
                  <input type="tel" name="clientBPhone" required value={formData.clientBPhone} onChange={handleChange} className={`${styles.input} ${errors?.clientBPhone ? styles.inputError : ''}`} />
                </div>
                <div className={styles.inputGroup}>
                  <label>טלפון 2</label>
                  <input type="tel" name="clientBPhone2" value={formData.clientBPhone2} onChange={handleChange} className={styles.input} />
                </div>
              </div>
              <div className={`${styles.inputGroup} ${styles.emailWrap}`}>
                  <label>אימייל</label>
                  <input type="email" name="clientBEmail" value={formData.clientBEmail} onChange={(e) => { handleChange(e); setActiveEmailField('clientBEmail'); }} className={styles.input} dir="ltr" style={{textAlign: 'right'}} autoComplete="off" />
                  {activeEmailField === 'clientBEmail' && formData.clientBEmail.includes('@') && (
                    <ul className={styles.emailSuggestions}>
                      {emailSuffixes.map(s => <li key={s} onClick={() => handleEmailSelect('clientBEmail', s)} dir="ltr">{formData.clientBEmail.split('@')[0]}{s}</li>)}
                    </ul>
                  )}
              </div>
              <div className={styles.inputRow}>
                <div className={styles.inputGroup}><label>עיר</label><input type="text" name="clientBCity" value={formData.clientBCity} onChange={handleChange} className={styles.input} /></div>
                <div className={styles.inputGroup}><label>כתובת</label><input type="text" name="clientBAddress" value={formData.clientBAddress} onChange={handleChange} className={styles.input} /></div>
              </div>
          </div>
        )}
        {isWedding && isOption && (
          <div className={styles.clientBlock}>
            <h3 className={styles.sectionTitleSecondary}>פרטי צד הכלה (אופציונלי)</h3>
            <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label>שם מלא</label>
                  <input type="text" name="clientBFullName" value={formData.clientBFullName} onChange={handleChange} className={styles.input} />
                </div>
                <div className={styles.inputGroup}>
                  <label>תעודת זהות</label>
                  <input type="text" name="clientBIdNumber" value={formData.clientBIdNumber} onChange={handleChange} className={styles.input} />
                </div>
              </div>
              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label>טלפון 1</label>
                  <input type="tel" name="clientBPhone" value={formData.clientBPhone} onChange={handleChange} className={styles.input} />
                </div>
                <div className={styles.inputGroup}>
                  <label>טלפון 2</label>
                  <input type="tel" name="clientBPhone2" value={formData.clientBPhone2} onChange={handleChange} className={styles.input} />
                </div>
              </div>
              <div className={`${styles.inputGroup} ${styles.emailWrap}`}>
                  <label>אימייל</label>
                  <input type="email" name="clientBEmail" value={formData.clientBEmail} onChange={(e) => { handleChange(e); setActiveEmailField('clientBEmail'); }} className={styles.input} dir="ltr" style={{textAlign: 'right'}} autoComplete="off" />
                  {activeEmailField === 'clientBEmail' && formData.clientBEmail.includes('@') && (
                    <ul className={styles.emailSuggestions}>
                      {emailSuffixes.map(s => <li key={s} onClick={() => handleEmailSelect('clientBEmail', s)} dir="ltr">{formData.clientBEmail.split('@')[0]}{s}</li>)}
                    </ul>
                  )}
              </div>
              <div className={styles.inputRow}>
                <div className={styles.inputGroup}><label>עיר</label><input type="text" name="clientBCity" value={formData.clientBCity} onChange={handleChange} className={styles.input} /></div>
                <div className={styles.inputGroup}><label>כתובת</label><input type="text" name="clientBAddress" value={formData.clientBAddress} onChange={handleChange} className={styles.input} /></div>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientsSection;