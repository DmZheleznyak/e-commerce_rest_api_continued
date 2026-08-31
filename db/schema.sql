    CREATE TABLE PAYMENTS (
    id INT PRIMARY KEY,
    method VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    value DECIMAL(10, 2)
    );

    CREATE TABLE CUSTOMERS
    (
    id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(100) NOT NULL NOT NULL,
    contact INT NOT NULL,
    history_orders TEXT
    );

    CREATE TABLE PRODUCT
    (
    id INT PRIMARY KEY ,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL
    );

    CREATE TABLE ORDERS
    (
    id INT PRIMARY KEY, 
    customer_id INT NOT NULL,
    time TIMESTAMP NOT NULL,
    CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES CUSTOMERS(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
    );

    CREATE TABLE ORDER_INFO
    (
    id_order INT PRIMARY KEY,
    price DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) DEFAULT 0,
    quantity INT NOT NULL DEFAULT 1,
    Id INT NOT NULL,
    CONSTRAINT fk_order_info FOREIGN KEY (id_order) REFERENCES ORDERS(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
    );


    CREATE TABLE STORE
    (
    id INT PRIMARY KEY,
    address VARCHAR(500),
    name VARCHAR(500) NOT NULL
    );

    CREATE TABLE USERS (
	id INT PRIMARY KEY,
	email VARCHAR(255) UNIQUE NOT NULL,
	password VARCHAR(255) NOT NULL,
	customer_id INT UNIQUE,
	created_at TIMESTAMP DEFAULT NOW(),
	CONSTRAINT fk_user_customer
		FOREIGN KEY (customer_id)
		REFERENCES customers(id)
		ON DELETE SET NULL
    );