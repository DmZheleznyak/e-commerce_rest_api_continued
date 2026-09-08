import './App.css';
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate }  from 'react-router';

import Login from './pages/login/Login';
import Registartion from './pages/registration/Registration';
import GoogleCallback from './pages/login/GoogleCallback';
import ProductList from './pages/products/ProductList';
import ProductDetails from './pages/products/product/ProductDetails';
import Checkout from './pages/checkout/Checkout';
import OrderHistory from './pages/orders/OrderHistory';

function AuthenticatedLayout({ children }) {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [authState, setAuthState] = useState({ status: 'checking', user: null });

  useEffect(() => {
    let isMounted = true;

    fetch('/api/me', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) {
          localStorage.removeItem('user');
          if (isMounted) setAuthState({ status: 'unauthenticated', user: null });
          return;
        }

        const { user } = await response.json();
        localStorage.setItem('user', JSON.stringify(user));
        if (isMounted) setAuthState({ status: 'authenticated', user });
      })
      .catch(() => {
        localStorage.removeItem('user');
        if (isMounted) setAuthState({ status: 'unauthenticated', user: null });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (authState.status === 'checking') {
    return <main className="auth-page"><p>Checking your session...</p></main>;
  }

  if (authState.status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } finally {
      localStorage.removeItem('user');
      navigate('/login', { replace: true });
    }
  };

  return (
    <>
      <header className="app-header">
        <span className="app-brand">AnchoRope</span>
        <nav className="app-navigation" aria-label="Account navigation">
          <a className="cart-link" href="/checkout">Cart</a>
          <a className="cart-link" href="/orders">Orders</a>
          <button className="logout-button" type="button" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </nav>
      </header>
      {children}
    </>
  );
}

function Products() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  return (
    <main className="products-page">
      <section className="products-intro" aria-labelledby="products-title">
        <p className="eyebrow">Signed in</p>
        <h1 id="products-title">Find your next favorite.</h1>
        <p>Browse the AnchoRope collection, curated for daily use.</p>
        <p className="products-account">{user?.email || 'Your account is ready.'}</p>
      </section>
      <ProductList />
    </main>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registration" element={<Registartion />} />
          <Route path="/auth/callback" element={<GoogleCallback />} />
          <Route path="/products" element={<AuthenticatedLayout><Products /></AuthenticatedLayout>} />
          <Route path="/products/:id" element={<AuthenticatedLayout><ProductDetails /></AuthenticatedLayout>} />
          <Route path="/checkout" element={<AuthenticatedLayout><Checkout /></AuthenticatedLayout>} />
          <Route path="/orders" element={<AuthenticatedLayout><OrderHistory /></AuthenticatedLayout>} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
