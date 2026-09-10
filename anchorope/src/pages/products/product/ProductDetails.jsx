import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { fetchWithAuth } from '../../../api';

const fallbackImage = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80';

const ProductDetails = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isInCart, setIsInCart] = useState(false);
  const [isCartUpdating, setIsCartUpdating] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isReviewSaving, setIsReviewSaving] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const response = await fetch(`/api/products/${id}`, { credentials: 'include' });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Unable to load this product.');
        }

        setProduct(result);

        const reviewsResponse = await fetch(`/api/products/${id}/reviews`, { credentials: 'include' });
        if (reviewsResponse.ok) {
          setReviews(await reviewsResponse.json());
        }

        const cartResponse = await fetchWithAuth('/api/cart');
        if (cartResponse.ok) {
          const cart = await cartResponse.json();
          setIsInCart(cart.items.some((item) => String(item.id) === String(result.id)));
        }
      } catch (loadError) {
        setError(loadError.message || 'Unable to load this product.');
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  const handleAddToCart = () => {
    const updateCart = async () => {
      setIsCartUpdating(true);
      setError('');
      try {
        const response = await fetchWithAuth('/api/cart/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ product_id: product.id, quantity: 1 })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to update your cart.');
        setIsInCart(true);
        setProduct((currentProduct) => ({ ...currentProduct, quantity: result.quantity }));
      } catch (cartError) {
        setError(cartError.message || 'Unable to update your cart.');
      } finally {
        setIsCartUpdating(false);
      }
    };

    updateCart();
  };

  if (isLoading) {
    return <main className="product-details-page"><p className="products-status">Loading product...</p></main>;
  }

  if (error || !product) {
    return (
      <main className="product-details-page">
        <p className="products-status products-error" role="alert">{error || 'Product not found.'}</p>
        <Link className="back-link" to="/products">Back to products</Link>
      </main>
    );
  }

  const image = product.image || product.image_url || fallbackImage;
  const price = Number(product.price);
  const description = product.description || 'No description is available for this product yet.';
  const isOutOfStock = product.quantity <= 0;
  const submitReview = async (event) => {
    event.preventDefault();
    setIsReviewSaving(true);
    setError('');
    try {
      const response = await fetchWithAuth(`/api/products/${id}/reviews`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: reviewRating, review: reviewText })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save your review.');
      setReviews((currentReviews) => [result, ...currentReviews.filter((review) => review.customer_id !== result.customer_id)]);
      const productResponse = await fetch(`/api/products/${id}`, { credentials: 'include' });
      if (productResponse.ok) setProduct(await productResponse.json());
      setReviewText('');
    } catch (reviewError) {
      setError(reviewError.message || 'Unable to save your review.');
    } finally {
      setIsReviewSaving(false);
    }
  };

  return (
    <main className="product-details-page">
      <div className="product-details-wrap">
        <Link className="back-link" to="/products">Back to products</Link>
        <article className="product-details-card">
          <div className="product-details-image-wrap">
            <img className="product-details-image" src={image} alt={product.name} />
          </div>
          <div className="product-details-content">
            <p className="eyebrow">Product details</p>
            <h1>{product.name}</h1>
            <p className="product-details-price">
              {Number.isFinite(price) ? `$${price.toFixed(2)}` : product.price}
            </p>
            <p className="product-details-description">{description}</p>
            <p className="product-stock">
              {isOutOfStock ? 'Currently unavailable' : `${product.quantity} available`}
            </p>
            <button className="submit-button product-cart-button" type="button" onClick={handleAddToCart} disabled={isOutOfStock || isCartUpdating}>
              {isCartUpdating ? 'Updating cart...' : isInCart ? 'Add another' : 'Add to cart'}
            </button>
            {error && <p className="products-error" role="alert">{error}</p>}
            {isInCart && <p className="cart-confirmation" role="status">This item is in your active cart.</p>}
          </div>
        </article>
        <section className="reviews-section" aria-labelledby="reviews-title">
          <div className="reviews-heading">
            <div>
              <p className="eyebrow">Customer notes</p>
              <h2 id="reviews-title">Reviews</h2>
            </div>
            <p className="product-rating">{product.review_count ? `${product.review_average} / 5 from ${product.review_count} reviews` : 'No reviews yet'}</p>
          </div>
          <form className="review-form" onSubmit={submitReview}>
            <label htmlFor="review-rating">Rating</label>
            <select id="review-rating" value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>
              {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
            </select>
            <label htmlFor="review-text">Your review</label>
            <textarea id="review-text" value={reviewText} onChange={(event) => setReviewText(event.target.value)} maxLength="2000" required rows="4" placeholder="What did you think?" />
            <button className="submit-button" type="submit" disabled={isReviewSaving}>{isReviewSaving ? 'Saving review...' : 'Save review'}</button>
          </form>
          <div className="reviews-list">
            {reviews.length === 0 ? <p className="products-status">Be the first to share a note.</p> : reviews.map((review) => (
              <article className="review-item" key={review.id}>
                <div className="review-item-heading"><strong>{review.customer_name || 'Customer'}</strong><span>{review.rating} / 5</span></div>
                <p>{review.review}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

export default ProductDetails;