const db = require('../config/db');

// แสดงตั๋วที่ได้รับมอบหมายให้กับพนักงานที่ล็อกอิน
exports.viewAssignedTickets = (req, res) => {
    const { user_id, username, role } = req.session.user;
    const { status, priority } = req.query; // รับค่า status และ priority จาก query parameters

    // ขั้นตอนที่ 1: หา staff_id ของผู้ใช้จากชื่อ (username)
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

            // ขั้นตอนที่ 2: สร้าง query เริ่มต้นเพื่อดึงข้อมูลตั๋วที่ได้รับมอบหมายจากคิวของพนักงาน
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

            // เพิ่มเงื่อนไขกรองตามสถานะและความสำคัญ
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

            query += ` ORDER BY tickets.created_at DESC`; // เพิ่มการจัดเรียงตามวันที่สร้าง

            db.query(query, params, (ticketError, ticketResults) => {
                if (ticketError) {
                    console.error('Error fetching assigned tickets:', ticketError);
                    return res.status(500).send('Error fetching assigned tickets');
                }

                // ส่งผลลัพธ์ไปยังหน้า staff/tickets โดยที่มีข้อมูลตั๋วและฟิลเตอร์ที่เลือก
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

// แสดงรายละเอียดของตั๋วที่ได้รับมอบหมายให้กับพนักงานที่ล็อกอิน
exports.viewTicketDetail = (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10);
  if (isNaN(ticketId)) {
      return res.status(400).send('Invalid ticket ID');
  }

  const { username } = req.session.user;

  // ขั้นตอนที่ 1: หา staff_id ของผู้ใช้จากชื่อ (username)
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

          // ขั้นตอนที่ 2: ดึงรายละเอียดตั๋วหากได้รับมอบหมายให้กับคิวของพนักงานนี้
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

                  // ส่งผลลัพธ์ไปยังหน้า staff/ticketDetail เพื่อแสดงข้อมูลตั๋ว
                  res.render('staff/ticketDetail', { ticket: ticketResults[0] });
              }
          );
      }
  );
};

