const db = require('../config/db');

exports.newTicketsPage = (req, res) => {
    res.render('user/newTickets'); 
};


exports.createTicket = (req, res) => {
  const userId = parseInt(req.session.user?.user_id, 10); // Get user ID from session
  const { subject, body } = req.body; // Extract subject and body from form data
  const createdAt = new Date(); // Current timestamp for created_at

  // Step 1: Insert NULL values into the queue table for name and priority
  const queueSql = `INSERT INTO queue (name, priority) VALUES (NULL, NULL)`;

  // Insert into the queue table and retrieve the generated queue_id
  db.query(queueSql, (err, queueResult) => {
    if (err) {
      console.error("Error creating queue entry:", err);
      return res.status(500).send("Error creating queue entry");
    }

    // Retrieve the newly generated queue_id
    const queueId = queueResult.insertId;

    // Step 2: Insert the ticket data with the retrieved queue_id
    const ticketSql = `INSERT INTO tickets (user_id, title, description, created_at, queue_id) VALUES (?, ?, ?, ?, ?)`;
    db.query(ticketSql, [userId, subject, body, createdAt, queueId], (err, ticketResult) => {
      if (err) {
        console.error("Error creating ticket:", err);
        return res.status(500).send("Error creating ticket");
      }
      res.redirect('/user/tickets'); // Redirect to tickets list on success
    });
  });
};



exports.viewTickets = (req, res) => {
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

          res.render('user/tickets', {
            tickets: results,
            currentPage: page,
            totalPages: totalPages
          });
        }
      );
    }
  );
};


// view single_ticket
exports.tickets = (req, res) => {
  res.render('user/tickets', { username: req.session.user.username });
};


exports.viewKnowledgeBase = (req, res) => {
  const sql = `SELECT * FROM knowledge_base`;
  db.query(sql, (err, results) => {
    if (err) throw err;
    res.render('knowledgeBase', { articles: results });
  });
};


exports.showDashboard = (req, res) => {
  const user = req.user; // ดึงข้อมูลผู้ใช้จาก session หรือ authentication
  res.render('user/dashboard', { user: user }); // render ไปยัง views/user/dashboard.ejs พร้อมข้อมูล user
};

exports.search = (req, res) => {
  res.render('user/search');
};