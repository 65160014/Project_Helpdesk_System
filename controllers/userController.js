const db = require('../config/db');

// แสดงหน้า New Tickets
exports.newTicketsPage = (req, res) => {
    res.render('user/newTickets'); 
};


// ฟังก์ชันสร้างตั๋วใหม่
exports.createTicket = (req, res) => {
  const userId = parseInt(req.session.user?.user_id, 10); // รับค่า user ID จาก session
  const { subject, body } = req.body; // รับ subject และ body จากฟอร์ม
  const createdAt = new Date(); // เวลาปัจจุบันเพื่อใช้ใน created_at

  // ขั้นตอนที่ 1: เพิ่มค่า NULL ในตาราง queue สำหรับ name และ priority
  const queueSql = `INSERT INTO queue (name, priority) VALUES (NULL, NULL)`;

  // เพิ่มข้อมูลใน queue table และรับค่า queue_id ที่ถูกสร้างขึ้น
  db.query(queueSql, (err, queueResult) => {
    if (err) {
      console.error("Error creating queue entry:", err);
      return res.status(500).send("Error creating queue entry");
    }

    // รับค่า queue_id ที่ถูกสร้างขึ้น
    const queueId = queueResult.insertId;

    // ขั้นตอนที่ 2: เพิ่มข้อมูล ticket พร้อมกับ queue_id ที่ได้รับมา
    const ticketSql = `INSERT INTO tickets (user_id, title, description, created_at, queue_id) VALUES (?, ?, ?, ?, ?)`;
    db.query(ticketSql, [userId, subject, body, createdAt, queueId], (err, ticketResult) => {
      if (err) {
        console.error("Error creating ticket:", err);
        return res.status(500).send("Error creating ticket");
      }
      res.redirect('/user/tickets'); // เปลี่ยนเส้นทางไปยังหน้ารายการตั๋วเมื่อสำเร็จ
    });
  });
};


// viewTickets ฟังก์ชันดึงตั๋วที่เป็นของผู้ใช้ที่ล็อกอิน
exports.viewTickets = (req, res) => {
  const userId = parseInt(req.session.user?.user_id, 10);
  const searchTerm = req.query.search || ''; // รับค่าจากแถบค้นหา
  const status = req.query.status || 'all'; // รับค่าจากตัวเลือกสถานะ

  if (!userId) {
    return res.status(401).send('User not logged in');
  }

  let query = `
    SELECT ticket_id, title, status, created_at, IFNULL(updated_at, created_at) AS display_updated_at
    FROM tickets
    WHERE user_id = ? AND title LIKE ?
  `;
  let params = [userId, `%${searchTerm}%`];

  // กรองสถานะตามสถานะที่เลือก
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

  // เรียงลำดับผลลัพธ์ตามวันที่สร้าง
  query += ' ORDER BY created_at DESC';

  // ดำเนินการ query หลักเพื่อดึงข้อมูลตั๋ว
  db.query(query, params, (error, results) => {
    if (error) {
      console.error('Database query error:', error);
      return res.status(500).send('Error retrieving tickets');
    }

    res.render('user/tickets', {
      tickets: results,
      searchTerm: searchTerm, // ส่งคำค้นหาไปยัง view
      status: status // ส่งสถานะไปยัง view
    });
  });
};



// getDashboard ฟังก์ชันสำหรับแสดงข้อมูลแดชบอร์ด
exports.getDashboard = (req, res) => {
  const { period = 'daily' } = req.query; // รับค่า period จาก query หรือกำหนดค่าเริ่มต้นเป็น 'daily'

  // คำนวณวันที่เริ่มต้นตามช่วงเวลา period
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

  // Query New Tickets (ไม่มีสถานะ)
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

                  // ดึงรายงาน
                  db.query("SELECT * FROM report WHERE status = 'show'", (error, reportResults) => {
                    if (error) {
                      console.error("Error fetching reports:", error.message);
                      return res.status(500).send("Error fetching reports");
                    }

                    // แสดงผลข้อมูลแดชบอร์ดไปยัง view
                    res.render('user/dashboard', {
                      period,
                      newTickets: stats.newTickets,
                      pendingTickets: stats.pendingTickets,
                      resolvedTickets: stats.resolvedTickets,
                      closedTickets: stats.closedTickets,
                      reports: reportResults // ส่งรายงานไปยังแดชบอร์ด
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


// แสดงรายละเอียดตั๋ว
exports.viewTicketDetail = (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10); // รับ ticket_id จากพารามิเตอร์ URL

  db.query(
    `SELECT t.ticket_id, t.title, t.description, t.status, t.created_at, t.updated_at,
            t.queue_id,
            u.user_id, u.username, u.email
     FROM tickets t
     JOIN users u ON t.user_id = u.user_id
     WHERE t.ticket_id = ?`,
    [ticketId],
    (error, result) => {
        console.log("Ticket ID:", ticketId); // แสดง ID ของตั๋ว
        console.log("Query result:", result); // แสดงผลลัพธ์ของ query
        
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


// updateTicketStatus ฟังก์ชันสำหรับปรับปรุงสถานะของตั๋ว
exports.updateTicketStatus = (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10);
  const { status } = req.body;

  const query = `UPDATE tickets SET status = ?, updated_at = NOW() WHERE ticket_id = ?`;
  db.query(query, [status, ticketId], (error, results) => {
      if (error) {
          console.error("Error updating ticket status:", error);
          return res.status(500).send("Failed to update ticket status");
      }
      res.status(200).send("Status updated successfully");
  });
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
          if (results.length === 0) {
              return res.status(404).send("Report not found");
          }
          res.render('user/reportDetails', { report: results[0] });
      }
  );
};


// getFaqList ฟังก์ชันสำหรับดึงรายการคำถามที่พบบ่อย (FAQ)
exports.getFaqList = (req, res) => {
  const query = 'SELECT knowledge_base_id, title FROM knowledgebase';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching FAQ list:', err);
      return res.status(500).send('Server error');
    }
    res.render('user/faq', { faqs: results, searchTerm: '' }); // กำหนด searchTerm เป็นค่าว่างเพื่อป้องกัน error ใน view
  });
};


// ฟังก์ชันสำหรับดึงรายละเอียดของ FAQ เดียวโดยใช้ ID
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


// ค้นหา FAQs
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