// อัปเดตสถานะของตั๋ว
exports.setStatus = (req, res) => {
    const ticketId = parseInt(req.params.ticket_id, 10);
    const { status } = req.body;
    const { username } = req.session.user;

    // ตรวจสอบค่า status ที่ได้รับ
    const validStatuses = ['In Progress', 'Pending', 'Resolved', 'Closed', 'Reopened', 'Escalated'];
    if (!validStatuses.includes(status)) {
        console.error('Invalid status value received:', status);
        return res.status(400).send('Invalid status value');
    }

    // ดึง staff_id จากชื่อผู้ใช้
    db.query(
        `SELECT staff_id FROM staff WHERE name = ?`,
        [username],
        (staffError, staffResults) => {
            if (staffError || staffResults.length === 0) {
                console.error('Error retrieving staff ID:', staffError);
                return res.status(500).send('Error retrieving staff information');
            }

            const staff_id = staffResults[0].staff_id;

            // ตรวจสอบว่าพนักงานได้รับมอบหมายให้กับตั๋วนี้หรือไม่
            db.query(
                `SELECT * FROM staff_has_ticket WHERE staff_id = ? AND ticket_id = ?`,
                [staff_id, ticketId],
                (checkError, checkResults) => {
                    if (checkError) {
                        console.error('Error checking ticket assignment:', checkError);
                        return res.status(500).send('Error checking ticket assignment');
                    }

                    if (checkResults.length === 0) {
                        // ถ้ายังไม่ถูกมอบหมายให้พนักงาน ให้เพิ่มการมอบหมาย
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
                        // ถ้ามีการมอบหมายแล้ว ให้ปรับปรุงเวลาการมอบหมาย
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

                    // ฟังก์ชันเพื่ออัปเดตสถานะของตั๋ว
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

// การแสดงตั๋วที่แบ่งตาม priority
exports.setPriority = (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10);
  const { priority } = req.body;
  const { username } = req.session.user;

  // ค้นหา queue_id ของพนักงานที่ตรงกับชื่อผู้ใช้
  db.query(
      `SELECT queue_id FROM queue WHERE name = ?`,
      [username],
      (queueError, queueResults) => {
          if (queueError || queueResults.length === 0) {
              console.error('Error retrieving queue ID for staff:', queueError);
              return res.status(500).send('Error retrieving queue information');
          }

          const queue_id = queueResults[0].queue_id;

          // ปรับปรุง priority ในตาราง queue
          db.query(
              `UPDATE queue SET priority = ? WHERE queue_id = ?`,
              [priority, queue_id],
              (priorityError, priorityResults) => {
                  if (priorityError) {
                      console.error('Error updating priority:', priorityError);
                      return res.status(500).send('Error updating priority');
                  }

                  console.log('Priority updated successfully for queue_id:', queue_id);
                  res.status(200).send('Priority updated successfully');
              }
          );
      }
  );
};

// แสดงหน้าจอสถานะของตั๋วสำหรับพนักงาน
exports.status = (req, res) => {
  res.render('staff/status');
};

// ฟังก์ชันดึงข้อมูลตั๋วตามสถานะที่พนักงานเลือก
exports.getTicketsByStatus = (req, res) => {
    const status = req.params.status; // รับค่าจาก URL ว่าจะดูตั๋วในสถานะอะไร เช่น open, pending, resolved, closed
    const searchTerm = req.query.search || ''; // รับคำค้นหาจาก query parameters หรือกำหนดเป็นค่าว่างถ้าไม่มี
    const { username } = req.session.user;  // ดึง username ของพนักงานที่ล็อกอินเข้ามา
    let query;  // ตัวแปรสำหรับเก็บ query ที่จะรัน
    let params = [];  // ตัวแปรสำหรับเก็บค่าที่จะนำไปใช้ใน query

    // หา queue_id ที่ตรงกับชื่อผู้ใช้ (username)
    db.query(
        `SELECT queue_id FROM queue WHERE name = ?`,
        [username],  // ค้นหาจากชื่อของพนักงาน
        (queueError, queueResults) => {
          if (queueError || queueResults.length === 0) { // ถ้ามีข้อผิดพลาดหรือตัวแปร queueResults เป็นค่าว่าง
            console.error('Error retrieving queue IDs:', queueError);
            return res.status(500).send('Error retrieving queue information');
          }
      
          // ดึง queue_id ทั้งหมดเป็นอาร์เรย์
          const queueIds = queueResults.map(result => result.queue_id);
      
          // สร้าง query ตามสถานะที่เลือก เช่น open, pending, resolved, closed
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
      
          // รันคำสั่ง query ที่เตรียมไว้
          db.query(query, params, (error, results) => {
              if (error) {
                  console.error('Database query error:', error);
                  return res.status(500).send('Server Error');
              }
              // ส่งผลลัพธ์ไปยัง view 'staff/statusPage' เพื่อแสดงข้อมูลตั๋วที่ค้นหาได้
              res.render('staff/statusPage', { tickets: results, status, searchTerm });
          });
        }
      );
};

// แสดงหน้าจอจัดการคิวสำหรับพนักงาน
exports.queue = (req, res) => {
  res.render('staff/queue');
};

// ฟังก์ชันดึงข้อมูลตั๋วตามความสำคัญ (priority) ของคิว
exports.getTicketsByPriority = (req, res) => {
    const priority = req.params.priority;  // รับค่าความสำคัญจาก URL เช่น 'low', 'medium', 'high', 'urgent'
    let searchTerm = req.query.search || '';  // รับคำค้นหาจาก query string หรือกำหนดเป็นค่าว่างถ้าไม่มี

    const { username } = req.session.user;  // ดึง username ของพนักงานที่ล็อกอินเข้ามา

    let query;  // ตัวแปรสำหรับเก็บ query
    let params = [];  // ตัวแปรสำหรับเก็บค่าพารามิเตอร์

    // ค้นหาคิวที่ตรงกับ username และ priority ที่พนักงานเลือก
    db.query(
      `SELECT queue_id FROM queue WHERE name = ? AND priority = ?`,
      [username, priority], // ใช้ username และ priority เพื่อค้นหาคิว
      (queueError, queueResults) => {
        if (queueError) { // ถ้ามีข้อผิดพลาดในการค้นหาคิว
          console.error('Error retrieving queue information:', queueError);
          return res.status(500).send('Error retrieving queue information');
        }

        if (!queueResults || queueResults.length === 0) { // ถ้าไม่พบคิวที่ตรงกับเงื่อนไข
          console.log('No queue found for the given username and priority.');
          return res.render('staff/ticketsByPriority', { tickets: [], priority, searchTerm });
        }

        const queueIds = queueResults.map(result => result.queue_id);  // ได้ queue_id ที่ตรงกับชื่อและความสำคัญของพนักงาน
        console.log('Queue IDs retrieved:', queueIds);  // ล็อกค่า queueIds

        // สร้างคำสั่ง SQL เพื่อดึง ticket ตาม queue_id และคำค้นหาใน title
        query = `
          SELECT tickets.* 
          FROM tickets 
          WHERE tickets.queue_id IN (?) AND tickets.title LIKE ? 
        `;
        
        // ถ้า searchTerm เป็นค่าว่าง, ใช้ '%' เพื่อค้นหาทุก ticket
        const searchPattern = searchTerm ? `%${searchTerm}%` : '%';
        
        params = [queueIds, searchPattern];

        // รันคำสั่ง query
        db.query(query, params, (error, results) => {
          if (error) {
            console.error('Database query error:', error);
            return res.status(500).send('Server Error');
          }

          if (results.length === 0) { // ถ้าไม่พบผลลัพธ์ที่ตรงกับเงื่อนไข
            console.log('No tickets found for the specified priority and queue.');
            return res.render('staff/ticketsByPriority', { tickets: [], priority, searchTerm });
          }

          console.log(`Found ${results.length} tickets matching the criteria.`);

          // ส่งผลลัพธ์ไปยัง view 'staff/ticketsByPriority' เพื่อแสดงข้อมูลตั๋วที่ค้นหาได้
          res.render('staff/ticketsByPriority', { tickets: results, priority, searchTerm });
        });
      }
    );
};

// ฟังก์ชันดึงรายการ FAQ ทั้งหมด
exports.getFaqList = (req, res) => {
    const query = 'SELECT knowledge_base_id, title FROM knowledgebase';
    db.query(query, (err, results) => {
      if (err) { // ถ้ามีข้อผิดพลาดในการดึงข้อมูล
        console.error('Error fetching FAQ list:', err);
        return res.status(500).send('Server error');
      }
      // ส่งผลลัพธ์ไปยังหน้า FAQ โดยมีคำค้นหาตั้งต้นเป็นค่าว่าง
      res.render('staff/faq', { faqs: results, searchTerm: '' });
    });
  };
  
  // ฟังก์ชันดึงรายละเอียด FAQ ตาม ID
  exports.getFaqDetail = (req, res) => {
    const faqId = parseInt(req.params.id, 10); // แปลง ID ที่รับมาจาก URL เป็นตัวเลข
    const query = 'SELECT title, content FROM knowledgebase WHERE knowledge_base_id = ?';
    db.query(query, [faqId], (err, results) => {
      if (err) { // ถ้ามีข้อผิดพลาดในการดึงข้อมูล
        console.error('Error fetching FAQ detail:', err);
        return res.status(500).send('Server error');
      }
      if (results.length === 0) { // ถ้าไม่พบ FAQ ตาม ID
        return res.status(404).send('FAQ not found');
      }
      res.render('staff/faqDetail', { faq: results[0] });
    });
  };
  
  // ฟังก์ชันค้นหา FAQ ตามคำค้นหา
  exports.searchFaqs = (req, res) => {
    const searchTerm = req.query.search || ''; // รับคำค้นหาจาก query string
    const query = `SELECT knowledge_base_id, title FROM knowledgebase WHERE title LIKE ?`;
    db.query(query, [`%${searchTerm}%`], (err, results) => {
      if (err) { // ถ้ามีข้อผิดพลาดในการค้นหา
        console.error('Error searching FAQs:', err);
        return res.status(500).send('Server error');
      }
      res.render('staff/faq', { faqs: results, searchTerm }); // ส่งผลลัพธ์กลับไปยังหน้า FAQ
    });
  };
