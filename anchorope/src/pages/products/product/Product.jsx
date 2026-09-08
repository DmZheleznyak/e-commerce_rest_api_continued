import { Link } from 'react-router';

const fallbackImage = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80';

const Product = ({ product }) => {
  const description = product.description || 'A considered addition to your everyday collection.';
  const image = product.image || product.image_url || fallbackImage;
  const price = Number(product.price);

  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <img className="product-image" src={image} alt={product.name} />
      </div>
      <div className="product-content">
        <div className="product-heading">
          <h2>{product.name}</h2>
          <p className="product-price">
            {Number.isFinite(price) ? `$${price.toFixed(2)}` : product.price}
          </p>
        </div>
        <p className="product-description">{description}</p>
        <p className="product-stock">
          {product.quantity > 0 ? `${product.quantity} available` : 'Currently unavailable'}
        </p>
        <Link className="product-details-link" to={`/products/${product.id}`}>
          More information
        </Link>
      </div>
    </article>
  );
};

export default Product;