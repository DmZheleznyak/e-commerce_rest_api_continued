import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { fetchWithAuth } from '../../api';

const stripePublishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const PaymentForm = ({ total, isCheckingOut, onPaymentSuccess, setError, setIsCheckingOut }) => {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setIsCheckingOut(true);
    setError('');
    try {
      const result = await stripe.confirmPayment({ elements, redirect: 'if_required' });
      if (result.error) throw new Error(result.error.message);
      if (!result.paymentIntent || result.paymentIntent.status !== 'succeeded') {
        throw new Error('The payment was not completed.');
      }
      await onPaymentSuccess(result.paymentIntent.id);
    } catch (paymentError) {
      setError(paymentError.message || 'Unable to complete the payment.');
      setIsCheckingOut(false);
    }
  };

  return (
    <form className="checkout-payment" onSubmit={handleSubmit}>
      <PaymentElement />
      <button className="submit-button" type="submit" disabled={!stripe || !elements || isCheckingOut}>
        {isCheckingOut ? 'Processing payment...' : `Pay $${total.toFixed(2)}`}
      </button>
    </form>
  );
};

const Checkout = () => {
  const [cart, setCart] = useState({ items: [] });
  const [clientSecret, setClientSecret] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const response = await fetchWithAuth('/api/cart');
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load your cart.');
        setCart(result);
        if (result.items.length > 0) await refreshPaymentIntent();
      } catch (loadError) {
        setError(loadError.message || 'Unable to load your cart.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCart();
  }, []);

  const total = cart.items.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.quantity),
    0
  );

  const refreshPaymentIntent = async () => {
    const response = await fetchWithAuth('/api/payments/create-intent', {
      method: 'POST',
      credentials: 'include'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to prepare payment.');
    setClientSecret(result.clientSecret);
  };

  const updateQuantity = async (productId, quantity) => {
    setIsUpdating(true);
    try {
      const response = await fetchWithAuth(`/api/cart/items/${productId}`, {
        method: quantity > 0 ? 'PUT' : 'DELETE',
        headers: quantity > 0 ? { 'Content-Type': 'application/json' } : undefined,
        body: quantity > 0 ? JSON.stringify({ quantity }) : undefined,
        credentials: 'include'
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update this item.');
      if (quantity === 0) {
        setCart((currentCart) => ({ ...currentCart, items: currentCart.items.filter((item) => item.id !== productId) }));
        if (cart.items.length === 1) {
          setClientSecret('');
        } else {
          await refreshPaymentIntent();
        }
      } else {
        setCart((currentCart) => ({
          ...currentCart,
          items: currentCart.items.map((item) => item.id === productId ? { ...item, quantity: result.quantity } : item)
        }));
        await refreshPaymentIntent();
      }
    } catch (removeError) {
      setError(removeError.message || 'Unable to update this item.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    try {
      const response = await fetchWithAuth('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ payment_intent_id: paymentIntentId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to place this order.');
      setCart({ items: [] });
      setClientSecret('');
    } catch (checkoutError) {
      setError(checkoutError.message || 'Unable to place this order.');
      throw checkoutError;
    }
  };

  if (isLoading) {
    return <main className="checkout-page"><p className="products-status">Loading your cart...</p></main>;
  }

  return (
    <main className="checkout-page">
      <section className="checkout-content" aria-labelledby="checkout-title">
        <Link className="back-link" to="/products">Back to products</Link>
        <Link className="history-link" to="/orders">Order history</Link>
        <p className="eyebrow">Active cart</p>
        <h1 id="checkout-title">Your checkout</h1>
        {error && <p className="products-error" role="alert">{error}</p>}
        {cart.items.length === 0 ? (
          <p className="products-status">Your active cart is empty.</p>
        ) : (
          <div className="cart-items">
            {cart.items.map((item) => (
              <article className="cart-item" key={item.id}>
                <div>
                  <h2>{item.name}</h2>
                  <p>{item.quantity} x ${Number(item.price).toFixed(2)}</p>
                </div>
                <div className="cart-item-actions">
                  <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={isUpdating}>-</button>
                  <span>{item.quantity}</span>
                  <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={isUpdating || item.quantity >= item.available_quantity}>+</button>
                  <button className="remove-cart-button" type="button" onClick={() => updateQuantity(item.id, 0)} disabled={isUpdating}>Remove</button>
                </div>
              </article>
            ))}
            <p className="cart-total">Total: ${total.toFixed(2)}</p>
            {!stripePromise && (
              <p className="products-error" role="alert">
                Add REACT_APP_STRIPE_PUBLISHABLE_KEY to anchorope/.env and restart the frontend.
              </p>
            )}
            {clientSecret && stripePromise && (
              <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
                <PaymentForm
                  total={total}
                  isCheckingOut={isCheckingOut}
                  onPaymentSuccess={handlePaymentSuccess}
                  setError={setError}
                  setIsCheckingOut={setIsCheckingOut}
                />
              </Elements>
            )}
          </div>
        )}
      </section>
    </main>
  );
};

export default Checkout;