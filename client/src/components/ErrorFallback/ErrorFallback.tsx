import React from 'react';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '2rem',
    textAlign: 'center',
    fontFamily: 'system-ui, sans-serif',
  }}>
    <h1 style={{ marginBottom: '0.5rem' }}>משהו השתבש</h1>
    <p style={{ color: '#666', marginBottom: '1.5rem' }}>
      השגיאה נשלחה לצוות הפיתוח. ניתן לנסות שוב.
    </p>
    {import.meta.env.DEV && error && (
      <pre style={{
        background: '#f5f5f5',
        padding: '1rem',
        borderRadius: '8px',
        maxWidth: '600px',
        overflow: 'auto',
        fontSize: '0.85rem',
        marginBottom: '1rem',
      }}>
        {error.message}
      </pre>
    )}
    {resetError && (
      <button
        type="button"
        onClick={resetError}
        style={{
          padding: '0.6rem 1.2rem',
          borderRadius: '8px',
          border: 'none',
          background: '#2d6a4f',
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        נסה שוב
      </button>
    )}
  </div>
);
