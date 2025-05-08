const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const https = require('https');
const nodemailer = require('nodemailer');

const app = express();
const port = 4000;

// HTTPS certificate and key
const options = {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'privatekey.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'certificate.pem'))
};
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'japhethmateobagay.grc@gmail.com',
        pass: 'jrqq hbrm przq fzmp' // Your App Password
    }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,
        maxAge: 10 * 60 * 1000
    }
}));

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Vnl_0037Bagay#',
    database: 'admindb'
});

let currentSem = null;

// Fetch the latest semester on server startup
db.query('SELECT id FROM SEMESTER ORDER BY id DESC LIMIT 1', (err, results) => {
    if (err) {
        console.error('Error fetching latest semester:', err);
        // Handle the error appropriately, maybe exit the process or set a default value
    } else if (results.length > 0) {
        currentSem = results[0].id;
        console.log('Current Semester ID:', currentSem);
    } else {
        console.log('No semester data found.');
    }
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mainpage.html'));
});

// LOGIN Handler
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // First, check the Admin table
    db.query('SELECT * FROM Admin WHERE username = ?', [username], async (err, adminResults) => {
        if (err) throw err;

        if (adminResults.length > 0) {
            const adminUser = adminResults[0];
            const isAdminMatch = await bcrypt.compare(password, adminUser.password);

            if (isAdminMatch && adminUser.role === 0) {
                req.session.loggedIn = true;
                req.session.user = adminUser;
                return res.redirect('/adminDash');
            }
        }

        // If not an admin, check the Scholar table
        db.query('SELECT * FROM Scholar WHERE username = ?', [username], async (err, scholarResults) => {
            if (err) throw err;

            if (scholarResults.length > 0) {
                const scholarUser = scholarResults[0];
                const isScholarMatch = await bcrypt.compare(password, scholarUser.password);

                if (isScholarMatch && scholarUser.role === 1) {
                    req.session.loggedIn = true;
                    req.session.user = scholarUser;
                    return res.redirect('/scholarDash'); // Ensure this route exists
                }
            }

            // If not an admin or scholar, check the Validator table
            db.query('SELECT * FROM Validator WHERE username = ?', [username], async (err, validatorResults) => {
                if (err) throw err;

                if (validatorResults.length > 0) {
                    const validatorUser = validatorResults[0];
                    const isValidatorMatch = await bcrypt.compare(password, validatorUser.password);

                    if (isValidatorMatch && validatorUser.role === 4) {
                        req.session.loggedIn = true;
                        req.session.user = validatorUser;
                        return res.redirect('/validatorDash'); // Ensure this route exists
                    }
                }

                // If no match found in any table
                res.send('Incorrect Username or Password');
            });
        });
    });
});

// Protected Route for Admin
app.get('/adminDash', (req, res) => {
    if (req.session.loggedIn && req.session.user.role === 0) {
        res.sendFile(path.join(__dirname, 'private', 'adminDash.html'));
    } else {
        res.redirect('/mainpage.html'); // Or a dedicated unauthorized page
    }
});

// Protected Route for Scholar
app.get('/scholarDash', (req, res) => {
    if (req.session.loggedIn && req.session.user.role === 1) {
        res.sendFile(path.join(__dirname, 'private', 'scholarDash.html')); // Create this file
    } else {
        res.redirect('/mainpage.html'); // Or a dedicated unauthorized page
    }
});

// Protected Route for Validator
app.get('/validatorDash', (req, res) => {
    if (req.session.loggedIn && req.session.user.role === 4) {
        res.sendFile(path.join(__dirname, 'private', 'validatorDash.html')); // Create this file
    } else {
        res.redirect('/mainpage.html'); // Or a dedicated unauthorized page
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

// Handle the POST request to save semester data
app.post('/add-semester', (req, res) => {
    const { name, start_date, end_date } = req.body;

    const query = 'INSERT INTO SEMESTER (name, start_date, end_date) VALUES (?, ?, ?)';
    db.execute(query, [name, start_date, end_date], (err, results) => {
        if (err) {
            console.error('Error saving data:', err);
            res.status(500).send('Error saving data');
        } else {
            currentSem = results.insertId; // Capture the auto-generated ID
            console.log('New semester ID:', currentSem);
            res.send(`Semester data saved successfully. ID: ${currentSem}`);
        }
    });
});

// Route to fetch roles
app.get('/get-roles', (req, res) => {
    db.query('SELECT id, role FROM Roles', (err, results) => {
        if (err) {
            console.error('Error fetching roles:', err);
            return res.status(500).json({ message: 'Failed to fetch roles.' });
        }
        res.json(results);
    });
});

// Create Account Route (Handles both Scholar and Validator)
app.post('/create-account', async (req, res) => {
    const { surname, firstname, email, role } = req.body;

    if (!currentSem) {
        return res.status(400).json({ message: 'No semester set yet.' });
    }

    const username = `${(role == 1 ? 'scholar' : (role == 4 ? 'validator' : 'user'))}${surname}`;
    const plainPassword = `${surname}#U1`; // Generic password
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const roleId = parseInt(role); // Ensure role is an integer

    let tableName;
    if (roleId === 1) {
        tableName = 'Scholar';
    } else if (roleId === 4) {
        tableName = 'Validator';
    } else {
        return res.status(400).json({ message: 'Invalid role selected.' });
    }

    const insertQuery = `
        INSERT INTO ${tableName} (surname, firstname, email, username, password, role, semester)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.execute(insertQuery, [surname, firstname, email, username, hashedPassword, roleId, currentSem], async (err) => {
        if (err) {
            console.error(`Error creating ${tableName} account:`, err);
            return res.status(500).json({ message: `Failed to create ${tableName} account.` });
        }

        // Send email with credentials
        const mailOptions = {
            from: 'japhethmateobagay.grc@gmail.com',
            to: email,
            subject: 'Your Account Details',
            text: `Hello ${firstname},\n\nYour account has been created as a ${tableName}:\nUsername: ${username}\nPassword: ${plainPassword}\n\nPlease change your password after logging in.`
        };

        try {
            await transporter.sendMail(mailOptions);
            res.status(200).json({ message: 'Account created and email sent successfully.' });
        } catch (error) {
            console.error('Email send failed:', error);
            res.status(500).json({ message: `Account created but email failed to send to ${email}.` });
        }
    });
});

// Start HTTPS server
https.createServer(options, app).listen(port, () => {
    console.log(`Secure server running on https://localhost:${port}`);
});