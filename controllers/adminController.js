const db = require('../config/db');

exports.dashboard = (req, res) => {
    res.render('admin/dashboard');
  };
 


exports.viewTickets = (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
  
    // Console logs for debugging
    console.log('Full session data:', req.session);
  
    // Query to retrieve all tickets with pagination
    db.query(
      `SELECT ticket_id, title, status, created_at, IFNULL(updated_at, created_at) AS display_updated_at
       FROM tickets ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
      (error, results) => {
        if (error) {
          console.error('Database query error:', error);
          return res.status(500).send('Error retrieving tickets');
        }
  
        // Query to count total tickets for pagination
        db.query(
          `SELECT COUNT(*) AS total FROM tickets`,
          (countError, countResults) => {
            if (countError) {
              console.error('Count query error:', countError);
              return res.status(500).send('Error counting tickets');
            }
  
            const totalTickets = countResults[0].total;
            const totalPages = Math.ceil(totalTickets / limit);
  
            // Render the view with tickets and pagination data
            res.render('admin/tickets', {
              tickets: results,
              currentPage: page,
              totalPages: totalPages
            });
          }
        );
      }
    );
  };
  

exports.search = (req, res) => {
    res.render('admin/search');
  };

exports.status = (req, res) => {
    res.render('admin/status');
  };

exports.queue = (req, res) => {
    res.render('admin/queue');
  };

// exports.users = (req, res) => {
//     res.render('admin/users');
//   };

exports.viewUsers = (req, res) => {
  const sql = `SELECT * FROM users`;
  db.query(sql, (err, results) => {
    if (err) throw err;
    res.render('/admin/userList', { users: results });
  });
};

exports.editUser = (req, res) => {
  const userId = req.params.id;
  const { username, role } = req.body;
  const sql = `UPDATE users SET username = ?, role = ? WHERE id = ?`;
  db.query(sql, [username, role, userId], (err, result) => {
    if (err) throw err;
    res.redirect('/admin/manage_user');
  });
};

exports.deleteUser = (req, res) => {
  const userId = req.params.id;
  const sql = `DELETE FROM users WHERE id = ?`;
  db.query(sql, [userId], (err, result) => {
    if (err) throw err;
    res.redirect('/admin/users');
  });
};
