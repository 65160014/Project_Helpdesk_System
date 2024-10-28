const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session setup
app.use(session({
  secret: 'helpdesk_secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// View Engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Database connection setup
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'helpdeskDB'
  });

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to database');
});

// Define Routes
const userRoutes = require('./routes/user');
const staffRoutes = require('./routes/staff');
const adminRoutes = require('./routes/admin');

app.use('/user', userRoutes);
app.use('/staff', staffRoutes);
app.use('/admin', adminRoutes);

// Home and login routes
app.get('/', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Query the database to check if the user exists
  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
  
  db.query(query, [username, password], (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      return res.render('login', { error: 'An error occurred' });
    }

    if (results.length > 0) {
      // User exists; determine role and redirect accordingly
      const user = results[0];
      
      // Set user session based on role from database
      req.session.user = { role: user.role, username: user.username };
      
      // Redirect to the appropriate dashboard
      if (user.role === 'admin') {
        return res.redirect('/admin/dashboard');
      } else if (user.role === 'staff') {
        return res.redirect('/staff/dashboard');
      } else if (user.role === 'user') {
        return res.redirect('/user/tickets');
      }
    } else {
      // User not found
      return res.render('login', { error: 'Invalid credentials' });
    }
  });
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    const { username, email, password, confirm_password } = req.body;

    // Check if passwords match
    if (password !== confirm_password) {
        return res.render('register', { error: 'Passwords do not match' });
    }

    // Check if the username or email already exists
    const checkQuery = 'SELECT * FROM users WHERE username = ? OR email = ?';
    db.query(checkQuery, [username, email], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.render('register', { error: 'An error occurred. Please try again.' });
        }

        if (results.length > 0) {
            return res.render('register', { error: 'Username or email already exists' });
        }

        // Insert the new user into the database
        const query = 'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)';
        db.query(query, [username, email, password, 'user'], (err, results) => {
            if (err) {
                console.error('Database insertion error:', err);
                return res.render('register', { error: 'An error occurred during registration. Please try again.' });
            }

            // Redirect to login page upon successful registration
            res.redirect('/');
        });
    });
});



app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
