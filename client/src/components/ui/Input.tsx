import React from 'react';
import styles from './Input.module.css';

interface FieldProps {
  label?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export const Field = ({ label, error, className = '', children }: FieldProps) => (
  <div className={`${styles.field} ${className}`}>
    {label && <label className={styles.label}>{label}</label>}
    {children}
    {error && <span className={styles.error}>{error}</span>}
  </div>
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fieldClassName?: string;
}

export const Input = ({ label, error, className = '', fieldClassName = '', ...props }: InputProps) => (
  <Field label={label} error={error} className={fieldClassName}>
    <input className={`${styles.input} ${className}`} {...props} />
  </Field>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = ({ label, error, className = '', children, ...props }: SelectProps) => (
  <Field label={label} error={error}>
    <select className={`${styles.input} ${styles.select} ${className}`} {...props}>
      {children}
    </select>
  </Field>
);

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = ({ label, error, className = '', ...props }: TextareaProps) => (
  <Field label={label} error={error}>
    <textarea className={`${styles.input} ${styles.textarea} ${className}`} {...props} />
  </Field>
);
