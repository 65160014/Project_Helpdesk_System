const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2');

const app = express();
app.use(bodyParser.json());
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
    database: 'helpdeskdb'
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
      const user = results[0];
      
      // Set user session based on role from database
      req.session.user = {
        user_id: user.user_id,
        username: user.username,
        role: user.role
      };

      // ตรวจสอบว่าข้อมูล session ถูกตั้งค่า
      console.log('Session after login:', req.session);

      // Redirect to the appropriate dashboard
      if (user.role === 'admin') {
        return res.redirect('/admin/dashboard');
      } else if (user.role === 'staff') {
        return res.redirect('/staff/assigned-tickets');
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

        // Insert the new user into the database without hashing the password
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

// Routes for Profile, Password Change, and Logout
app.get('/profile', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }

  const user_id = req.session.user.user_id;
  const query = 'SELECT username, email FROM users WHERE user_id = ?';

  db.query(query, [user_id], (err, results) => {
    if (err) {
      console.error('Error fetching user data:', err);
      return res.render('profile', { error: 'Unable to fetch user data', user: null });
    }

    if (results.length > 0) {
      res.render('profile', { user: results[0], error: null });
    } else {
      res.render('profile', { error: 'User not found', user: null });
    }
  });
});



app.post('/profile/change-password', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }

  const { old_password, new_password, confirm_new_password } = req.body;
  const user_id = req.session.user.user_id;

  // Verify new passwords match
  if (new_password !== confirm_new_password) {
    const query = 'SELECT username, email FROM users WHERE user_id = ?';
    db.query(query, [user_id], (err, results) => {
      if (err) {
        console.error('Error fetching user data:', err);
        return res.render('profile', { error: 'Unable to fetch user data' });
      }
      return res.render('profile', {
        user: results[0],
        error: 'New passwords do not match'
      });
    });
    return; // Stop further execution
  }

  // Verify old password
  const checkQuery = 'SELECT * FROM users WHERE user_id = ? AND password = ?';
  db.query(checkQuery, [user_id, old_password], (err, results) => {
    if (err) {
      console.error('Error verifying old password:', err);
      return res.render('profile', { error: 'An error occurred' });
    }

    if (results.length > 0) {
      // Update password if old password matches
      const updateQuery = 'UPDATE users SET password = ? WHERE user_id = ?';
      db.query(updateQuery, [new_password, user_id], (err) => {
        if (err) {
          console.error('Error updating password:', err);
          return res.render('profile', { error: 'Unable to update password' });
        }
        // After successful password update, show success message
        return res.render('profile', {
          user: results[0],
          error: 'Password updated successfully'
        });
      });
    } else {
      // Old password is incorrect
      const query = 'SELECT username, email FROM users WHERE user_id = ?';
      db.query(query, [user_id], (err, results) => {
        if (err) {
          console.error('Error fetching user data:', err);
          return res.render('profile', { error: 'Unable to fetch user data' });
        }
        return res.render('profile', {
          user: results[0],
          error: 'Old password is incorrect'
        });
      });
    }
  });
});


// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error logging out:', err);
    }
    res.redirect('/');
  });
});


app.listen(3000, () => {
  console.log('Server is running on port 3000');
});