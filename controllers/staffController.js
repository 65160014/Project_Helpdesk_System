const db = require('../config/db');

// Display tickets assigned to the logged-in staff member
exports.viewAssignedTickets = (req, res) => {
    const { user_id, username, role } = req.session.user;
    const { status, priority } = req.query; // Get status and priority from query parameters
  
    // Step 1: Find the staff_id of the current user based on the username
    db.query(
      `SELECT staff.staff_id 
       FROM staff 
       WHERE staff.name = ?`,
      [username],
      (error, results) => {
        if (error || results.length === 0) {
          console.error('Error fetching staff information:', error);
          return res.status(500).send('Error fetching staff information');
        }
  
        const { staff_id } = results[0];
  
        // Step 2: Initialize base query to fetch tickets assigned to this staff member's queues
        let query = `
          SELECT tickets.ticket_id, tickets.title, tickets.status, tickets.created_at,
                 IFNULL(tickets.updated_at, tickets.created_at) AS display_updated_at,
                 tickets.user_id, queue.priority,
                 users.username AS ticket_owner_username, users.email AS ticket_owner_email
          FROM tickets
          JOIN queue ON tickets.queue_id = queue.queue_id
          JOIN staff_has_queue ON queue.queue_id = staff_has_queue.queue_id
          JOIN users ON tickets.user_id = users.user_id
          WHERE staff_has_queue.staff_id = ?`;
        
        let params = [staff_id];
  
        // Add conditional filtering based on the status and priority selected
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
  
        if (priority && priority !== 'all') {
          query += ` AND queue.priority = ?`;
          params.push(priority);
        }
  
        db.query(query, params, (ticketError, ticketResults) => {
          if (ticketError) {
            console.error('Error fetching assigned tickets:', ticketError);
            return res.status(500).send('Error fetching assigned tickets');
          }
  
          // Render the staff/tickets view with the retrieved tickets and user info
          res.render('staff/tickets', {
            tickets: ticketResults,
            staff_id
          });
        });
      }
    );
  };
  
  


// View ticket details for a ticket assigned to the logged-in staff member
exports.viewTicketDetail = (req, res) => {
  // Parse and validate ticket_id from the request parameters
  const ticketId = parseInt(req.params.ticket_id, 10);
  if (isNaN(ticketId)) {
      return res.status(400).send('Invalid ticket ID');
  }

  const { username } = req.session.user;

  // Step 1: Find the staff_id of the current user based on the username
  db.query(
      `SELECT staff.staff_id 
       FROM staff 
       WHERE staff.name = ?`,
      [username],
      (error, staffResults) => {
          if (error || staffResults.length === 0) {
              console.error('Error fetching staff ID:', error);
              return res.status(500).send('Error fetching staff information');
          }

          const { staff_id } = staffResults[0];

          // Step 2: Retrieve ticket details if assigned to this staff member's queue
          db.query(
              `SELECT t.ticket_id, t.title, t.description, t.status, t.created_at, t.updated_at,
                      t.queue_id, u.username AS ticket_owner_username, u.email AS ticket_owner_email
               FROM tickets t
               JOIN users u ON t.user_id = u.user_id
               JOIN staff_has_queue shq ON t.queue_id = shq.queue_id
               WHERE t.ticket_id = ? AND shq.staff_id = ?`,
              [ticketId, staff_id],
              (ticketError, ticketResults) => {
                  if (ticketError || ticketResults.length === 0) {
                      console.error('Error retrieving ticket details:', ticketError);
                      return res.status(404).send('Ticket not found or not assigned to this staff member');
                  }

                  // Render the ticket details view with the retrieved ticket data
                  res.render('staff/ticketDetail', { ticket: ticketResults[0] });
              }
          );
      }
  );
};



// Assign or update ticket status and ensure record in `staff_has_ticket` table
exports.setStatus = (req, res) => {
    const ticketId = parseInt(req.params.ticket_id, 10);
    const { status } = req.body;
    const { username } = req.session.user;

    // Get staff_id
    db.query(
        `SELECT staff_id FROM staff WHERE name = ?`,
        [username],
        (staffError, staffResults) => {
            if (staffError || staffResults.length === 0) {
                console.error('Error retrieving staff ID:', staffError);
                return res.status(500).send('Error retrieving staff information');
            }

            const staff_id = staffResults[0].staff_id;

            // Check if staff has the ticket already in `staff_has_ticket`
            db.query(
                `SELECT * FROM staff_has_ticket WHERE staff_id = ? AND ticket_id = ?`,
                [staff_id, ticketId],
                (checkError, checkResults) => {
                    if (checkError) {
                        console.error('Error checking ticket assignment:', checkError);
                        return res.status(500).send('Error checking ticket assignment');
                    }

                    if (checkResults.length === 0) {
                        // Insert new record if not exists
                        db.query(
                            `INSERT INTO staff_has_ticket (staff_id, ticket_id, assigned_at) VALUES (?, ?, NOW())`,
                            [staff_id, ticketId],
                            (insertError) => {
                                if (insertError) {
                                    console.error('Error inserting ticket assignment:', insertError);
                                    return res.status(500).send('Error assigning ticket to staff');
                                }
                                updateTicketStatus();
                            }
                        );
                    } else {
                        // Update `assigned_at` timestamp if record exists
                        db.query(
                            `UPDATE staff_has_ticket SET assigned_at = NOW() WHERE staff_id = ? AND ticket_id = ?`,
                            [staff_id, ticketId],
                            (updateError) => {
                                if (updateError) {
                                    console.error('Error updating assignment timestamp:', updateError);
                                    return res.status(500).send('Error updating assignment timestamp');
                                }
                                updateTicketStatus();
                            }
                        );
                    }

                    // Update ticket status
                    function updateTicketStatus() {
                      db.query(
                          `UPDATE tickets SET status = ?, updated_at = NOW() WHERE ticket_id = ?`,
                          [status, ticketId],
                          (statusError, statusResults) => {
                              if (statusError) {
                                  console.error('Error updating ticket status:', statusError); // เพิ่มการพิมพ์ข้อผิดพลาด
                                  return res.status(500).send('Failed to update ticket status. Please check input and try again.');
                              }
                  
                              console.log('Status updated successfully for ticket ID:', ticketId);
                              res.status(200).send('Status updated successfully');
                          }
                      );
                  }                  
                }
            );
        }
    );
};

