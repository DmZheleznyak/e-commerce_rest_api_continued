CREATE SEQUENCE IF NOT EXISTS product_id_seq;

SELECT setval(
    'product_id_seq',
    COALESCE((SELECT MAX(id) FROM product), 0) + 1,
    false
);

ALTER TABLE product
    ALTER COLUMN id SET DEFAULT nextval('product_id_seq');

ALTER SEQUENCE product_id_seq OWNED BY product.id;
