const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const bcrypt = require('bcryptjs');
const pool = require('./db'); // Assuming you have a database connection module

const getOAuthEmail = (profile) => profile.emails?.[0]?.value?.toLowerCase() || null;

const ensureCustomerAccount = async (user) => {
    if (user.customer_id) {
        return user;
    }

    const customerResult = await pool.query(
        `INSERT INTO customers (name, address, contact, history_orders)
         VALUES ($1, '-', 0, NULL)
         RETURNING id`,
        [user.email]
    );
    const updatedUser = await pool.query(
        `UPDATE users
         SET customer_id = $1
         WHERE id = $2
         RETURNING *`,
        [customerResult.rows[0].id, user.id]
    );
    return updatedUser.rows[0];
};

const findOrCreateOAuthUser = async (provider, profile) => {
    const providerId = profile.id;
    const email = getOAuthEmail(profile);

    if (!email) {
        throw new Error(`No email address was provided by ${provider}`);
    }

    const providerUser = await pool.query(
        `SELECT users.*
         FROM users
         JOIN oauth_accounts ON oauth_accounts.user_id = users.id
         WHERE oauth_accounts.provider = $1 AND oauth_accounts.provider_id = $2`,
        [provider, providerId]
    );
    if (providerUser.rows.length > 0) {
        return ensureCustomerAccount(providerUser.rows[0]);
    }

    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
        await pool.query(
            'INSERT INTO oauth_accounts (user_id, provider, provider_id) VALUES ($1, $2, $3)',
            [existingUser.rows[0].id, provider, providerId]
        );
        return ensureCustomerAccount(existingUser.rows[0]);
    }

    const customerResult = await pool.query(
        `INSERT INTO customers (name, address, contact, history_orders)
         VALUES ($1, '-', 0, NULL)
         RETURNING id`,
        [email]
    );
    const newUser = await pool.query(
        `INSERT INTO users (email, password, customer_id)
         VALUES ($1, NULL, $2)
         RETURNING *`,
        [email, customerResult.rows[0].id]
    );
    await pool.query(
        'INSERT INTO oauth_accounts (user_id, provider, provider_id) VALUES ($1, $2, $3)',
        [newUser.rows[0].id, provider, providerId]
    );
    return newUser.rows[0];
};

passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, async (email, password, done) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return done(null, false, { message: 'Invalid email or password' });
        }
        const user = result.rows[0];
        if (!user.password) {
            return done(null, false, { message: 'Invalid email or password' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return done(null, false, { message: 'Invalid email or password' });
        }
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            done(null, await findOrCreateOAuthUser('google', profile));
        } catch (err) {
            done(err);
        }
    }));
}

if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3000/api/auth/facebook/callback',
        profileFields: ['id', 'displayName', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            done(null, await findOrCreateOAuthUser('facebook', profile));
        } catch (err) {
            done(err);
        }
    }));
}

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        done(null, result.rows[0]);
    } catch (err) {
        done(err);
    }
});

module.exports = passport;