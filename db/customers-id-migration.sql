CREATE SEQUENCE IF NOT EXISTS customers_id_seq;

SELECT setval(
    'customers_id_seq',
    COALESCE((SELECT MAX(id) FROM customers), 0) + 1,
    false
);

ALTER TABLE customers
    ALTER COLUMN id SET DEFAULT nextval('customers_id_seq');

ALTER SEQUENCE customers_id_seq OWNED BY customers.id;
