require("dotenv").config();
const express = require('express');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
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

// Session setup
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

// Deserialize user from session
// app.use((req, res, next) => {
//     if (req.session.user) {
//         res.locals.user = req.session.user;
//     }
//     next();
// });

// Google OAuth route
app.get('/auth/google', (req, res) => {
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        response_type: 'code',
        scope: 'profile email',
    });

    res.redirect(`https://accounts.google.com/o/oauth2/auth?${params}`);
});

// Google OAuth callback route
app.get('/auth/google/callback', async (req, res) => {
    const code = req.query.code;

    try {
        const response = await axios.post(
            'https://oauth2.googleapis.com/token',
            `code=${code}&client_id=${process.env.GOOGLE_CLIENT_ID}&client_secret=${process.env.GOOGLE_CLIENT_SECRET}&redirect_uri=${process.env.GOOGLE_CALLBACK_URL}&grant_type=authorization_code`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const accessToken = response.data.access_token;

        // Fetch user data from Google API using the access token
        const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const user = userResponse.data;

        // Save user data in the session
        req.session.user = user;

        res.redirect('/dashboard'); // Redirect to the dashboard or authorized page
    } catch (error) {
        console.error('Error exchanging code for access token:', error.response.data);
        res.status(500).send('An error occurred during login.');
    }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    // Check if the user is authenticated
    if (!req.session.user) {
        return res.redirect('/auth/google'); // Redirect to login if not authenticated
    }

    // User is authenticated, display the dashboard
    const user = req.session.user;
    // res.send(`Welcome to your dashboard, ${user.displayName}!`);
    res.json(user);
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
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
