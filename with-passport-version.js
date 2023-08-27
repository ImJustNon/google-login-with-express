require("dotenv").config();
const express = require('express');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const axios = require('axios');
const http = require("http");
const morgan = require("morgan");

const app = express();
const server = http.createServer(app);
const port = process.env.PORT;

// setup mongodb session
const mongoDBStore = new MongoDBStore({
    uri: process.env.MONGO_URI,
    collection: 'test-google-login-session',
});
mongoDBStore.on('error', (error) => {
    console.log('[SESSION-ERROR] MongoDB session store error:', error);
});
mongoDBStore.on('connected', (error) => {
    console.log('[SESSION] MongoDB session store: Connected');
    startListenPort();
});

// Configure Google OAuth 2.0 strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, (accessToken, refreshToken, profile, done) => {
    // You can save the profile information to the session or your database
    return done(null, profile);
}));

// MongoDB session setup
app.use(session({
    secret: 'nonlnwza',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 86400000, // 86400000 ms = 1 day
    },
    store: mongoDBStore,
}));
app.use(morgan("dev"));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Serialize user
passport.serializeUser((user, done) => {
    done(null, user);
});

// Deserialize user
passport.deserializeUser((user, done) => {
    done(null, user);
});

// Google OAuth route
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback route
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/dashboard'); // Redirect to the dashboard or authorized page
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    // Check if the user is authenticated
    if (!req.isAuthenticated()) {
        return res.redirect('/auth/google'); // Redirect to login if not authenticated
    }

    // User is authenticated, display the dashboard
    const user = req.user;
    // res.send(`Welcome to your dashboard, ${user.displayName}!`);
    res.json(user);
});

app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});


// Start the server
function startListenPort() {
    server.listen(port);
}
server.on("listening", async () => {
    console.log(("[APP] ") + (`Localhost : http://127.0.0.1:${port}`));
    console.log(("[APP] ") + (`Listening on port : `) + (port));
});
server.on("error", (err) => {
    console.log("[APP-ERROR] " + err);
});
