const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');             // Import fs for reading certs
const https = require('https');       // Import https for secure server

const app = express();
const port = 4000;

// HTTPS certificate and key
const options = {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'privatekey.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'certificate.pem'))
};

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,             // HTTPS only
        maxAge: 10 * 60 * 1000    // 10 minutes in milliseconds
    }
}));


// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Vnl_0037Bagay#',
    database: 'adminDB'
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mainpage.html'));
});

// LOGIN Handler
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.query('SELECT * FROM Admin WHERE username = ?', [username], async (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            const user = results[0];
            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch && user.role === 'admin') {
                req.session.loggedIn = true;
                req.session.user = user;
                return res.redirect('/adminDash');
            }
        }
        res.send('Incorrect Username or Password');
    });
});

// Protected Route
app.get('/adminDash', (req, res) => {
    if (req.session.loggedIn && req.session.user.role === 'admin') {
        res.sendFile(path.join(__dirname, 'private', 'adminDash.html'));
    } else {
        res.redirect('/adminLogin.html');
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.send('Error logging out');
        }
        res.redirect('/mainpage.html');
    });
});

// Start HTTPS server
https.createServer(options, app).listen(port, () => {
    console.log(`Secure server running on https://localhost:${port}`);
});
