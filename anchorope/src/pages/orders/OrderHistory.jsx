import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchWithAuth } from '../../api';

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetchWithAuth('/api/orders/history');
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load order history.');
        setOrders(result);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load order history.');
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, []);

  if (isLoading) return <main className="checkout-page"><p className="products-status">Loading order history...</p></main>;

  return (
    <main className="checkout-page">
      <section className="checkout-content" aria-labelledby="history-title">
        <Link className="back-link" to="/products">Back to products</Link>
        <p className="eyebrow">Past orders</p>
        <h1 id="history-title">Order history</h1>
        {error && <p className="products-error" role="alert">{error}</p>}
        {orders.length === 0 ? <p className="products-status">You have no completed orders yet.</p> : (
          <div className="order-history">
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-heading">
                  <h2>Order #{order.id}</h2>
                  <span className="order-status">{order.status}</span>
                </div>
                <p className="order-date">{new Date(order.time).toLocaleString()}</p>
                {order.items.map((item) => (
                  <p className="order-line" key={`${order.id}-${item.id}`}>
                    {item.name} x {item.quantity} <span>${Number(item.price).toFixed(2)}</span>
                  </p>
                ))}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default OrderHistory;