import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

const GoogleCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('OAuth session was not created');
        return response.json();
      })
      .then(({ user }) => {
        localStorage.setItem('user', JSON.stringify(user));
        navigate('/products', { replace: true });
      })
      .catch(() => navigate('/login?error=oauth_failed', { replace: true }));
  }, [navigate, searchParams]);

  return <main className="auth-page"><p>Completing sign in...</p></main>;
};

export default GoogleCallback;