//แสดงหน้า tickets ที่แบ่งตาม priority
exports.setPriority = (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10);
  const { priority } = req.body;
  const { username } = req.session.user;

  // Find queue_id where the name of staff matches the current user
  db.query(
      `SELECT queue_id FROM queue WHERE name = ?`,
      [username],
      (queueError, queueResults) => {
          if (queueError || queueResults.length === 0) {
              console.error('Error retrieving queue ID for staff:', queueError);
              return res.status(500).send('Error retrieving queue information');
          }

          const queue_id = queueResults[0].queue_id;

          // Update the priority in the queue table
          db.query(
              `UPDATE queue SET priority = ? WHERE queue_id = ?`,
              [priority, queue_id],
              (priorityError, priorityResults) => {
                  if (priorityError) {
                      console.error('Error updating priority in queue:', priorityError);
                      return res.status(500).send('Failed to update priority');
                  }

                  console.log('Priority updated successfully for queue ID:', queue_id);
                  res.status(200).send('Priority updated successfully');
              }
          );
      }
  );
};


// View tickets grouped by status for a staff member
exports.status = (req, res) => {
  res.render('staff/status');
};

exports.getTicketsByStatus = (req, res) => {
  const status = req.params.status;
  const searchTerm = req.query.search || ''; // Get the search term from the query parameters
  const { username } = req.session.user;  // Get the staff's username from the session
  let query;
  let params = [];

  // First, get staff_id for the logged-in user
  db.query(
      `SELECT staff_id FROM staff WHERE name = ?`,
      [username],
      (staffError, staffResults) => {
          if (staffError || staffResults.length === 0) {
              console.error('Error retrieving staff ID:', staffError);
              return res.status(500).send('Error retrieving staff information');
          }

          const staff_id = staffResults[0].staff_id;

          // Build the query based on status and staff_id
          switch (status) {
              case 'open':
                  query = `SELECT * FROM tickets 
                           JOIN staff_has_ticket ON staff_has_ticket.ticket_id = tickets.ticket_id
                           WHERE tickets.status IN (?, ?) AND staff_has_ticket.staff_id = ? AND tickets.title LIKE ?`;
                  params = ['New', 'Reopened', staff_id, `%${searchTerm}%`];
                  break;
              case 'pending':
                  query = `SELECT * FROM tickets 
                           JOIN staff_has_ticket ON staff_has_ticket.ticket_id = tickets.ticket_id
                           WHERE tickets.status IN (?, ?, ?) AND staff_has_ticket.staff_id = ? AND tickets.title LIKE ?`;
                  params = ['In Progress', 'Pending', 'Assigned', staff_id, `%${searchTerm}%`];
                  break;
              case 'resolved':
                  query = `SELECT * FROM tickets 
                           JOIN staff_has_ticket ON staff_has_ticket.ticket_id = tickets.ticket_id
                           WHERE tickets.status = ? AND staff_has_ticket.staff_id = ? AND tickets.title LIKE ?`;
                  params = ['Resolved', staff_id, `%${searchTerm}%`];
                  break;
              case 'closed':
                  query = `SELECT * FROM tickets 
                           JOIN staff_has_ticket ON staff_has_ticket.ticket_id = tickets.ticket_id
                           WHERE tickets.status = ? AND staff_has_ticket.staff_id = ? AND tickets.title LIKE ?`;
                  params = ['Closed', staff_id, `%${searchTerm}%`];
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
              res.render('staff/statusPage', { tickets: results, status, searchTerm });
          });
      }
  );
};

exports.queue = (req, res) => {
  res.render('staff/queue');
};

exports.getTicketsByPriority = (req, res) => {
  const priority = req.params.priority;
  const searchQuery = req.query.search || ''; // Get the search query from the request
  const { username } = req.session.user;  // Get the staff's username from the session
  let queueId;
  let query;
  let params = [];

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

  // First, get staff_id for the logged-in user
  db.query(
      `SELECT staff_id FROM staff WHERE name = ?`,
      [username],
      (staffError, staffResults) => {
          if (staffError || staffResults.length === 0) {
              console.error('Error retrieving staff ID:', staffError);
              return res.status(500).send('Error retrieving staff information');
          }

          const staff_id = staffResults[0].staff_id;

          // SQL query to get tickets with the selected queue_id, matching the search query, and assigned to the staff
          query = `SELECT tickets.* 
                   FROM tickets 
                   JOIN staff_has_ticket ON tickets.ticket_id = staff_has_ticket.ticket_id
                   WHERE tickets.queue_id = ? AND staff_has_ticket.staff_id = ? AND tickets.title LIKE ?`;

          params = [queueId, staff_id, `%${searchQuery}%`];

          db.query(query, params, (error, results) => {
              if (error) {
                  console.error('Database query error:', error);
                  return res.status(500).send('Server Error');
              }
              res.render('staff/ticketsByPriority', { tickets: results, priority, searchQuery });
          });
      }
  );
};
