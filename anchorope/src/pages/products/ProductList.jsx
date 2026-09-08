import { useEffect, useState } from 'react';
import Product from './product/Product';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/products', { credentials: 'include' });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Unable to load products.');
        }

        setProducts(Array.isArray(result) ? result : []);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load products.');
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, []);

  if (isLoading) {
    return <p className="products-status">Loading products...</p>;
  }

  if (error) {
    return <p className="products-status products-error" role="alert">{error}</p>;
  }

  if (products.length === 0) {
    return <p className="products-status">No products are available yet.</p>;
  }

  return (
    <div className="product-grid">
      {products.map((product) => <Product key={product.id} product={product} />)}
    </div>
  );
};

export default ProductList;