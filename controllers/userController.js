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



// viewTickets ฟังก์ชันดึงตั๋วที่เป็นของผู้ใช้ที่ล็อกอิน
exports.viewTickets = (req, res) => {
  const userId = parseInt(req.session.user?.user_id, 10);
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  const searchTerm = req.query.search || ''; // รับค่าจาก search bar
  const status = req.query.status || 'all'; // รับค่าจาก select filter

  if (!userId) {
    return res.status(401).send('User not logged in');
  }

  let query = `SELECT ticket_id, title, status, created_at, IFNULL(updated_at, created_at) AS display_updated_at
               FROM tickets WHERE user_id = ? AND title LIKE ?`;
  let params = [userId, `%${searchTerm}%`];

  switch (status) {
    case 'open':
      query += ' AND status IN (?, ?)';
      params.push('Open', 'Reopened');
      break;
    case 'pending':
      query += ' AND status IN (?, ?, ?)';
      params.push('In Progress', 'Pending', 'Assigned');
      break;
    case 'resolved':
      query += ' AND status = ?';
      params.push('Resolved');
      break;
    case 'closed':
      query += ' AND status = ?';
      params.push('Closed');
      break;
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  db.query(query, params, (error, results) => {
    if (error) {
      console.error('Database query error:', error);
      return res.status(500).send('Error retrieving tickets');
    }

    db.query(`SELECT COUNT(*) AS total FROM tickets WHERE user_id = ? AND title LIKE ?`, 
      [userId, `%${searchTerm}%`], (countError, countResults) => {
      
      if (countError) {
        console.error('Count query error:', countError);
        return res.status(500).send('Error counting tickets');
      }

      const totalTickets = countResults[0].total;
      const totalPages = Math.ceil(totalTickets / limit);

      res.render('user/tickets', {
        tickets: results,
        currentPage: page,
        totalPages: totalPages,
        searchTerm: searchTerm, // ส่ง searchTerm ไปยัง view
        status: status // ส่ง status ไปยัง view
      });
    });
  });
};



exports.getDashboard = (req, res) => {
  // Receive period from query string or default to 'daily'
  const { period = 'daily' } = req.query;

  // Calculate start date based on the period
  let startDate;
  const currentDate = new Date();
  switch (period) {
    case 'daily':
      startDate = new Date(currentDate.setDate(currentDate.getDate() - 1));
      break;
    case 'weekly':
      startDate = new Date(currentDate.setDate(currentDate.getDate() - 7));
      break;
    case 'monthly':
      startDate = new Date(currentDate.setMonth(currentDate.getMonth() - 1));
      break;
    default:
      startDate = new Date(currentDate.setDate(currentDate.getDate() - 1));
  }

  const stats = {};

  // Query New Tickets (without status)
  db.query(
    "SELECT COUNT(*) AS count FROM tickets WHERE created_at >= ?",
    [startDate],
    (error, results) => {
      if (error) {
        console.error("Error fetching New ticket stats:", error.message);
        return res.status(500).send("Error fetching ticket stats");
      }
      stats.newTickets = results[0].count;

      // Query Open Tickets
      db.query(
        "SELECT COUNT(*) AS count FROM tickets WHERE status IN ('Open', 'Reopened', 'Assigned', 'Pending') AND updated_at >= ?",
        [startDate],
        (error, results) => {
          if (error) {
            console.error("Error fetching Open ticket stats:", error.message);
            return res.status(500).send("Error fetching ticket stats");
          }
          stats.pendingTickets = results[0].count;

          // Query Resolved Tickets
          db.query(
            "SELECT COUNT(*) AS count FROM tickets WHERE status = 'Resolved' AND updated_at >= ?",
            [startDate],
            (error, results) => {
              if (error) {
                console.error("Error fetching Resolved ticket stats:", error.message);
                return res.status(500).send("Error fetching ticket stats");
              }
              stats.resolvedTickets = results[0].count;

              // Query Closed Tickets
              db.query(
                "SELECT COUNT(*) AS count FROM tickets WHERE status = 'Closed' AND updated_at >= ?",
                [startDate],
                (error, results) => {
                  if (error) {
                    console.error("Error fetching Closed ticket stats:", error.message);
                    return res.status(500).send("Error fetching ticket stats");
                  }
                  stats.closedTickets = results[0].count;

                  // Fetch reports
                  db.query("SELECT * FROM report WHERE status = 'show'", (error, reportResults) => {
                    if (error) {
                      console.error("Error fetching reports:", error.message);
                      return res.status(500).send("Error fetching reports");
                    }

                    // Render the dashboard view with the results
                    res.render('user/dashboard', {
                      period,
                      newTickets: stats.newTickets,
                      pendingTickets: stats.pendingTickets,
                      resolvedTickets: stats.resolvedTickets,
                      closedTickets: stats.closedTickets,
                      reports: reportResults // Pass reports to the dashboard
                    });
                  });
                }
              );
            }
          );
        }
      );
    }
  );
};

exports.viewTicketDetail = (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10); // Get ticket_id from the URL parameter

  db.query(
    `SELECT t.ticket_id, t.title, t.description, t.status, t.created_at, t.updated_at,
            t.queue_id,
            u.user_id, u.username, u.email
     FROM tickets t
     JOIN users u ON t.user_id = u.user_id
     WHERE t.ticket_id = ?`,
    [ticketId],
    (error, result) => {
        console.log("Ticket ID:", ticketId); // Log the ticket ID
        console.log("Query result:", result); // Log the query result
        
        if (error) {
            console.error('Error retrieving ticket details:', error);
            return res.status(500).send('Error retrieving ticket details');
        }
        if (result.length === 0) {
            return res.status(404).send('Ticket not found');
        }

        res.render('user/ticketDetail', { ticket: result[0] });
    }
);
}

