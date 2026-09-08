CREATE SEQUENCE IF NOT EXISTS orders_id_seq;

SELECT setval(
    'orders_id_seq',
    COALESCE((SELECT MAX(id) FROM orders), 0) + 1,
    false
);

ALTER TABLE orders
    ALTER COLUMN id SET DEFAULT nextval('orders_id_seq');

ALTER SEQUENCE orders_id_seq OWNED BY orders.id;