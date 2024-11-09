const db = require('../config/db');

// ฟังก์ชันเพื่อดึงข้อมูลตั๋วตามช่วงเวลา
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
                    res.render('admin/dashboard', {
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

exports.showAddReportForm = (req, res) => {
  // Check if user information is stored in the session
  if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(403).send("Access denied. Admins only.");
  }

  const adminName = req.session.user.username; // Get username from session for display

  res.render('admin/addReport', { adminName }); // Pass adminName to the view
};





exports.addReport = (req, res) => {
  // Ensure user is authenticated and has an admin role

  const { title, content } = req.body;
  const adminName = req.session.user.username;
  // Retrieve admin's username from session

  db.query(
      "INSERT INTO report (admin_name, title, content, status) VALUES (?, ?, ?, 'show')",
      [adminName, title, content],
      (error, results) => {
          if (error) {
              console.error("Error adding report:", error.message);
              return res.status(500).send("Error adding report");
          }
          res.redirect('/admin/dashboard'); // Redirect back to dashboard after adding report
      }
  );
};



// ดึงรายงานที่มีสถานะ show
exports.getReports = (req, res) => {
  db.query(
      "SELECT * FROM report WHERE status = 'show'",
      (error, results) => {
          if (error) {
              console.error("Error fetching reports:", error.message);
              return res.status(500).send("Error fetching reports");
          }
          res.render('admin/dashboard', { reports: results }); // ส่งข้อมูลรายงานไปยังหน้าแดชบอร์ด
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
          res.render('admin/reportDetails', { report: results[0] }); // Send report data to view
      }
  );
};


// แก้ไขรายงาน
exports.updateReport = (req, res) => {
  const reportId = req.params.id;
  const { title, content, status } = req.body; // Include `status` from the form

  db.query(
      "UPDATE report SET title = ?, content = ?, status = ? WHERE report_id = ?",
      [title, content, status, reportId],
      (error, results) => {
          if (error) {
              console.error("Error updating report:", error.message);
              return res.status(500).send("Error updating report");
          }
          res.redirect(`/admin/dashboard`); // Redirect to report details page
      }
  );
};



exports.viewTickets = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;
  const { status, priority } = req.query;

  // Base query with filters for both status and priority
  let query = `
      SELECT tickets.ticket_id, tickets.title, tickets.status, tickets.created_at, 
             IFNULL(tickets.updated_at, tickets.created_at) AS display_updated_at,
             tickets.user_id, users.username, users.email,
             queue.priority, queue.name AS agent_name
      FROM tickets
      LEFT JOIN users ON tickets.user_id = users.user_id
      LEFT JOIN queue ON tickets.queue_id = queue.queue_id
      WHERE 1=1`;

  let params = [];

  // Add status filter
  if (status && status !== 'all') {
      switch (status) {
          case 'open':
              query += ` AND tickets.status IN (?, ?)`;
              params.push('New', 'Reopened');
              break;
          case 'pending':
              query += ` AND tickets.status IN (?, ?, ?)`;
              params.push('In Progress', 'Pending', 'Assigned');
              break;
          case 'resolved':
              query += ` AND tickets.status = ?`;
              params.push('Resolved');
              break;
          case 'closed':
              query += ` AND tickets.status = ?`;
              params.push('Closed');
              break;
          default:
              return res.status(400).send('Invalid status');
      }
  }

  // Add priority filter
  if (priority && priority !== 'all') {
      query += ` AND queue.priority = ?`;
      params.push(priority);
  }

  // Complete the query with ordering, limit, and offset
  query += ` ORDER BY tickets.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  // Execute the main query
  db.query(query, params, (error, results) => {
      if (error) {
          console.error('Database query error:', error);
          return res.status(500).send('Error retrieving tickets');
      }

      // Count query that respects status and priority filters for pagination
      let countQuery = `SELECT COUNT(*) AS total FROM tickets LEFT JOIN queue ON tickets.queue_id = queue.queue_id WHERE 1=1`;
      let countParams = [];

      // Apply status and priority filters to the count query
      if (status && status !== 'all') {
          switch (status) {
              case 'open':
                  countQuery += ` AND tickets.status IN (?, ?)`;
                  countParams.push('New', 'Reopened');
                  break;
              case 'pending':
                  countQuery += ` AND tickets.status IN (?, ?, ?)`;
                  countParams.push('In Progress', 'Pending', 'Assigned');
                  break;
              case 'resolved':
                  countQuery += ` AND tickets.status = ?`;
                  countParams.push('Resolved');
                  break;
              case 'closed':
                  countQuery += ` AND tickets.status = ?`;
                  countParams.push('Closed');
                  break;
          }
      }

      if (priority && priority !== 'all') {
          countQuery += ` AND queue.priority = ?`;
          countParams.push(priority);
      }

      db.query(countQuery, countParams, (countError, countResults) => {
          if (countError) {
              console.error('Count query error:', countError);
              return res.status(500).send('Error counting tickets');
          }

          const totalTickets = countResults[0].total;
          const totalPages = Math.ceil(totalTickets / limit);

          res.render('admin/tickets', {
              tickets: results,
              currentPage: page,
              totalPages: totalPages,
              selectedStatus: status || 'all',
              selectedPriority: priority || 'all'
          });
      });
  });
};




  // Function to render individual ticket details
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
  
          res.render('admin/ticketDetail', { ticket: result[0] });
      }
  );
}

exports.setPriority = (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10);
  const { priority } = req.body;

  console.log('Received request to update priority. Ticket ID:', ticketId, 'Priority:', priority); // Log received values

  // Validate priority
  const validPriorities = ['urgent', 'high', 'medium', 'low'];
  if (!validPriorities.includes(priority)) {
    console.error('Invalid priority value received:', priority); // Log invalid priority
    return res.status(400).send('Invalid priority value');
  }

  console.log('Updating ticket:', ticketId, 'with priority:', priority); // Debugging log

  // Step 1: Get the queue_id from tickets
  db.query(
    `SELECT queue_id FROM tickets WHERE ticket_id = ?`,
    [ticketId],
    (err, results) => {
      if (err) {
        console.error('Error retrieving queue_id:', err);
        return res.status(500).send('Error retrieving queue_id');
      }

      if (results.length === 0) {
        console.error('No ticket found with ticket_id:', ticketId); // Log if no ticket found
        return res.status(404).send('Ticket not found');
      }

      const queueId = results[0].queue_id; // Get the queue_id
      console.log('Retrieved queue_id:', queueId); // Log the retrieved queue_id

      // Step 2: Check if the queue_id exists in the queue table
      db.query(
        `SELECT * FROM queue WHERE queue_id = ?`,
        [queueId],
        (checkError, checkResults) => {
          if (checkError) {
            console.error('Error checking queue existence:', checkError);
            return res.status(500).send('Error checking queue existence');
          }

          if (checkResults.length === 0) {
            console.error('Queue not found for queue_id:', queueId); // Log if no queue found
            return res.status(404).send('Queue not found');
          }

          // Step 3: Update the priority in the queue table
          db.query(
            `UPDATE queue SET priority = ? WHERE queue_id = ?`,
            [priority, queueId],
            (queueError, updateResult) => {
              if (queueError) {
                console.error('Queue update error:', queueError);
                return res.status(500).send('Failed to update queue priority');
              }

              // Check if any row was updated
              if (updateResult.affectedRows === 0) {
                console.error('No rows updated for queue_id:', queueId); // Log if no rows updated
                return res.status(404).send('Queue not found for update');
              }

              console.log('Priority updated successfully for ticket ID:', ticketId); // Log success
              res.status(200).send('Priority updated successfully'); // Send success response
            }
          );
        }
      );
    }
  );
};

exports.setStatus = (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10);
  const { status } = req.body;

  console.log('Received request to update status. Ticket ID:', ticketId, 'Status:', status); // Log received values

  // Validate status
  const validStatuses = ['Open', 'In Progress', 'Pending', 'Resolved', 'Closed'];
  if (!validStatuses.includes(status)) {
      console.error('Invalid status value received:', status); // Log invalid status
      return res.status(400).send('Invalid status value');
  }

  console.log('Updating ticket:', ticketId, 'with status:', status); // Debugging log

  // Update the ticket status and updated_at timestamp in the database
  db.query(
      `UPDATE tickets SET status = ?, updated_at = NOW() WHERE ticket_id = ?`,
      [status, ticketId],
      (error, results) => {
          if (error) {
              console.error('Error updating ticket status:', error);
              return res.status(500).send('Failed to update ticket status');
          }

          if (results.affectedRows === 0) {
              console.error('No rows updated for ticket_id:', ticketId); // Log if no rows updated
              return res.status(404).send('Ticket not found for update');
          }

          console.log('Status updated successfully for ticket ID:', ticketId); // Log success
          res.status(200).send('Status updated successfully'); // Send success response
      }
  );
};

// Function to render staff selection page
exports.getStaffSelection = (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10);

  // Fetch staff list from database
  db.query('SELECT * FROM staff', (error, staffList) => {
    if (error) {
        console.error('Error fetching staff list:', error); // Log error to console
        return res.status(500).send('Error fetching staff list');
    }
    // Debugging log to check staffList
    console.log('Fetched staff list:', staffList);
    // Render staff selection page with ticketId and staffList
    res.render('admin/select-staff', { ticketId, staffList });
  });
};



exports.assignStaffToTicket = (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10);
  const staffId = parseInt(req.body.staff_id, 10); // Corrected parsing

  console.log('Received ticketId:', ticketId);
  console.log('Received staff_id:', staffId);

  // Step 1: Fetch queue_id from ticket table using ticketId
  db.query('SELECT queue_id FROM tickets WHERE ticket_id = ?', [ticketId], (error, results) => {
    if (error) {
      console.error('Error fetching queue_id from ticket:', error);
      return res.status(500).send('Failed to fetch queue_id');
    }

    if (results.length === 0) {
      console.error('No ticket found with ticket_id:', ticketId);
      return res.status(404).send('Ticket not found');
    }

    const queueId = results[0].queue_id;
    console.log('Fetched queue_id:', queueId);

    // Step 2: Delete any existing rows with the same queue_id and staff_id in staff_has_queue
    db.query('DELETE FROM staff_has_queue WHERE queue_id = ?', [queueId], (deleteError, deleteResults) => {
      if (deleteError) {
        console.error('Error deleting rows from staff_has_queue:', deleteError);
        return res.status(500).send('Failed to delete rows from staff_has_queue');
      }
      console.log('Deleted existing rows with queue_id:', queueId);
      
      // เรียกใช้ฟังก์ชันเพื่อเพิ่มแถวใหม่สำหรับการจับคู่ staff_id กับ queue_id
      insertNewStaffQueue(queueId, staffId, res);
    });
    
  });
};

// Helper function to insert a new staff_has_queue row
function insertNewStaffQueue(queueId, staffId, res) {
  db.query('INSERT INTO staff_has_queue (queue_id, staff_id) VALUES (?, ?)', [queueId, staffId], (insertError, insertResults) => {
    if (insertError) {
      console.error('Error inserting new staff_has_queue row:', insertError);
      return res.status(500).send('Failed to insert new staff_has_queue row');
    }

    // Step 4: Update the staff name in the queue table
    db.query('SELECT name FROM staff WHERE staff_id = ?', [staffId], (nameError, nameResults) => {
      if (nameError) {
        console.error('Error fetching staff name:', nameError);
        return res.status(500).send('Failed to fetch staff name');
      }

      const staffName = nameResults[0].name;

      // Update the staff name in the queue table
      db.query('UPDATE queue SET name = ? WHERE queue_id = ?', [staffName, queueId], (updateError, updateResults) => {
        if (updateError) {
          console.error('Error updating queue:', updateError);
          return res.status(500).send('Failed to update queue');
        }

        console.log('Queue updated successfully with new staff name');
        res.status(200).send('Queue updated and staff assigned successfully');
      });
    });
  });
}



exports.status = (req, res) => {
  res.render('admin/status');
};

exports.getTicketsByStatus = (req, res) => {
  const status = req.params.status;
  const searchTerm = req.query.search || ''; // Get the search term from the query parameters
  let query;
  let params = [];

  // Build the query based on status
  switch (status) {
      case 'open':
          query = 'SELECT * FROM tickets WHERE status IN (?, ?) AND title LIKE ?';
          params = ['New', 'Reopened', `%${searchTerm}%`];
          break;
      case 'pending':
          query = 'SELECT * FROM tickets WHERE status IN (?, ?, ?) AND title LIKE ?';
          params = ['In Progress', 'Pending', 'Assigned', `%${searchTerm}%`];
          break;
      case 'resolved':
          query = 'SELECT * FROM tickets WHERE status = ? AND title LIKE ?';
          params = ['Resolved', `%${searchTerm}%`];
          break;
      case 'closed':
          query = 'SELECT * FROM tickets WHERE status = ? AND title LIKE ?';
          params = ['Closed', `%${searchTerm}%`];
          break;
      default:
          return res.status(400).send('Invalid status');
  }

  // Execute the query
  db.query(query, params, (error, results) => {
      if (error) {
          console.error('Database query error:', error);
          return res.status(500).send('Server Error');
      }
      res.render('admin/statusPage', { tickets: results, status, searchTerm }); // Pass searchTerm to the view
  });
};
exports.getTicketsByPriority = (req, res) => {
const priority = req.params.priority;
const searchQuery = req.query.search || ''; // Get the search query from the request
let queueId;

// Map priority name to queue_id
switch (priority) {
    case 'low':
        queueId = 1; // Assuming Low has queue_id 1
        break;
    case 'medium':
        queueId = 2; // Assuming Medium has queue_id 2
        break;
    case 'high':
        queueId = 3; // Assuming High has queue_id 3
        break;
    case 'urgent':
        queueId = 4; // Assuming Urgent has queue_id 4
        break;
    default:
        return res.status(400).send('Invalid priority');
}

// SQL query to get tickets with the selected queue_id and matching the search query
const query = 'SELECT * FROM tickets WHERE queue_id = ? AND title LIKE ?';

db.query(query, [queueId, `%${searchQuery}%`], (error, results) => {
    if (error) {
        console.error('Database query error:', error);
        return res.status(500).send('Server Error');
    }
    res.render('admin/ticketsByPriority', { tickets: results, priority, searchQuery });
});
};



exports.queue = (req, res) => {
  res.render('admin/queue');
};

// Controller to get all users

exports.getAllUsers = (req, res) => {
const roles = ['all', 'admin', 'staff', 'user'];
const counts = {};

// Initialize counts for each role
roles.forEach(role => {
    counts[role] = 0;
});

// Query for each role's count
const promises = roles.map(role => {
    return new Promise((resolve, reject) => {
        if (role === 'all') {
            db.query('SELECT COUNT(*) AS count FROM users', (err, results) => {
                if (err) return reject(err);
                counts[role] = results[0].count;
                resolve();
            });
        } else {
            db.query('SELECT COUNT(*) AS count FROM users WHERE role = ?', [role], (err, results) => {
                if (err) return reject(err);
                counts[role] = results[0].count;
                resolve();
            });
        }
    });
});

Promise.all(promises)
    .then(() => {
        res.render('admin/userList', { userCounts: counts });
    })
    .catch(err => {
        res.status(500).send(err);
    });
};


// Controller to get users by role
exports.getUsersByRole = (req, res) => {
const role = req.params.role;
let displayRole = 'All Role'; // Default display role

if (role === 'all') {
    // If the role is 'all', fetch all users
    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        // Pass the displayRole variable to the template
        res.render('admin/userbyrolePage', { users: results, displayRole });
    });
} else {
    // Fetch users by specific role
    db.query('SELECT * FROM users WHERE role = ?', [role], (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        displayRole = role; // Set the display role to the specific role
        res.render('admin/userbyrolePage', { users: results, displayRole });
    });
}
};

// Controller to search users by username
exports.searchUser = (req, res) => {
const username = req.query.username; // Get the username from the query

// Query to find users by username (case insensitive)
db.query('SELECT * FROM users WHERE username LIKE ?', [`%${username}%`], (err, results) => {
    if (err) {
        return res.status(500).send(err);
    }
    res.render('admin/userbyrolePage', { users: results, displayRole: 'Search Results' });
});
};


// Controller to get a specific user by ID for editing
exports.getUserById = (req, res) => {
const userId = parseInt(req.params.userId, 10);

db.query('SELECT * FROM users WHERE user_id = ?', [userId], (err, results) => {
    if (err) {
        return res.status(500).send(err);
    }
    if (results.length === 0) {
        return res.status(404).send('User not found');
    }
    res.render('admin/editUser', { user: results[0] });
});
};

// Controller to update user information
exports.updateUser = (req, res) => {
const userId = req.params.userId;
const { username, email, password, role } = req.body; // Include role in the destructuring

const sql = 'UPDATE users SET username = ?, email = ?, password = ?, role = ? WHERE user_id = ?';
db.query(sql, [username, email, password, role, userId], (err, results) => {
    if (err) {
        return res.status(500).send(err);
    }
    res.redirect('/admin/userList'); // Redirect to the user list after updating
});
};

// adminController.js

exports.showNewUserForm = (req, res) => {
// Render หน้า newUser โดยไม่ต้องมี error message
res.render('admin/newUser', { error: null });
};


exports.createUser = (req, res) => {
const { username, email, password, confirm_password, role } = req.body;

// ตรวจสอบว่ารหัสผ่านตรงกันหรือไม่
if (password !== confirm_password) {
    return res.render('admin/newUser', { error: 'Passwords do not match' });
}

// สร้าง query สำหรับเพิ่มผู้ใช้ใหม่ในตาราง users
const query = `
    INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)