// ดึงรายงานที่มีสถานะ show
exports.getReports = (req, res) => {
  db.query(
      "SELECT * FROM report WHERE status = 'show'",
      (error, results) => {
          if (error) {
              console.error("Error fetching reports:", error.message);
              return res.status(500).send("Error fetching reports");
          }
          res.render('user/dashboard', { reports: results }); // ส่งข้อมูลรายงานไปยังหน้าแดชบอร์ด
      }
  );
};

// แสดงรายละเอียดรายงาน
exports.getReportDetails = (req, res) => {
  const reportId = req.params.id;

  db.query(
      "SELECT * FROM report WHERE report_id = ?",
      [reportId],
      (error, results) => {
          if (error) {
              console.error("Error fetching report details:", error.message);
              return res.status(500).send("Error fetching report details");
          }
          // Check if report is found
          if (results.length === 0) {
              return res.status(404).send("Report not found");
          }
          res.render('user/reportDetails', { report: results[0] }); // Send report data to view
      }
  );
};

exports.getFaqList = (req, res) => {
  const query = 'SELECT knowledge_base_id, title FROM knowledgebase';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching FAQ list:', err);
      return res.status(500).send('Server error');
    }
    // เพิ่ม searchTerm เป็นค่าว่าง เพื่อป้องกัน error ใน view
    res.render('user/faq', { faqs: results, searchTerm: '' });
  });
};


// Function to get the details of a single FAQ by ID
exports.getFaqDetail = (req, res) => {
  const faqId = parseInt(req.params.id, 10);
  const query = 'SELECT title, content FROM knowledgebase WHERE knowledge_base_id = ?';
  db.query(query, [faqId], (err, results) => {
    if (err) {
      console.error('Error fetching FAQ detail:', err);
      return res.status(500).send('Server error');
    }
    if (results.length === 0) {
      return res.status(404).send('FAQ not found');
    }
    res.render('user/faqDetail', { faq: results[0] });
  });
};

exports.searchFaqs = (req, res) => {
  const searchTerm = req.query.search || '';
  const query = `SELECT knowledge_base_id, title FROM knowledgebase WHERE title LIKE ?`;
  db.query(query, [`%${searchTerm}%`], (err, results) => {
    if (err) {
      console.error('Error searching FAQs:', err);
      return res.status(500).send('Server error');
    }
    res.render('user/faq', { faqs: results, searchTerm });
  });
};
