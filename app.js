 const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
require('dotenv').config();
const pool = require('./db'); // Import the database connection
const passport = require('./passport'); // Import the configured passport instance
const app = express();
const bcrypt = require('bcryptjs');
const Stripe = require('stripe');
const swaggerDocument = require('./swagger/swagger.js');
const swaggerUi = require('swagger-ui-express');
const sessionSecret = process.env.SESSION_SECRET || 'development-session-secret';
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// async function testConnection() {
//   const { rows } = await pool.query('SELECT current_database()');
//   console.log(rows);
//   async function test() {
//     try {
//         // Простой запрос, который работает даже на пустой базе
//         const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
        
//         console.log('✅ Подключение успешно!');
//         console.log('Текущее время БД:', result.rows[0].current_time);
//         console.log('Версия PostgreSQL:', result.rows[0].pg_version);
        
//     } catch (err) {
//         console.error('❌ Ошибка подключения:', err.message);
//     } finally {
//         await pool.end(); // Закрываем соединение
//   // pool.end()
//     }
//   };
//   test();
// };

// testConnection();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const clientUrl = process.env.CLIENT_URL || 'http://localhost:3001';

app.use(cors({
    origin: clientUrl,
    credentials: true
}));

// Swagger UI setup
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// LOGIN ENDPOINT
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 1000
    }
}));

// PASSPORT ===========================================
app.use(passport.initialize());
app.use(passport.session());

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// LOGIN ENDPOINT
app.post('/api/login', (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    passport.authenticate('local', (err, user, info) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: info?.message || 'Invalid email or password' });
        req.logIn(user, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            req.session.save((saveError) => {
                if (saveError) return res.status(500).json({ error: saveError.message });
                return res.json({
                    message: 'Login successful',
                    user: { id: user.id, email: user.email, customer_id: user.customer_id }
                });
            });
        });
    })(req, res, next);
});

const redirectToLoginWithError = (res, message) => {
    res.redirect(`${clientUrl}/login?error=${encodeURIComponent(message)}`);
};

app.get('/api/auth/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return redirectToLoginWithError(res, 'Google login is not configured');
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/api/auth/google/callback', (req, res, next) => {
    passport.authenticate('google', (err, user) => {
        if (err || !user) {
            return redirectToLoginWithError(res, err?.message || 'Google login failed');
        }
        req.logIn(user, (loginError) => {
            if (loginError) return next(loginError);
            req.session.save((saveError) => {
                if (saveError) return next(saveError);
                res.redirect(`${clientUrl}/auth/callback?provider=google`);
            });
        });
    })(req, res, next);
});

app.get('/api/auth/facebook', (req, res, next) => {
    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
        return redirectToLoginWithError(res, 'Facebook login is not configured');
    }
    passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
});

app.get('/api/auth/facebook/callback', (req, res, next) => {
    passport.authenticate('facebook', (err, user) => {
        if (err || !user) {
            return redirectToLoginWithError(res, err?.message || 'Facebook login failed');
        }
        req.logIn(user, (loginError) => {
            if (loginError) return next(loginError);
            req.session.save((saveError) => {
                if (saveError) return next(saveError);
                res.redirect(`${clientUrl}/auth/callback?provider=facebook`);
            });
        });
    })(req, res, next);
});

// ME
app.get('/api/me', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({
        user: {
            id: req.user.id,
            email: req.user.email,
            customer_id: req.user.customer_id
        }
    });
});

const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

const requireCustomer = (req, res, next) => {
    if (!req.user.customer_id) {
        return res.status(400).json({ error: 'The current user does not have a customer account.' });
    }

    req.customerId = req.user.customer_id;
    next();
};

// EXIT
app.post('/api/logout', (req, res) => { 
    req.logout((logoutError) => {
        if (logoutError) return res.status(500).json({ error: logoutError.message });
        req.session.destroy((destroyError) => {
            if (destroyError) return res.status(500).json({ error: destroyError.message });
            res.clearCookie('connect.sid');
            res.json({ message: 'Logged out successfully' });
        });
    })
});

// =============================================
// CUSTOMERS
// =============================================

