const db = require('../config/db');

// ฟังก์ชันเพื่อดึงข้อมูลตั๋วตามช่วงเวลา
exports.getDashboard = (req, res) => {
  // รับช่วงเวลาจาก query string หรือใช้ค่าเริ่มต้นเป็น 'daily' (รายวัน)
  const { period = 'daily' } = req.query;

  // คำนวณวันที่เริ่มต้นตามช่วงเวลา
  let startDate;
  const currentDate = new Date();
  switch (period) {
    case 'daily':
      // สำหรับรายวัน ตั้งค่าตั้งแต่เมื่อวาน
      startDate = new Date(currentDate.setDate(currentDate.getDate() - 1));
      break;
    case 'weekly':
      // สำหรับรายสัปดาห์ ตั้งค่าเป็น 7 วันที่ผ่านมา
      startDate = new Date(currentDate.setDate(currentDate.getDate() - 7));
      break;
    case 'monthly':
      // สำหรับรายเดือน ตั้งค่าเป็น 1 เดือนที่ผ่านมา
      startDate = new Date(currentDate.setMonth(currentDate.getMonth() - 1));
      break;
    default:
      // ถ้าไม่มีค่าเริ่มต้น ใช้รายวัน
      startDate = new Date(currentDate.setDate(currentDate.getDate() - 1));
  }

  const stats = {};

  // Query ดึงข้อมูลตั๋วใหม่ (ตั๋วที่สร้างหลังจาก startDate)
  db.query(
    "SELECT COUNT(*) AS count FROM tickets WHERE created_at >= ?",
    [startDate],
    (error, results) => {
      if (error) {
        console.error("Error fetching New ticket stats:", error.message);
        return res.status(500).send("Error fetching ticket stats");
      }
      stats.newTickets = results[0].count;

      // Query ดึงข้อมูลตั๋วที่เปิดอยู่ (Open, Reopened, Assigned, Pending) อัปเดตหลังจาก startDate
      db.query(
        "SELECT COUNT(*) AS count FROM tickets WHERE status IN ('Open', 'Reopened', 'Assigned', 'Pending') AND updated_at >= ?",
        [startDate],
        (error, results) => {
          if (error) {
            console.error("Error fetching Open ticket stats:", error.message);
            return res.status(500).send("Error fetching ticket stats");
          }
          stats.pendingTickets = results[0].count;

          // Query ดึงข้อมูลตั๋วที่ถูกแก้ไขแล้ว (Resolved)
          db.query(
            "SELECT COUNT(*) AS count FROM tickets WHERE status = 'Resolved' AND updated_at >= ?",
            [startDate],
            (error, results) => {
              if (error) {
                console.error("Error fetching Resolved ticket stats:", error.message);
                return res.status(500).send("Error fetching ticket stats");
              }
              stats.resolvedTickets = results[0].count;

              // Query ดึงข้อมูลตั๋วที่ปิดไปแล้ว (Closed)
              db.query(
                "SELECT COUNT(*) AS count FROM tickets WHERE status = 'Closed' AND updated_at >= ?",
                [startDate],
                (error, results) => {
                  if (error) {
                    console.error("Error fetching Closed ticket stats:", error.message);
                    return res.status(500).send("Error fetching ticket stats");
                  }
                  stats.closedTickets = results[0].count;

                  // Query ดึงข้อมูลรายงานทั้งหมด
                  db.query("SELECT * FROM report", (error, reportResults) => {
                    if (error) {
                      console.error("Error fetching reports:", error.message);
                      return res.status(500).send("Error fetching reports");
                    }

                    // แสดงผลหน้าแดชบอร์ด พร้อมข้อมูลที่ได้รับ
                    res.render('admin/dashboard', {
                      period,
                      newTickets: stats.newTickets,
                      pendingTickets: stats.pendingTickets,
                      resolvedTickets: stats.resolvedTickets,
                      closedTickets: stats.closedTickets,
                      reports: reportResults // ส่งข้อมูลรายงานไปที่แดชบอร์ด
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

// ฟังก์ชันเพื่อแสดงฟอร์มการเพิ่มรายงาน
exports.showAddReportForm = (req, res) => {

  const adminName = req.session.user.username; // ดึงชื่อผู้ดูแลจาก session

  res.render('admin/addReport', { adminName }); // ส่งข้อมูลชื่อผู้ดูแลไปที่ view
};

// ฟังก์ชันสำหรับเพิ่มรายงานใหม่
exports.addReport = (req, res) => {
  // ตรวจสอบว่าผู้ใช้มีสิทธิ์เป็นผู้ดูแลระบบ

  const { title, content } = req.body;
  const adminName = req.session.user.username;
  // ดึงชื่อผู้ดูแลจาก session

  db.query(
      "INSERT INTO report (admin_name, title, content, status) VALUES (?, ?, ?, 'show')",
      [adminName, title, content],
      (error, results) => {
          if (error) {
              console.error("Error adding report:", error.message);
              return res.status(500).send("Error adding report");
          }
          res.redirect('/admin/dashboard'); // กลับไปที่หน้าแดชบอร์ดหลังจากเพิ่มรายงานเสร็จ
      }
  );
};
// ฟังก์ชันสำหรับดึงข้อมูลรายงานที่มีสถานะ 'show' เพื่อนำไปแสดงในหน้าแดชบอร์ด
exports.getReports = (req, res) => {
  db.query(
      "SELECT * FROM report WHERE status = 'show'", // Query เพื่อดึงข้อมูลรายงานที่แสดงผลอยู่
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
  const reportId = req.params.id; // รับค่า reportId จาก URL

  db.query(
      "SELECT * FROM report WHERE report_id = ?", // Query เพื่อดึงรายละเอียดรายงานตาม report_id
      [reportId],
      (error, results) => {
          if (error) {
              console.error("Error fetching report details:", error.message);
              return res.status(500).send("Error fetching report details");
          }
          // ตรวจสอบว่าพบรายงานหรือไม่
          if (results.length === 0) {
              return res.status(404).send("Report not found");
          }
          res.render('admin/reportDetails', { report: results[0] }); // ส่งข้อมูลรายงานไปที่ view
      }
  );
};

// ฟังก์ชันสำหรับแก้ไขรายงาน
exports.updateReport = (req, res) => {
  const reportId = req.params.id; // รับค่า reportId จาก URL
  const { title, content, status } = req.body; // รับข้อมูล title, content และ status จาก form

  db.query(
      "UPDATE report SET title = ?, content = ?, status = ? WHERE report_id = ?", // Query สำหรับอัปเดตข้อมูลรายงานตาม report_id
      [title, content, status, reportId],
      (error, results) => {
          if (error) {
              console.error("Error updating report:", error.message);
              return res.status(500).send("Error updating report");
          }
          res.redirect(`/admin/dashboard`); // กลับไปที่หน้าแดชบอร์ดหลังจากแก้ไขรายงานเสร็จ
      }
  );
};

// ฟังก์ชันสำหรับแสดงข้อมูลตั๋ว พร้อมตัวกรองตามสถานะและลำดับความสำคัญ
exports.viewTickets = (req, res) => {
  const { status, priority } = req.query; // รับค่า status และ priority จาก query string

  // Query พื้นฐานสำหรับดึงข้อมูลตั๋ว
  let query = `
      SELECT tickets.ticket_id, tickets.title, tickets.status, tickets.created_at, 
             IFNULL(tickets.updated_at, tickets.created_at) AS display_updated_at,
             tickets.user_id, users.username, users.email,
             queue.priority, queue.name AS agent_name
      FROM tickets
      LEFT JOIN users ON tickets.user_id = users.user_id
      LEFT JOIN queue ON tickets.queue_id = queue.queue_id
      WHERE 1=1`; // ใช้ WHERE 1=1 เพื่อให้ง่ายในการเพิ่มเงื่อนไขใน query

  let params = [];

  // เพิ่มเงื่อนไขตัวกรองสถานะ
  if (status && status !== 'all') {
      switch (status) {
          case 'open':
              query += ` AND tickets.status IN (?, ?)`; // ตัวกรองสถานะ open
              params.push('New', 'Reopened');
              break;
          case 'pending':
              query += ` AND tickets.status IN (?, ?, ?)`; // ตัวกรองสถานะ pending
              params.push('In Progress', 'Pending', 'Assigned');
              break;
          case 'resolved':
              query += ` AND tickets.status = ?`; // ตัวกรองสถานะ resolved
              params.push('Resolved');
              break;
          case 'closed':
              query += ` AND tickets.status = ?`; // ตัวกรองสถานะ closed
              params.push('Closed');
              break;
          default:
              return res.status(400).send('Invalid status'); // กรณีที่สถานะไม่ถูกต้อง
      }
  }

  // เพิ่มเงื่อนไขตัวกรองลำดับความสำคัญ
  if (priority && priority !== 'all') {
      query += ` AND queue.priority = ?`;
      params.push(priority);
  }

  // เรียงลำดับข้อมูลตามวันที่สร้างในลำดับจากมากไปน้อย
  query += ` ORDER BY tickets.created_at DESC`;

  // Execute query เพื่อนำข้อมูลตั๋วมาแสดง
  db.query(query, params, (error, results) => {
      if (error) {
          console.error('Database query error:', error);
          return res.status(500).send('Error retrieving tickets');
      }

      // แสดงผลหน้าตั๋วใน admin view พร้อมตัวกรอง
      res.render('admin/tickets', {
          tickets: results,
          selectedStatus: status || 'all',
          selectedPriority: priority || 'all'
      });
  });
};

// ฟังก์ชันแสดงรายละเอียดของตั๋วแต่ละรายการ
exports.viewTicketDetail = (req, res) => {
    const ticketId = parseInt(req.params.ticket_id, 10); // ดึงค่า ticket_id จาก URL

    db.query(
      `SELECT t.ticket_id, t.title, t.description, t.status, t.created_at, t.updated_at,
              t.queue_id,
              u.user_id, u.username, u.email
       FROM tickets t
       JOIN users u ON t.user_id = u.user_id
       WHERE t.ticket_id = ?`, // Query เพื่อดึงรายละเอียดตั๋วตาม ticket_id
      [ticketId],
      (error, result) => {
          console.log("Ticket ID:", ticketId); // แสดง ticket ID ใน console
          console.log("Query result:", result); // แสดงผลการ query ใน console
          
          if (error) {
              console.error('Error retrieving ticket details:', error);
              return res.status(500).send('Error retrieving ticket details');
          }
          if (result.length === 0) {
              return res.status(404).send('Ticket not found'); // ถ้าไม่พบตั๋ว
          }
  
          res.render('admin/ticketDetail', { ticket: result[0] }); // ส่งข้อมูลตั๋วไปยังหน้าแสดงรายละเอียด
      }
  );
};
// ฟังก์ชันสำหรับตั้งค่าลำดับความสำคัญของตั๋ว
exports.setPriority = (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10); // รับค่า ticketId จาก URL
  const { priority } = req.body; // รับค่า priority จาก body ของ request

  console.log('Received request to update priority. Ticket ID:', ticketId, 'Priority:', priority); // Log ค่าที่ได้รับ

  // ตรวจสอบค่าความสำคัญที่ถูกต้อง
  const validPriorities = ['urgent', 'high', 'medium', 'low'];
  if (!validPriorities.includes(priority)) {
    console.error('Invalid priority value received:', priority); // Log ค่าความสำคัญที่ไม่ถูกต้อง
    return res.status(400).send('Invalid priority value');
  }

  console.log('Updating ticket:', ticketId, 'with priority:', priority); // Log สำหรับ debugging

  // ขั้นตอนที่ 1: ดึงค่า queue_id จากตั๋ว
  db.query(
    `SELECT queue_id FROM tickets WHERE ticket_id = ?`, // Query เพื่อดึง queue_id จากตั๋วตาม ticket_id
    [ticketId],
    (err, results) => {
      if (err) {
        console.error('Error retrieving queue_id:', err);
        return res.status(500).send('Error retrieving queue_id');
      }

      if (results.length === 0) {
        console.error('No ticket found with ticket_id:', ticketId); // Log หากไม่พบ ticket
        return res.status(404).send('Ticket not found');
      }

      const queueId = results[0].queue_id; // รับค่า queue_id
      console.log('Retrieved queue_id:', queueId); // Log queue_id ที่ได้รับ

      // ขั้นตอนที่ 2: ตรวจสอบว่า queue_id มีอยู่ในตาราง queue หรือไม่
      db.query(
        `SELECT * FROM queue WHERE queue_id = ?`,
        [queueId],
        (checkError, checkResults) => {
          if (checkError) {
            console.error('Error checking queue existence:', checkError);
            return res.status(500).send('Error checking queue existence');
          }

          if (checkResults.length === 0) {
            console.error('Queue not found for queue_id:', queueId); // Log หากไม่พบ queue
            return res.status(404).send('Queue not found');
          }

          // ขั้นตอนที่ 3: อัปเดตลำดับความสำคัญในตาราง queue
          db.query(
            `UPDATE queue SET priority = ? WHERE queue_id = ?`, // Query สำหรับอัปเดต priority
            [priority, queueId],
            (queueError, updateResult) => {
              if (queueError) {
                console.error('Queue update error:', queueError);
                return res.status(500).send('Failed to update queue priority');
              }

              // ตรวจสอบว่าแถวไหนถูกอัปเดตบ้าง
              if (updateResult.affectedRows === 0) {
                console.error('No rows updated for queue_id:', queueId); // Log หากไม่มีแถวไหนถูกอัปเดต
                return res.status(404).send('Queue not found for update');
              }

              console.log('Priority updated successfully for ticket ID:', ticketId); // Log ความสำเร็จ
              res.status(200).send('Priority updated successfully'); // ส่ง response ความสำเร็จ
            }
          );
        }
      );
    }
  );
};

// ฟังก์ชันสำหรับตั้งค่าสถานะของตั๋ว
exports.setStatus = (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10); // รับค่า ticketId จาก URL
  const { status } = req.body; // รับค่า status จาก body ของ request

  console.log('Received request to update status. Ticket ID:', ticketId, 'Status:', status); // Log ค่าที่ได้รับ

  // ตรวจสอบค่าสถานะที่ถูกต้อง
  const validStatuses = ['In Progress', 'Pending', 'Resolved', 'Closed', 'Reopened', 'Escalated'];
  if (!validStatuses.includes(status)) {
      console.error('Invalid status value received:', status); // Log ค่าสถานะที่ไม่ถูกต้อง
      return res.status(400).send('Invalid status value');
  }

  console.log('Updating ticket:', ticketId, 'with status:', status); // Log สำหรับ debugging

  // อัปเดตสถานะของตั๋วและเวลาที่อัปเดตล่าสุดในฐานข้อมูล
  db.query(
      `UPDATE tickets SET status = ?, updated_at = NOW() WHERE ticket_id = ?`,
      [status, ticketId],
      (error, results) => {
          if (error) {
              console.error('Error updating ticket status:', error);
              return res.status(500).send('Failed to update ticket status');
          }

          if (results.affectedRows === 0) {
              console.error('No rows updated for ticket_id:', ticketId); // Log หากไม่มีแถวไหนถูกอัปเดต
              return res.status(404).send('Ticket not found for update');
          }

          console.log('Status updated successfully for ticket ID:', ticketId); // Log ความสำเร็จ
          res.status(200).send('Status updated successfully'); // ส่ง response ความสำเร็จ
      }
  );
};

// ฟังก์ชันเพื่อแสดงหน้าเลือกพนักงาน
exports.getStaffSelection = (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10); // รับค่า ticketId จาก URL

  // ดึงรายการพนักงานจากฐานข้อมูล
  db.query('SELECT * FROM staff', (error, staffList) => {
    if (error) {
        console.error('Error fetching staff list:', error); // Log ข้อผิดพลาด
        return res.status(500).send('Error fetching staff list');
    }
    // Log รายการพนักงานที่ได้รับ
    console.log('Fetched staff list:', staffList);
    // แสดงหน้าเลือกพนักงานพร้อมกับ ticketId และ staffList
    res.render('admin/select-staff', { ticketId, staffList });
  });
};

// ฟังก์ชันสำหรับมอบหมายพนักงานให้กับตั๋ว
exports.assignStaffToTicket = (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10); // รับค่า ticketId จาก URL
  const staffId = parseInt(req.body.staff_id, 10); // รับค่า staffId จาก body ของ request

  console.log('Received ticketId:', ticketId);
  console.log('Received staff_id:', staffId);

  // ขั้นตอนที่ 1: ดึง queue_id จากตาราง ticket โดยใช้ ticketId
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

    // ขั้นตอนที่ 2: ลบแถวที่มี queue_id เดียวกันในตาราง staff_has_queue
    db.query('DELETE FROM staff_has_queue WHERE queue_id = ?', [queueId], (deleteError, deleteResults) => {
      if (deleteError) {
        console.error('Error deleting rows from staff_has_queue:', deleteError);
        return res.status(500).send('Failed to delete rows from staff_has_queue');
      }
      console.log('Deleted existing rows with queue_id:', queueId);
      
      // เรียกใช้ฟังก์ชันเพื่อเพิ่มแถวใหม่สำหรับการจับคู่ staff_id กับ queue_id
      insertNewStaffQueue(ticketId, queueId, staffId, res);
    });
  });
};

// ฟังก์ชันช่วยเหลือสำหรับเพิ่มแถวใหม่ในตาราง staff_has_queue
function insertNewStaffQueue(ticketId, queueId, staffId, res) {
  db.query('INSERT INTO staff_has_queue (queue_id, staff_id) VALUES (?, ?)', [queueId, staffId], (insertError, insertResults) => {
    if (insertError) {
      console.error('Error inserting new staff_has_queue row:', insertError);
      return res.status(500).send('Failed to insert new staff_has_queue row');
    }

    // ขั้นตอนที่ 4: อัปเดตชื่อพนักงานในตาราง queue
    db.query('SELECT name FROM staff WHERE staff_id = ?', [staffId], (nameError, nameResults) => {
      if (nameError) {
        console.error('Error fetching staff name:', nameError);
        return res.status(500).send('Failed to fetch staff name');
      }

      const staffName = nameResults[0].name;

      // อัปเดตชื่อพนักงานในตาราง queue
      db.query('UPDATE queue SET name = ? WHERE queue_id = ?', [staffName, queueId], (updateError, updateResults) => {
        if (updateError) {
          console.error('Error updating queue:', updateError);
          return res.status(500).send('Failed to update queue');
        }

        console.log('Queue updated successfully with new staff name');

        // ขั้นตอนที่ 5: อัปเดตสถานะตั๋วเป็น 'Assigned'
        db.query('UPDATE tickets SET status = ? WHERE ticket_id = ?', ['Assigned', ticketId], (statusError, statusResults) => {
          if (statusError) {
            console.error('Error updating ticket status:', statusError);
            return res.status(500).send('Failed to update ticket status');
          }

          console.log('Ticket status updated to Assigned');
          res.status(200).send('Queue updated, staff assigned, and ticket status set to Assigned');
        });
      });
    });
  });
}


// ฟังก์ชันสำหรับแสดงหน้าสถานะ
exports.status = (req, res) => {
  res.render('admin/status');
};

// ฟังก์ชันสำหรับดึงตั๋วตามสถานะ
exports.getTicketsByStatus = (req, res) => {
  const status = req.params.status; // รับค่าสถานะจาก URL
  const searchTerm = req.query.search || ''; // รับคำค้นหาจาก query parameters
  let query;
  let params = [];

  // สร้าง query ตามสถานะที่ระบุ
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

  // รัน query
  db.query(query, params, (error, results) => {
      if (error) {
          console.error('Database query error:', error);
          return res.status(500).send('Server Error');
      }
      res.render('admin/statusPage', { tickets: results, status, searchTerm }); // ส่งค่า searchTerm ให้กับ view
  });
};


// ฟังก์ชันสำหรับแสดงหน้า queue
exports.queue = (req, res) => {
  res.render('admin/queue');
};

// ฟังก์ชันสำหรับดึงข้อมูลตั๋วตามลำดับความสำคัญ
exports.getTicketsByPriority = (req, res) => {
  const priority = req.params.priority;  // รับค่า priority จาก URL เช่น 'low', 'medium', 'high', 'urgent'
  const searchQuery = req.query.search || '';  // รับคำค้นหาจาก query string

  // Query เพื่อค้นหา queue_id ที่มีลำดับความสำคัญตรงกับ priority
  const queueQuery = 'SELECT queue_id FROM queue WHERE priority = ?';

  db.query(queueQuery, [priority], (queueError, queueResults) => {
      if (queueError) {
          console.error('Error retrieving queue_id:', queueError);
          return res.status(500).send('Server Error');
      }

      if (!queueResults || queueResults.length === 0) {
          // ถ้าไม่พบ queue_id ที่ตรงกับ priority
          console.log(`No queue found for priority: ${priority}`);
          return res.render('admin/ticketsByPriority', { tickets: [], priority, searchQuery });
      }

      // ดึง queue_id ทั้งหมดที่ตรงกับ priority เป็น array
      const queueIds = queueResults.map(result => result.queue_id);

      console.log('Queue IDs:', queueIds);  // เพิ่ม log เพื่อแสดงค่า queue_ids ที่ได้

      // Query สำหรับค้นหาตั๋วที่มี queue_id ที่อยู่ใน array queueIds และตรงกับคำค้นหา
      const query = 'SELECT * FROM tickets WHERE queue_id IN (?) AND title LIKE ?';

      db.query(query, [queueIds, `%${searchQuery}%`], (error, results) => {
          if (error) {
              console.error('Database query error:', error);
              return res.status(500).send('Server Error');
          }

          // ส่งผลลัพธ์กลับไปยัง view
          res.render('admin/ticketsByPriority', { tickets: results, priority, searchQuery });
      });
  });
};


// ฟังก์ชันสำหรับดึงข้อมูลผู้ใช้ทั้งหมดและนับจำนวนผู้ใช้ตาม role
exports.getAllUsers = (req, res) => {
const roles = ['all', 'admin', 'staff', 'user'];  // รายชื่อ role ที่ต้องการนับ
const counts = {};

// กำหนดค่าเริ่มต้นสำหรับการนับของแต่ละ role เป็น 0
roles.forEach(role => {
    counts[role] = 0;
});

// ใช้ Promise เพื่อดึงข้อมูลและนับจำนวนผู้ใช้ตาม role
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

// รอให้ Promise ทั้งหมดทำงานเสร็จและแสดงผลลัพธ์
Promise.all(promises)
    .then(() => {
        res.render('admin/userList', { userCounts: counts });
    })
    .catch(err => {
        res.status(500).send(err);
    });
};

// ฟังก์ชันสำหรับดึงข้อมูลผู้ใช้ตาม role
exports.getUsersByRole = (req, res) => {
const role = req.params.role;  // รับค่า role จาก URL
let displayRole = 'All Role'; // กำหนดชื่อ role ที่จะแสดงเป็นค่าเริ่มต้น

if (role === 'all') {
    // ถ้า role เป็น 'all' ให้ดึงข้อมูลผู้ใช้ทั้งหมด
    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        // ส่งค่า displayRole ให้กับ template
        res.render('admin/userbyrolePage', { users: results, displayRole });
    });
} else {
    // ถ้า role เป็นค่าอื่นๆ ให้ดึงข้อมูลผู้ใช้เฉพาะ role นั้นๆ
    db.query('SELECT * FROM users WHERE role = ?', [role], (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        displayRole = role; // กำหนดค่า displayRole ให้ตรงกับ role ที่ระบุ
        res.render('admin/userbyrolePage', { users: results, displayRole });
    });
}
};

// ฟังก์ชันสำหรับค้นหาผู้ใช้ตาม username
exports.searchUser = (req, res) => {
const username = req.query.username; // รับค่า username จาก query string

// Query เพื่อค้นหาผู้ใช้ที่มี username ตรงกับคำค้นหา
db.query('SELECT * FROM users WHERE username LIKE ?', [`%${username}%`], (err, results) => {
    if (err) {
        return res.status(500).send(err);
    }
    res.render('admin/userbyrolePage', { users: results, displayRole: 'Search Results' });
});
};

// ฟังก์ชันสำหรับดึงข้อมูลผู้ใช้เฉพาะ ID เพื่อนำไปแก้ไข
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

// ฟังก์ชันสำหรับอัปเดตข้อมูลผู้ใช้
exports.updateUser = (req, res) => {
const userId = req.params.userId;
const { username, email, password, role } = req.body; // รับค่า role ในการ destructuring

// Query สำหรับอัปเดตข้อมูลผู้ใช้
const sql = 'UPDATE users SET username = ?, email = ?, password = ?, role = ? WHERE user_id = ?';
db.query(sql, [username, email, password, role, userId], (err, results) => {
    if (err) {
        return res.status(500).send(err);
    }
    res.redirect('/admin/userList'); // เปลี่ยนเส้นทางไปยังหน้ารายการผู้ใช้หลังจากอัปเดตเสร็จ
});
};

// ฟังก์ชันสำหรับแสดงหน้าเพิ่มผู้ใช้ใหม่
exports.showNewUserForm = (req, res) => {
// แสดงหน้า newUser โดยไม่ต้องมี error message
res.render('admin/newUser', { error: null });
};

// ฟังก์ชันสำหรับสร้างผู้ใช้ใหม่
exports.createUser = (req, res) => {
const { username, email, password, confirm_password, role } = req.body;

// ตรวจสอบว่ารหัสผ่านที่ป้อนตรงกันหรือไม่
if (password !== confirm_password) {
    return res.render('admin/newUser', { error: 'Passwords do not match' });
}

// Query สำหรับเพิ่มผู้ใช้ใหม่ในตาราง users
const query = `
    INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)
`;
db.query(query, [username, email, password, role], (err, results) => {
    if (err) {
        console.error(err);
        return res.render('admin/newUser', { error: 'Failed to create user' });
    }

    // ถ้า role เป็น 'staff' ให้เพิ่มข้อมูลในตาราง staff ด้วย
    if (role === 'staff') {
        const staffQuery = `
            INSERT INTO staff (name, email) VALUES (?, ?)
        `;
        db.query(staffQuery, [username, email], (err) => {
            if (err) {
                console.error(err);
                return res.render('admin/newUser', { error: 'Failed to create staff member' });
            }
            
            // ถ้าทำงานสำเร็จทั้งสอง query ให้ redirect ไปยังหน้ารายการผู้ใช้
            res.redirect('/admin/userList');
        });
    } else {
        // ถ้าไม่ใช่ role 'staff' ก็ redirect ไปยังหน้ารายการผู้ใช้เลย
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

