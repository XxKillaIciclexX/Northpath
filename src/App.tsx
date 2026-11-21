import { useState, useEffect } from 'react';
import ComingSoon from './components/ComingSoon';
import MainLandingPage from './components/MainLandingPage';
import Login from './components/Login';
import SetPassword from './components/SetPassword';
import { supabase } from './lib/supabase';

function App() {
  const [showPreview, setShowPreview] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);

  useEffect(() => {
    const checkAuthState = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      const accessToken = hashParams.get('access_token');

      if (accessToken && (type === 'recovery' || type === 'signup')) {
        setShowSetPassword(true);
        setShowLogin(false);
        setShowPreview(false);
      }
    };

    checkAuthState();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowSetPassword(true);
        setShowLogin(false);
        setShowPreview(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handlePasswordComplete = () => {
    setShowSetPassword(false);
    setShowLogin(true);
  };

  const handleBackToHome = () => {
    setShowSetPassword(false);
    setShowLogin(false);
    setShowPreview(false);
  };

  return (
    <div className="min-h-screen">
      {showSetPassword ? (
        <SetPassword
          onComplete={handlePasswordComplete}
          onBack={handleBackToHome}
        />
      ) : showLogin ? (
        <Login onBack={() => setShowLogin(false)} />
      ) : showPreview ? (
        <MainLandingPage
          onBack={() => setShowPreview(false)}
          onLogin={() => setShowLogin(true)}
        />
      ) : (
        <ComingSoon onPreview={() => setShowPreview(true)} />
      )}
    </div>
  );
}

export default App;