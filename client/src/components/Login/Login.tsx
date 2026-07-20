import { useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { API_BASE } from '../../config/api';
import { useTranslation } from '../../i18n/useTranslation';
import './Login.css';

interface LoginProps {
  onLoginSuccess: () => void;
}

import { getBrandConfig } from '@shared/brand/index';

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { t, T } = useTranslation();
  const [error, setError] = useState('');
  const brand = getBrandConfig();

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setError(t(T.AUTH.LOGIN.ERROR_NO_GOOGLE_TOKEN));
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onLoginSuccess();
      } else {
        setError(data.message || t(T.AUTH.LOGIN.ERROR_ACCESS_DENIED));
      }
    } catch {
      setError(t(T.AUTH.LOGIN.ERROR_NETWORK));
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <div className="login-brand">
          <img src={brand.logoUrl} alt={brand.displayName} className="login-logo" />
          <h2>{t(T.AUTH.LOGIN.TITLE)}</h2>
          <p className="login-subtitle">{brand.displayName} — מערכת ניהול</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="login-google-wrap">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError(t(T.AUTH.LOGIN.ERROR_GOOGLE_WIDGET))}
            theme="outline"
            size="large"
            text="signin_with"
            shape="rectangular"
          />
        </div>
      </div>
    </div>
  );
};