`;
db.query(query, [username, email, password, role], (err, results) => {
    if (err) {
        console.error(err);
        return res.render('admin/newUser', { error: 'Failed to create user' });
    }

    // หาก role เป็น 'staff' ให้เพิ่มข้อมูลในตาราง staff
    if (role === 'staff') {
        const staffQuery = `
            INSERT INTO staff (name, email) VALUES (?, ?)
        `;
        db.query(staffQuery, [username, email], (err) => {
            if (err) {
                console.error(err);
                return res.render('admin/newUser', { error: 'Failed to create staff member' });
            }
            
            // หากสำเร็จทั้งสองอย่าง ให้ redirect หรือแสดงข้อความสำเร็จ
            res.redirect('/admin/userList'); // เปลี่ยนเส้นทางหลังจากสร้างผู้ใช้เสร็จ
        });
    } else {
        // หากไม่ใช่ staff ให้ redirect หรือแสดงข้อความสำเร็จ
        res.redirect('/admin/userList');
    }
});
};

// controllers/faqController.js

// exports.getFaqList = (req, res) => {
//   const query = 'SELECT knowledge_base_id, title FROM knowledgebase';
//   db.query(query, (err, results) => {
//     if (err) {
//       console.error('Error fetching FAQ list:', err);
//       return res.status(500).send('Server error');
//     }
//     // เพิ่ม searchTerm เป็นค่าว่าง เพื่อป้องกัน error ใน view
//     res.render('admin/faq', { faqs: results, searchTerm: '' });
//   });
// };


// // Function to get the details of a single FAQ by ID
// exports.getFaqDetail = (req, res) => {
//   const faqId = parseInt(req.params.id, 10);
//   const query = 'SELECT title, content FROM knowledgebase WHERE knowledge_base_id = ?';
//   db.query(query, [faqId], (err, results) => {
//     if (err) {
//       console.error('Error fetching FAQ detail:', err);
//       return res.status(500).send('Server error');
//     }
//     if (results.length === 0) {
//       return res.status(404).send('FAQ not found');
//     }
//     res.render('admin/faqDetail', { faq: results[0] });
//   });
// };

// exports.searchFaqs = (req, res) => {
//   const searchTerm = req.query.search || '';
//   const query = `SELECT knowledge_base_id, title FROM knowledgebase WHERE title LIKE ?`;
//   db.query(query, [`%${searchTerm}%`], (err, results) => {
//     if (err) {
//       console.error('Error searching FAQs:', err);
//       return res.status(500).send('Server error');
//     }
//     res.render('admin/faq', { faqs: results, searchTerm });
//   });
// };

