const db = require('../config/db');

exports.tickets = (req, res) => {
  const userId = parseInt(req.session.user?.user_id, 10);
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  console.log('Full session data:', req.session);
  console.log('User ID before query:', userId);

  if (!userId) {
    return res.status(401).send('User not logged in');
  }

  // Query to retrieve tickets, using IFNULL to handle NULL values in updated_at
  db.query(
    `SELECT ticket_id, title, status, created_at, IFNULL(updated_at, created_at) AS display_updated_at
     FROM tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset],
    (error, results) => {
      if (error) {
        console.error('Database query error:', error);
        return res.status(500).send('Error retrieving tickets');
      }

      // Query to count total tickets for pagination
      db.query(
        `SELECT COUNT(*) AS total FROM tickets WHERE user_id = ?`,
        [userId],
        (countError, countResults) => {
          if (countError) {
            console.error('Count query error:', countError);
            return res.status(500).send('Error counting tickets');
          }

          const totalTickets = countResults[0].total;
          const totalPages = Math.ceil(totalTickets / limit);

          res.render('staff/tickets', {
            tickets: results,
            currentPage: page,
            totalPages: totalPages
          });
        }
      );
    }
  );
};

exports.status = (req, res) => {
    res.render('staff/status');
  };

exports.queue = (req, res) => {
    res.render('staff/queue');
  };  

exports.viewNewTickets = (req, res) => {
  const sql = `SELECT * FROM tickets WHERE status = 'New'`;
  db.query(sql, (err, results) => {
    if (err) throw err;
    res.render('newTickets', { tickets: results });
  });
};

exports.assignTicket = (req, res) => {
  const { staffId } = req.body;
  const ticketId = req.params.id;
  const sql = `UPDATE tickets SET staff_id = ?, status = 'In Progress' WHERE id = ?`;
  db.query(sql, [staffId, ticketId], (err, result) => {
    if (err) throw err;
    res.redirect('/staff/tickets/new');
  });
};