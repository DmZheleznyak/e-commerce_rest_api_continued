INSERT INTO product (id, name, price, quantity)
SELECT seed.id, seed.name, seed.price, seed.quantity
FROM (VALUES
    (1, 'Everyday Rope', 24.00, 18),
    (2, 'Harbor Tote', 42.00, 12),
    (3, 'Field Bottle', 28.00, 24),
    (4, 'Canvas Pouch', 18.00, 30)
) AS seed(id, name, price, quantity)
WHERE NOT EXISTS (SELECT 1 FROM product);
