import { useState, type ChangeEvent, type ReactNode } from 'react';
import type { BookingFormChangeHandler, BookingFormData } from '../bookingFormTypes';
import { useTranslation } from '../../../i18n/useTranslation';
import styles from './ClientsSection.module.css';

interface ClientsSectionProps {
  formData: BookingFormData;
  handleChange: BookingFormChangeHandler;
  errors: Record<string, string>;
  isWedding: boolean;
  isOption: boolean;
}

type EmailFieldName = 'clientAEmail' | 'clientBEmail';

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? styles.fieldWide : styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
    </div>
  );
}

const ClientsSection = ({ formData, handleChange, errors, isWedding, isOption }: ClientsSectionProps) => {
  const { t, T } = useTranslation();
  const [activeEmailField, setActiveEmailField] = useState<string | null>(null);
  const emailSuffixes = ['@gmail.com', '@hotmail.com', '@yahoo.com', '@walla.co.il'];

  const handleEmailSelect = (fieldName: EmailFieldName, suffix: string) => {
    const baseEmail = formData[fieldName].split('@')[0];
    handleChange({
      target: { name: fieldName, value: baseEmail + suffix },
    } as ChangeEvent<HTMLInputElement>);
    setActiveEmailField(null);
  };

  const renderEmailField = (
    fieldName: EmailFieldName,
    labelKey: typeof T.BOOKING.CLIENTS.EMAIL | typeof T.BOOKING.CLIENTS.EMAIL_REQUIRED,
    required = false,
  ) => (
    <Field label={t(labelKey)} wide>
      <input
        type="email"
        name={fieldName}
        required={required}
        value={formData[fieldName]}
        onChange={(e) => {
          handleChange(e);
          setActiveEmailField(fieldName);
        }}
        className={`${styles.input} ${styles.emailInput}`}
        autoComplete="off"
      />
      {activeEmailField === fieldName && formData[fieldName].includes('@') && (
        <ul className="maple-email-suggestions">
          {emailSuffixes.map((suffix) => (
            <li key={suffix} onClick={() => handleEmailSelect(fieldName, suffix)} dir="ltr">
              {formData[fieldName].split('@')[0]}
              {suffix}
            </li>
          ))}
        </ul>
      )}
    </Field>
  );

  const sideATitle = isWedding ? t(T.BOOKING.CLIENTS.GROOM_SIDE) : t(T.BOOKING.CLIENTS.CLIENT_SIDE);
  const sideBTitle = isOption
    ? t(T.BOOKING.CLIENTS.BRIDE_SIDE_OPTIONAL)
    : t(T.BOOKING.CLIENTS.BRIDE_SIDE);

  return (
    <div className={`card mb-3 ${styles.clientsCard}`}>
      <div className="card-header maple-section-header">{t(T.BOOKING.CLIENTS.SECTION_TITLE)}</div>
      <div className="card-body">
        <div className={`${styles.sides} ${isWedding ? styles.sidesSplit : ''}`}>
          <section className={styles.sidePanel}>
            <h4 className={styles.sideTitle}>{sideATitle}</h4>
            <div className={styles.fieldsGrid}>
              {isOption ? (
                <>
                  <Field label={t(T.BOOKING.CLIENTS.FIRST_NAME)}>
                    <input
                      type="text"
                      name="clientAFirstName"
                      required
                      value={formData.clientAFirstName}
                      onChange={handleChange}
                      className={`${styles.input} ${errors?.clientAFirstName ? 'is-invalid' : ''}`}
                    />
                    {errors?.clientAFirstName && (
                      <div className={styles.error}>{errors.clientAFirstName}</div>
                    )}
                  </Field>
                  <Field label={t(T.BOOKING.CLIENTS.LAST_NAME)}>
                    <input
                      type="text"
                      name="clientALastName"
                      required
                      value={formData.clientALastName}
                      onChange={handleChange}
                      className={`${styles.input} ${errors?.clientALastName ? 'is-invalid' : ''}`}
                    />
                    {errors?.clientALastName && (
                      <div className={styles.error}>{errors.clientALastName}</div>
                    )}
                  </Field>
                  <Field label={t(T.BOOKING.CLIENTS.ID_NUMBER)}>
                    <input
                      type="text"
                      name="clientAIdNumber"
                      value={formData.clientAIdNumber}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </Field>
                  {/* Keep the 2-column rhythm so phones start on a fresh row */}
                  <div className={styles.field} aria-hidden="true" />
                </>
              ) : (
                <>
                  <Field label={t(T.BOOKING.CLIENTS.FULL_NAME)}>
                    <input
                      type="text"
                      name="clientAFullName"
                      required
                      value={formData.clientAFullName}
                      onChange={handleChange}
                      className={`${styles.input} ${errors?.clientAFullName ? 'is-invalid' : ''}`}
                    />
                    {errors?.clientAFullName && (
                      <div className={styles.error}>{errors.clientAFullName}</div>
                    )}
                  </Field>
                  <Field label={t(T.BOOKING.CLIENTS.ID_NUMBER)}>
                    <input
                      type="text"
                      name="clientAIdNumber"
                      value={formData.clientAIdNumber}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </Field>
                </>
              )}

              <Field label={t(T.BOOKING.CLIENTS.PHONE_1)}>
                <input
                  type="tel"
                  name="clientAPhone"
                  required
                  value={formData.clientAPhone}
                  onChange={handleChange}
                  className={`${styles.input} ${errors?.clientAPhone ? 'is-invalid' : ''}`}
                />
                {errors?.clientAPhone && <div className={styles.error}>{errors.clientAPhone}</div>}
              </Field>
              <Field label={t(T.BOOKING.CLIENTS.PHONE_2)}>
                <input
                  type="tel"
                  name="clientAPhone2"
                  value={formData.clientAPhone2}
                  onChange={handleChange}
                  className={styles.input}
                />
              </Field>

              {renderEmailField(
                'clientAEmail',
                isOption ? T.BOOKING.CLIENTS.EMAIL_REQUIRED : T.BOOKING.CLIENTS.EMAIL,
                isOption,
              )}

              <Field label={t(T.BOOKING.CLIENTS.CITY)}>
                <input
                  type="text"
                  name="clientACity"
                  value={formData.clientACity}
                  onChange={handleChange}
                  className={styles.input}
                />
              </Field>
              <Field label={t(T.BOOKING.CLIENTS.ADDRESS)}>
                <input
                  type="text"
                  name="clientAAddress"
                  value={formData.clientAAddress}
                  onChange={handleChange}
                  className={styles.input}
                />
              </Field>
            </div>
          </section>

          {isWedding && (
            <>
              <div className={styles.divider} aria-hidden="true" />
              <section className={styles.sidePanel}>
                <h4 className={styles.sideTitle}>{sideBTitle}</h4>
                <div className={styles.fieldsGrid}>
                  <Field label={t(T.BOOKING.CLIENTS.FULL_NAME)}>
                    <input
                      type="text"
                      name="clientBFullName"
                      required={!isOption}
                      value={formData.clientBFullName}
                      onChange={handleChange}
                      className={`${styles.input} ${errors?.clientBFullName ? 'is-invalid' : ''}`}
                    />
                    {errors?.clientBFullName && (
                      <div className={styles.error}>{errors.clientBFullName}</div>
                    )}
                  </Field>
                  <Field label={t(T.BOOKING.CLIENTS.ID_NUMBER)}>
                    <input
                      type="text"
                      name="clientBIdNumber"
                      value={formData.clientBIdNumber}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </Field>

                  <Field label={t(T.BOOKING.CLIENTS.PHONE_1)}>
                    <input
                      type="tel"
                      name="clientBPhone"
                      required={!isOption}
                      value={formData.clientBPhone}
                      onChange={handleChange}
                      className={`${styles.input} ${errors?.clientBPhone ? 'is-invalid' : ''}`}
                    />
                    {errors?.clientBPhone && (
                      <div className={styles.error}>{errors.clientBPhone}</div>
                    )}
                  </Field>
                  <Field label={t(T.BOOKING.CLIENTS.PHONE_2)}>
                    <input
                      type="tel"
                      name="clientBPhone2"
                      value={formData.clientBPhone2}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </Field>

                  {renderEmailField('clientBEmail', T.BOOKING.CLIENTS.EMAIL)}

                  <Field label={t(T.BOOKING.CLIENTS.CITY)}>
                    <input
                      type="text"
                      name="clientBCity"
                      value={formData.clientBCity}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </Field>
                  <Field label={t(T.BOOKING.CLIENTS.ADDRESS)}>
                    <input
                      type="text"
                      name="clientBAddress"
                      value={formData.clientBAddress}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </Field>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientsSection;
