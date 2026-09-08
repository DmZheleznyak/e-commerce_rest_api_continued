CREATE TABLE IF NOT EXISTS shopping_cart (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS shopping_cart_one_active_per_customer
    ON shopping_cart (customer_id)
    WHERE status = 'active';

CREATE TABLE IF NOT EXISTS shopping_cart_item (
    id SERIAL PRIMARY KEY,
    cart_id INT NOT NULL REFERENCES shopping_cart(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    UNIQUE (cart_id, product_id)
);

-- Make order_info a true line-item table: one order can contain many products.
ALTER TABLE order_info ADD COLUMN IF NOT EXISTS order_info_id BIGSERIAL;
ALTER TABLE order_info ADD COLUMN IF NOT EXISTS order_id INT;
ALTER TABLE order_info ADD COLUMN IF NOT EXISTS product_id INT;
UPDATE order_info SET order_id = id_order WHERE order_id IS NULL;
UPDATE order_info SET product_id = id WHERE product_id IS NULL;
ALTER TABLE order_info ALTER COLUMN order_info_id SET NOT NULL;
ALTER TABLE order_info ALTER COLUMN order_id SET NOT NULL;
ALTER TABLE order_info ALTER COLUMN product_id SET NOT NULL;
ALTER TABLE order_info ALTER COLUMN id_order DROP NOT NULL;
ALTER TABLE order_info ALTER COLUMN id DROP NOT NULL;
ALTER TABLE order_info DROP CONSTRAINT IF EXISTS order_info_pkey;
ALTER TABLE order_info ADD CONSTRAINT order_info_pkey PRIMARY KEY (order_info_id);
ALTER TABLE order_info ADD CONSTRAINT order_info_order_fk
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE order_info ADD CONSTRAINT order_info_product_fk
    FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE RESTRICT;