const express = require('express');
const session = require('express-session');
const pool = require('./db'); // Import the database connection
const passport = require('./passport'); // Import the configured passport instance
const app = express();
const port = 3000;
const bcrypt = require('bcrypt');
const swaggerDocument = require('./swagger/swagger.js');
const swaggerUi = require('swagger-ui-express');

require('dotenv').config();

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

// Swagger UI setup
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// LOGIN ENDPOINT
app.use(session({
    secret: process.env.SESSION_SECRET ,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 } // 1 hour
}))

// PASSPORT ===========================================
app.use(passport.initialize());
app.use(passport.session());

// LOGIN ENDPOINT
app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: info.message });
        req.logIn(user, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            return res.json({ 
                message: 'Login successful', 
                user: { id: user.id, email: user.email, customer_id: user.customer_id }
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
        user: { id: req.user}
    });
});

// EXIT
app.post('/api/logout', (req, res) => { 
    req.logout((err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Logged out successfully' });
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
            'SELECT * FROM "Order" WHERE customer_id = $1 ORDER BY time DESC',
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
        const result = await pool.query('SELECT * FROM "ORDERS" ORDER BY time DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить заказ по ID
app.get('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM "Order" WHERE id = $1', [id]);
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
            'INSERT INTO "Order" (customer_id, time) VALUES ($1, $2) RETURNING *',
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
            'UPDATE "Order" SET customer_id = $1, time = $2 WHERE id = $3 RETURNING *',
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
        const result = await pool.query('DELETE FROM "Order" WHERE id = $1 RETURNING *', [id]);
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
            'SELECT * FROM "Order" WHERE customer_id = $1 ORDER BY time DESC',
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
        const result = await pool.query('SELECT * FROM "Order" ORDER BY time DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить заказ по ID
app.get('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM "Order" WHERE id = $1', [id]);
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
            'INSERT INTO "Order" (customer_id, time) VALUES ($1, $2) RETURNING *',
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
            'UPDATE "Order" SET customer_id = $1, time = $2 WHERE id = $3 RETURNING *',
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
        const result = await pool.query('DELETE FROM "Order" WHERE id = $1 RETURNING *', [id]);
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
        const { email, password, name, address, contact } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
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
            [name || email, address || null, contact || email, null]
        );

        console.log('Customer created:', customerResult.rows[0]);

        // Пробуем только users (3 поля)
        const userResult = await pool.query(
            'INSERT INTO users (email, password, customer_id) VALUES ($1, $2, $3) RETURNING id, email, customer_id, created_at',
            [email, hashedPassword, customerResult.rows[0].id]
        );

        console.log('User created:', userResult.rows[0]);

        res.status(201).json({
            message: 'Регистрация успешна',
            user: userResult.rows[0]
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

app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});
