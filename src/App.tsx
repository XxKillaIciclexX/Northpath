import { useState } from 'react';
import ComingSoon from './components/ComingSoon';
import MainLandingPage from './components/MainLandingPage';

export default function App() {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="min-h-screen">
      {showPreview ? (
        <MainLandingPage
          onBack={() => setShowPreview(false)}
          onLogin={() => window.alert('Account access is temporarily unavailable while we migrate away from the previous authentication provider.')}
        />
      ) : (
        <ComingSoon onPreview={() => setShowPreview(true)} />
      )}
    </div>
  );
}