// Получить всех клиентов
app.get('/api/customers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM customers ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить клиента по ID
app.get('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Создать клиента
app.post('/api/customers', async (req, res) => {
    try {
        const { name, address, contact, history_orders } = req.body;
        const result = await pool.query(
            'INSERT INTO customers (name, address, contact, history_orders) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, address, contact, history_orders]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновить клиента
app.put('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, contact, history_orders } = req.body;
        const result = await pool.query(
            'UPDATE customers SET name = $1, address = $2, contact = $3, history_orders = $4 WHERE id = $5 RETURNING *',
            [name, address, contact, history_orders, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удалить клиента
app.delete('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }
        res.json({ message: 'Клиент удалён', deleted: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить заказы клиента
app.get('/api/customers/:id/orders', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM orders WHERE customer_id = $1 ORDER BY time DESC',
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// ORDERS
// =============================================

// Получить все заказы
app.get('/api/orders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY time DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Return only completed orders for the current customer.
app.get('/api/orders/history', requireAuth, requireCustomer, async (req, res) => {
    try {
        const result = await pool.query(
                `SELECT orders.id AS order_id, orders.time, 'completed' AS status,
                    order_info.order_info_id,
                    order_info.product_id, order_info.price, order_info.discount,
                    order_info.quantity, product.name
             FROM orders
             JOIN order_info ON order_info.order_id = orders.id
             JOIN product ON product.id = order_info.product_id
             WHERE orders.customer_id = $1
             ORDER BY orders.time DESC, order_info.order_info_id`,
            [req.customerId]
        );

        const orders = result.rows.reduce((history, row) => {
            let order = history.find((item) => item.id === row.order_id);
            if (!order) {
                order = { id: row.order_id, time: row.time, status: row.status, items: [] };
                history.push(order);
            }
            order.items.push({
                id: row.product_id,
                name: row.name,
                price: row.price,
                discount: row.discount,
                quantity: row.quantity
            });
            return history;
        }, []);
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить заказ по ID
app.get('/api/orders/:id', requireAuth, requireCustomer, async (req, res) => {
    try {
        const { id } = req.params;
        if (!/^\d+$/.test(id)) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        const result = await pool.query(
            'SELECT * FROM orders WHERE id = $1 AND customer_id = $2',
            [id, req.customerId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Создать заказ
app.post('/api/orders', async (req, res) => {
    try {
        const { customer_id, time } = req.body;
        const result = await pool.query(
            'INSERT INTO orders (customer_id, time) VALUES ($1, $2) RETURNING *',
            [customer_id, time]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновить заказ
app.put('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { customer_id, time } = req.body;
        const result = await pool.query(
            'UPDATE orders SET customer_id = $1, time = $2 WHERE id = $3 RETURNING *',
            [customer_id, time, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удалить заказ
app.delete('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        res.json({ message: 'Заказ удалён', deleted: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// PRODUCTS
// =============================================

// Get the current customer's active cart.
app.get('/api/cart', requireAuth, requireCustomer, async (req, res) => {
    try {
        const result = await pool.query(
                `SELECT c.id AS cart_id, c.status, ci.product_id, ci.quantity AS cart_quantity,
                    p.*
             FROM shopping_cart c
             LEFT JOIN shopping_cart_item ci ON ci.cart_id = c.id
             LEFT JOIN product p ON p.id = ci.product_id
             WHERE c.customer_id = $1 AND c.status = 'active'
             ORDER BY ci.id`,
            [req.customerId]
        );

        const firstRow = result.rows[0];
        res.json({
            id: firstRow?.cart_id || null,
            status: 'active',
            items: result.rows.filter((row) => row.product_id !== null).map((row) => ({
                id: row.product_id,
                name: row.name,
                price: row.price,
                description: row.description,
                image: row.image,
                image_url: row.image_url,
                quantity: row.cart_quantity,
                available_quantity: row.cart_quantity + row.quantity
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add an item to the current customer's active cart.
app.post('/api/cart/items', requireAuth, requireCustomer, async (req, res) => {
    const productId = Number(req.body.product_id);
    const requestedQuantity = Number(req.body.quantity || 1);
    if (!Number.isInteger(productId) || !Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
        return res.status(400).json({ error: 'product_id and a positive integer quantity are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const productResult = await client.query('SELECT * FROM product WHERE id = $1 FOR UPDATE', [productId]);
        if (productResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Product not found.' });
        }

        const product = productResult.rows[0];
        if (product.quantity < requestedQuantity) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Not enough product stock.' });
        }

        const cartResult = await client.query(
            `INSERT INTO shopping_cart (customer_id, status)
             VALUES ($1, 'active')
             ON CONFLICT (customer_id) WHERE status = 'active' DO UPDATE SET customer_id = EXCLUDED.customer_id
             RETURNING id`,
            [req.customerId]
        );
        const cartId = cartResult.rows[0].id;
        const existingItemResult = await client.query(
            `SELECT quantity FROM shopping_cart_item
             WHERE cart_id = $1 AND product_id = $2
             FOR UPDATE`,
            [cartId, productId]
        );
        const currentCartQuantity = existingItemResult.rows[0]?.quantity || 0;
        const newCartQuantity = currentCartQuantity + requestedQuantity;
        const itemResult = await client.query(
            existingItemResult.rows.length === 0
                ? `INSERT INTO shopping_cart_item (cart_id, product_id, quantity)
                   VALUES ($1, $2, $3::integer)
                   RETURNING product_id, quantity`
                : `UPDATE shopping_cart_item
                   SET quantity = $3::integer
                   WHERE cart_id = $1 AND product_id = $2
                   RETURNING product_id, quantity`,
            [cartId, productId, newCartQuantity]
        );
        const stockResult = await client.query(
            `UPDATE product
             SET quantity = quantity - $1::integer
             WHERE id = $2
             RETURNING quantity`,
            [requestedQuantity, productId]
        );
        await client.query('COMMIT');
        res.status(201).json({
            ...product,
            quantity: stockResult.rows[0].quantity,
            cart_quantity: itemResult.rows[0].quantity
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Remove an item from the current customer's active cart.
app.delete('/api/cart/items/:productId', requireAuth, requireCustomer, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const itemResult = await client.query(
            `SELECT item.cart_id, item.product_id, item.quantity
             FROM shopping_cart_item item
             JOIN shopping_cart cart ON cart.id = item.cart_id
             WHERE cart.customer_id = $1 AND cart.status = 'active'
               AND item.product_id = $2
             FOR UPDATE`,
            [req.customerId, req.params.productId]
        );
        if (itemResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Product is not in the active cart.' });
        }
        const item = itemResult.rows[0];
        await client.query(
            `DELETE FROM shopping_cart_item
             WHERE cart_id = $1 AND product_id = $2`,
            [item.cart_id, item.product_id]
        );
        await client.query(
            `UPDATE product
             SET quantity = quantity + $1::integer
             WHERE id = $2`,
            [item.quantity, item.product_id]
        );
        await client.query('COMMIT');
        res.json({ message: 'Product removed from cart.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Set the quantity for an item in the current customer's active cart.
app.put('/api/cart/items/:productId', requireAuth, requireCustomer, async (req, res) => {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ error: 'quantity must be a positive integer.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const itemResult = await client.query(
            `SELECT item.cart_id, item.product_id, item.quantity, product.quantity AS stock
             FROM shopping_cart_item item
             JOIN shopping_cart cart ON cart.id = item.cart_id
             JOIN product ON product.id = item.product_id
             WHERE cart.customer_id = $1 AND cart.status = 'active'
               AND item.product_id = $2
             FOR UPDATE OF item, product`,
            [req.customerId, req.params.productId]
        );
        if (itemResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Product is not in the active cart.' });
        }
        const item = itemResult.rows[0];
        const quantityDelta = quantity - item.quantity;
        if (quantityDelta > item.stock) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Not enough product stock.' });
        }
        const result = await client.query(
            `UPDATE shopping_cart_item
             SET quantity = $1::integer
             WHERE cart_id = $2 AND product_id = $3
             RETURNING product_id, quantity`,
            [quantity, item.cart_id, item.product_id]
        );
        await client.query(
            `UPDATE product
             SET quantity = quantity - $1::integer
             WHERE id = $2`,
            [quantityDelta, item.product_id]
        );
        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Convert the active cart into one order with one order_info row per product.
app.post('/api/payments/create-intent', requireAuth, requireCustomer, async (req, res) => {
    if (!stripe) {
        return res.status(503).json({ error: 'Stripe is not configured on the server.' });
    }

    try {
        const result = await pool.query(
            `SELECT cart.id AS cart_id,
                    COALESCE(SUM(item.quantity * product.price), 0) AS total
             FROM shopping_cart cart
             JOIN shopping_cart_item item ON item.cart_id = cart.id
             JOIN product ON product.id = item.product_id
             WHERE cart.customer_id = $1 AND cart.status = 'active'
             GROUP BY cart.id`,
            [req.customerId]
        );
        if (result.rows.length === 0 || Number(result.rows[0].total) <= 0) {
            return res.status(400).json({ error: 'The active cart is empty.' });
        }

        const cart = result.rows[0];
        const amount = Math.round(Number(cart.total) * 100);
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
            metadata: {
                customer_id: String(req.customerId),
                cart_id: String(cart.cart_id)
            }
        });

        res.json({ clientSecret: paymentIntent.client_secret, amount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/cart/checkout', requireAuth, requireCustomer, async (req, res) => {
    if (!stripe) {
        return res.status(503).json({ error: 'Stripe is not configured on the server.' });
    }

    const paymentIntentId = req.body.payment_intent_id;
    if (!paymentIntentId) {
        return res.status(400).json({ error: 'A successful Stripe payment is required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const cartResult = await client.query(
            `SELECT cart.id AS cart_id, item.product_id, item.quantity, product.price, product.quantity AS stock
             FROM shopping_cart cart
             JOIN shopping_cart_item item ON item.cart_id = cart.id
             JOIN product ON product.id = item.product_id
             WHERE cart.customer_id = $1 AND cart.status = 'active'
             FOR UPDATE OF cart, item, product`,
            [req.customerId]
        );
        if (cartResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'The active cart is empty.' });
        }

        const expectedAmount = Math.round(cartResult.rows.reduce(
            (sum, item) => sum + Number(item.price) * Number(item.quantity),
            0
        ) * 100);
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded'
            || paymentIntent.amount !== expectedAmount
            || paymentIntent.metadata.customer_id !== String(req.customerId)) {
            await client.query('ROLLBACK');
            return res.status(402).json({ error: 'Stripe payment was not completed for this cart.' });
        }

        const cartId = cartResult.rows[0].cart_id;
        const orderResult = await client.query(
            `INSERT INTO orders (customer_id, time) VALUES ($1, NOW()) RETURNING id, customer_id, time`,
            [req.customerId]
        );
        const order = orderResult.rows[0];

        for (const item of cartResult.rows) {
            await client.query(
                `INSERT INTO order_info (order_id, product_id, price, discount, quantity)
                 VALUES ($1, $2, $3, 0, $4)`,
                [order.id, item.product_id, item.price, item.quantity]
            );
        }
        await client.query(
            `UPDATE shopping_cart SET status = 'completed', completed_at = NOW() WHERE id = $1`,
            [cartId]
        );
        await client.query('COMMIT');
        res.status(201).json({ order });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Получить все товары
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM product ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить товар по ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM product WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Создать товар
app.post('/api/products', async (req, res) => {
    try {
        const { name, price, quantity } = req.body;
        const result = await pool.query(
            'INSERT INTO product (name, price, quantity) VALUES ($1, $2, $3) RETURNING *',
            [name, price, quantity]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновить товар
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, quantity } = req.body;
        const result = await pool.query(
            'UPDATE product SET name = $1, price = $2, quantity = $3 WHERE id = $4 RETURNING *',
            [name, price, quantity, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удалить товар
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM product WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        res.json({ message: 'Товар удалён', deleted: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// STORES
// // Получить все магазины
app.get('/api/stores', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM Store ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить магазин по ID
app.get('/api/stores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM Store WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Магазин не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Создать магазин
app.post('/api/stores', async (req, res) => {
    try {
        const { name, address } = req.body;
        const result = await pool.query(
            'INSERT INTO Store (name, address) VALUES ($1, $2) RETURNING *',
            [name, address]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновить магазин
app.put('/api/stores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address } = req.body;
        const result = await pool.query(
            'UPDATE Store SET name = $1, address = $2 WHERE id = $3 RETURNING *',
            [name, address, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Магазин не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удалить магазин
app.delete('/api/stores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM Store WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Магазин не найден' });
        }
        res.json({ message: 'Магазин удалён', deleted: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// PAYMENTS
// =============================================

// Получить все платежи
app.get('/api/payments', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payments ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить платёж по ID
app.get('/api/payments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Платёж не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Создать платёж
app.post('/api/payments', async (req, res) => {
    try {
        const { method, amount, value } = req.body;
        const result = await pool.query(
            'INSERT INTO payments (method, amount, value) VALUES ($1, $2, $3) RETURNING *',
            [method, amount, value]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновить платёж
app.put('/api/payments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { method, amount, value } = req.body;
        const result = await pool.query(
            'UPDATE payments SET method = $1, amount = $2, value = $3 WHERE id = $4 RETURNING *',
            [method, amount, value, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Платёж не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Удалить платёж
app.delete('/api/payments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM payments WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Платёж не найден' });
        }
        res.json({ message: 'Платёж удалён', deleted: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// ORDER INFO
// =============================================

// Получить всю информацию о заказах
app.get('/api/order-info', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM order_info ORDER BY id_order');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить информацию о конкретном заказе
app.get('/api/order-info/:id_order', async (req, res) => {
    try {
        const { id_order } = req.params;
        const result = await pool.query('SELECT * FROM order_info WHERE id_order = $1', [id_order]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Информация о заказе не найдена' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Создать информацию о заказе
app.post('/api/order-info', async (req, res) => {
    try {
        const { id_order, price, discount, quantity } = req.body;
        const result = await pool.query(
            'INSERT INTO order_info (id_order, price, discount, quantity) VALUES ($1, $2, $3, $4) RETURNING *',
            [id_order, price, discount, quantity]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновить информацию о заказе
app.put('/api/order-info/:id_order', async (req, res) => {
    try {
        const { id_order } = req.params;
        const { price, discount, quantity } = req.body;
        const result = await pool.query(
            'UPDATE order_info SET price = $1, discount = $2, quantity = $3 WHERE id_order = $4 RETURNING *',
            [price, discount, quantity, id_order]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Информация о заказе не найдена' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удалить информацию о заказе
app.delete('/api/order-info/:id_order', async (req, res) => {
    try {
        const { id_order } = req.params;
        const result = await pool.query('DELETE FROM order_info WHERE id_order = $1 RETURNING *', [id_order]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Информация о заказе не найдена' });
        }
        res.json({ message: 'Информация о заказе удалена', deleted: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// =============================================
// CUSTOMERS
// =============================================

// Получить всех клиентов
app.get('/api/customers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM customers ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить клиента по ID
app.get('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Создать клиента
app.post('/api/customers', async (req, res) => {
    try {
        const { name, address, contact, history_orders } = req.body;
        const result = await pool.query(
            'INSERT INTO customers (name, address, contact, history_orders) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, address, contact, history_orders]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновить клиента
app.put('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, contact, history_orders } = req.body;
        const result = await pool.query(
            'UPDATE customers SET name = $1, address = $2, contact = $3, history_orders = $4 WHERE id = $5 RETURNING *',
            [name, address, contact, history_orders, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удалить клиента
app.delete('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }
        res.json({ message: 'Клиент удалён', deleted: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить заказы клиента
app.get('/api/customers/:id/orders', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM orders WHERE customer_id = $1 ORDER BY time DESC',
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// ORDERS
// =============================================

// Получить все заказы
app.get('/api/orders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY time DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить заказ по ID
app.get('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { customer_id, time } = req.body;
        const result = await pool.query(
            'INSERT INTO orders (customer_id, time) VALUES ($1, $2) RETURNING *',
            [customer_id, time]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновить заказ
app.put('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { customer_id, time } = req.body;
        const result = await pool.query(
            'UPDATE orders SET customer_id = $1, time = $2 WHERE id = $3 RETURNING *',
            [customer_id, time, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удалить заказ
app.delete('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        res.json({ message: 'Заказ удалён', deleted: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// PRODUCTS
// =============================================

// Получить все товары
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM product ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить товар по ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM product WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Создать товар
app.post('/api/products', async (req, res) => {
    try {
        const { name, price, quantity } = req.body;
        const result = await pool.query(
            'INSERT INTO product (name, price, quantity) VALUES ($1, $2, $3) RETURNING *',
            [name, price, quantity]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновить товар
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, quantity } = req.body;
        const result = await pool.query(
            'UPDATE product SET name = $1, price = $2, quantity = $3 WHERE id = $4 RETURNING *',
            [name, price, quantity, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удалить товар
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM product WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        res.json({ message: 'Товар удалён', deleted: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// STORES
// =============================================

app.get('/api/stores', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM Store ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить магазин по ID
app.get('/api/stores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM Store WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Магазин не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Создать магазин
app.post('/api/stores', async (req, res) => {
    try {
        const { name, address } = req.body;
        const result = await pool.query(
            'INSERT INTO Store (name, address) VALUES ($1, $2) RETURNING *',
            [name, address]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновить магазин
app.put('/api/stores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address } = req.body;
        const result = await pool.query(
            'UPDATE Store SET name = $1, address = $2 WHERE id = $3 RETURNING *',
            [name, address, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Магазин не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удалить магазин
app.delete('/api/stores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM Store WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Магазин не найден' });
        }
        res.json({ message: 'Магазин удалён', deleted: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// PAYMENTS
// =============================================

// Получить все платежи
app.get('/api/payments', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payments ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить платёж по ID
app.get('/api/payments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Платёж не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Создать платёж
app.post('/api/payments', async (req, res) => {
    try {
        const { method, amount, value } = req.body;
        const result = await pool.query(
            'INSERT INTO payments (method, amount, value) VALUES ($1, $2, $3) RETURNING *',
            [method, amount, value]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновить платёж
app.put('/api/payments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { method, amount, value } = req.body;
        const result = await pool.query(
            'UPDATE payments SET method = $1, amount = $2, value = $3 WHERE id = $4 RETURNING *',
            [method, amount, value, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Платёж не найден' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/payments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM payments WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Платёж не найден' });
        }
        res.json({ message: 'Платёж удалён', deleted: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// ORDER INFO
// =============================================

// Получить всю информацию о заказах
app.get('/api/order-info', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM order_info ORDER BY id_order');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить информацию о конкретном заказе
app.get('/api/order-info/:id_order', async (req, res) => {
    try {
        const { id_order } = req.params;
        const result = await pool.query('SELECT * FROM order_info WHERE id_order = $1', [id_order]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Информация о заказе не найдена' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Создать информацию о заказе
app.post('/api/order-info', async (req, res) => {
    try {
        const { id_order, price, discount, quantity } = req.body;
        const result = await pool.query(
            'INSERT INTO order_info (id_order, price, discount, quantity) VALUES ($1, $2, $3, $4) RETURNING *',
            [id_order, price, discount, quantity]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновить информацию о заказе
app.put('/api/order-info/:id_order', async (req, res) => {
    try {
        const { id_order } = req.params;
        const { price, discount, quantity } = req.body;
        const result = await pool.query(
            'UPDATE order_info SET price = $1, discount = $2, quantity = $3 WHERE id_order = $4 RETURNING *',
            [price, discount, quantity, id_order]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Информация о заказе не найдена' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удалить информацию о заказе
app.delete('/api/order-info/:id_order', async (req, res) => {
    try {
        const { id_order } = req.params;
        const result = await pool.query('DELETE FROM order_info WHERE id_order = $1 RETURNING *', [id_order]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Информация о заказе не найдена' });
        }
        res.json({ message: 'Информация о заказе удалена', deleted: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// REGISTRATION ENDPOINT
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, name, contact } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
        }

        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Пробуем только customers (4 поля)
        const customerResult = await pool.query(
            'INSERT INTO customers (name, address, contact, history_orders) VALUES ($1, $2, $3, $4) RETURNING id',
            [name || email, '-', contact || email, null]
        );

        console.log('Customer created:', customerResult.rows[0]);

        // Пробуем только users (3 поля)
        const userResult = await pool.query(
            'INSERT INTO users (email, password, customer_id) VALUES ($1, $2, $3) RETURNING id, email, customer_id, created_at',
            [email, hashedPassword, customerResult.rows[0].id]
        );

        console.log('User created:', userResult.rows[0]);

        req.logIn(userResult.rows[0], (loginError) => {
            if (loginError) {
                return res.status(500).json({ error: loginError.message });
            }

            req.session.save((saveError) => {
                if (saveError) {
                    return res.status(500).json({ error: saveError.message });
                }

                res.status(201).json({
                    message: 'Регистрация успешна',
                    user: userResult.rows[0]
                });
            });
        });

    } catch (err) {
        console.error('Ошибка:', err.message);
        console.error('Детали:', {
            severity: err.severity,
            code: err.code,
            routine: err.routine
        });
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// ЗАПУСК СЕРВЕРА
// =============================================

const frontendBuildPath = path.join(__dirname, 'anchorope', 'build');
app.use(express.static(frontendBuildPath));
app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});
