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

            query += ` ORDER BY tickets.created_at DESC`; // Add ordering

            db.query(query, params, (ticketError, ticketResults) => {
                if (ticketError) {
                    console.error('Error fetching assigned tickets:', ticketError);
                    return res.status(500).send('Error fetching assigned tickets');
                }

                // Render the staff/tickets view with the retrieved tickets and selected filters
                res.render('staff/tickets', {
                    tickets: ticketResults,
                    staff_id,
                    selectedStatus: status || 'all',
                    selectedPriority: priority || 'all'
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


exports.setStatus = (req, res) => {
    const ticketId = parseInt(req.params.ticket_id, 10);
    const { status } = req.body;
    const { username } = req.session.user;

    // Log received values
    console.log('Received request to update status. Ticket ID:', ticketId, 'Status:', status);

    // Validate status
    const validStatuses = ['In Progress', 'Pending', 'Resolved', 'Closed', 'Reopened', 'Escalated'];
    if (!validStatuses.includes(status)) {
        console.error('Invalid status value received:', status);
        return res.status(400).send('Invalid status value');
    }

    console.log('Updating ticket:', ticketId, 'with status:', status); // Debugging log

    // Retrieve staff ID based on username
    db.query(
        `SELECT staff_id FROM staff WHERE name = ?`,
        [username],
        (staffError, staffResults) => {
            if (staffError || staffResults.length === 0) {
                console.error('Error retrieving staff ID:', staffError);
                return res.status(500).send('Error retrieving staff information');
            }

            const staff_id = staffResults[0].staff_id;

            // Check if the staff member is assigned to the ticket
            db.query(
                `SELECT * FROM staff_has_ticket WHERE staff_id = ? AND ticket_id = ?`,
                [staff_id, ticketId],
                (checkError, checkResults) => {
                    if (checkError) {
                        console.error('Error checking ticket assignment:', checkError);
                        return res.status(500).send('Error checking ticket assignment');
                    }

                    if (checkResults.length === 0) {
                        // Assign the ticket to the staff member if not assigned
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
                        // Update the assignment timestamp if already assigned
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

                    // Function to update the ticket status
                    function updateTicketStatus() {
                        db.query(
                            `UPDATE tickets SET status = ?, updated_at = NOW() WHERE ticket_id = ?`,
                            [status, ticketId],
                            (statusError, statusResults) => {
                                if (statusError) {
                                    console.error('Error updating ticket status:', statusError);
                                    return res.status(500).send('Failed to update ticket status');
                                }

                                if (statusResults.affectedRows === 0) {
                                    console.error('No rows updated for ticket_id:', ticketId);
                                    return res.status(404).send('Ticket not found for update');
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
    const searchTerm = req.query.search || ''; // คำค้นหาที่ส่งมาจาก query parameters
    const { username } = req.session.user;  // ดึง username ของ staff ที่ login เข้ามา
    let query;
    let params = [];

    // เริ่มจากการหา queue_id ที่มีชื่อ (name) ตรงกับ username ที่ login เข้ามา
    db.query(
        `SELECT queue_id FROM queue WHERE name = ?`,
        [username],
        (queueError, queueResults) => {
          if (queueError || queueResults.length === 0) {
            console.error('Error retrieving queue IDs:', queueError);
            return res.status(500).send('Error retrieving queue information');
          }
      
          // ดึง queue_id ทั้งหมดเป็นอาร์เรย์
          const queueIds = queueResults.map(result => result.queue_id);
      
          // ปรับ query เพื่อให้ค้นหา tickets ที่มี queue_id อยู่ในอาร์เรย์ queueIds
          switch (status) {
            case 'open':
              query = `SELECT * FROM tickets 
                       WHERE tickets.status IN (?, ?) AND tickets.queue_id IN (?) AND tickets.title LIKE ?`;
              params = ['New', 'Reopened', queueIds, `%${searchTerm}%`];
              break;
            case 'pending':
              query = `SELECT * FROM tickets 
                       WHERE tickets.status IN (?, ?, ?) AND tickets.queue_id IN (?) AND tickets.title LIKE ?`;
              params = ['In Progress', 'Pending', 'Assigned', queueIds, `%${searchTerm}%`];
              break;
            case 'resolved':
              query = `SELECT * FROM tickets 
                       WHERE tickets.status = ? AND tickets.queue_id IN (?) AND tickets.title LIKE ?`;
              params = ['Resolved', queueIds, `%${searchTerm}%`];
              break;
            case 'closed':
              query = `SELECT * FROM tickets 
                       WHERE tickets.status = ? AND tickets.queue_id IN (?) AND tickets.title LIKE ?`;
              params = ['Closed', queueIds, `%${searchTerm}%`];
              break;
            default:
              return res.status(400).send('Invalid status');
          }
      
          // รันคำสั่ง query
          db.query(query, params, (error, results) => {
              if (error) {
                  console.error('Database query error:', error);
                  return res.status(500).send('Server Error');
              }
            //   console.log("Query Results:", results); // ตรวจสอบจำนวน ticket ที่ถูกดึงมา
              res.render('staff/statusPage', { tickets: results, status, searchTerm });
          });
        }
      );
};

  

exports.queue = (req, res) => {
  res.render('staff/queue');
};
exports.getTicketsByPriority = (req, res) => {
    const priority = req.params.priority;  // ค่าจาก URL เช่น 'low', 'medium', 'high', 'urgent'
    let searchTerm = req.query.search || '';  // ดึงคำค้นหาจาก query string, กำหนดเป็นค่าว่างถ้าไม่มี

    const { username } = req.session.user;  // ดึง username ของพนักงานที่ login เข้ามา

    let query;
    let params = [];

    // ค้นหาทุก queue_id ที่ตรงกับ username และ priority ที่กำหนด
    db.query(
      `SELECT queue_id FROM queue WHERE name = ? AND priority = ?`,
      [username, priority], // ใช้ username และ priority เพื่อค้นหาค่า queue_id
      (queueError, queueResults) => {
        if (queueError) {
          console.error('Error retrieving queue information:', queueError);
          return res.status(500).send('Error retrieving queue information');
        }

        if (!queueResults || queueResults.length === 0) {
          // ถ้าไม่พบ queue_id ให้ส่ง 0 กลับไปแทน
          console.log('No queue found for the given username and priority.');
          return res.render('staff/ticketsByPriority', { tickets: [], priority, searchTerm });
        }

        const queueIds = queueResults.map(result => result.queue_id);  // ได้ queue_id ที่ตรงกับ username และ priority
        console.log('Queue IDs retrieved:', queueIds);  // ล็อกค่า queueIds

        // สร้างคำสั่ง SQL เพื่อดึง ticket ที่ตรงกับ queue_id และคำค้นหาใน title
        query = `
          SELECT tickets.* 
          FROM tickets 
          WHERE tickets.queue_id IN (?) AND tickets.title LIKE ? 
        `;
        
        // ถ้า searchTerm เป็นค่าว่าง, ใช้ '%' สำหรับการค้นหาทุก ticket
        const searchPattern = searchTerm ? `%${searchTerm}%` : '%';
        
        params = [queueIds, searchPattern];

        // รันคำสั่ง query
        db.query(query, params, (error, results) => {
          if (error) {
            console.error('Database query error:', error);
            return res.status(500).send('Server Error');
          }

          if (results.length === 0) {
            // ถ้าไม่พบ ticket ที่ตรงกับเงื่อนไข ให้ส่ง 0 กลับไปแทน
            console.log('No tickets found for the specified priority and queue.');
            return res.render('staff/ticketsByPriority', { tickets: [], priority, searchTerm });
          }

          console.log(`Found ${results.length} tickets matching the criteria.`);

          // ส่งผลลัพธ์ไปยัง view
          res.render('staff/ticketsByPriority', { tickets: results, priority, searchTerm });
        });
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
      res.render('staff/faq', { faqs: results, searchTerm: '' });
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
      res.render('staff/faqDetail', { faq: results[0] });
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
      res.render('staff/faq', { faqs: results, searchTerm });
    });
  };
  