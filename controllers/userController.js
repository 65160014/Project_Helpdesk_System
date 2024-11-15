const db = require('../config/db');
const Ticket = require('../models/Ticket');
const Queue = require('../models/Queue');
const Report = require('../models/Report');
const KnowledgeBase = require('../models/KnowledgeBase');

// แสดงหน้า New Tickets
exports.newTicketsPage = (req, res) => {
    res.render('user/newTickets'); 
};

exports.createTicket = async (req, res) => {
    const userId = parseInt(req.session.user?.user_id, 10);
    const { subject, body } = req.body;
    const createdAt = new Date();

    try {
        const queueResult = await Queue.createQueue();
        const queueId = queueResult[0].insertId;

        await Ticket.createTicket(userId, subject, body, createdAt, queueId);
        res.redirect('/user/tickets');
    } catch (error) {
        console.error("Error creating ticket:", error);
        res.status(500).send("Error creating ticket");
    }
};

exports.viewTickets = async (req, res) => {
    const userId = parseInt(req.session.user?.user_id, 10);
    const searchTerm = req.query.search || '';
    const status = req.query.status || 'all';

    try {
        const [tickets] = await Ticket.getUserTickets(userId, searchTerm, status);
        res.render('user/tickets', { tickets, searchTerm, status });
    } catch (error) {
        console.error("Error retrieving tickets:", error);
        res.status(500).send("Error retrieving tickets");
    }
};

exports.getDashboard = async (req, res) => {
    const { period = 'daily' } = req.query;
    let startDate = new Date();
    const currentDate = new Date();

    switch (period) {
        case 'daily': startDate.setDate(currentDate.getDate() - 1); break;
        case 'weekly': startDate.setDate(currentDate.getDate() - 7); break;
        case 'monthly': startDate.setMonth(currentDate.getMonth() - 1); break;
    }

    try {
        const stats = await Ticket.getDashboardStats(startDate);
        const [reports] = await Report.getVisibleReports();
        res.render('user/dashboard', { period, ...stats, reports });
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).send("Error fetching dashboard data");
    }
};

exports.viewTicketDetail = async (req, res) => {
    const ticketId = parseInt(req.params.ticket_id, 10);

    try {
        const [result] = await Ticket.getTicketDetail(ticketId);
        if (result.length === 0) return res.status(404).send('Ticket not found');
        res.render('user/ticketDetail', { ticket: result[0] });
    } catch (error) {
        console.error("Error retrieving ticket details:", error);
        res.status(500).send("Error retrieving ticket details");
    }
};

exports.updateTicketStatus = async (req, res) => {
    const ticketId = parseInt(req.params.ticket_id, 10);
    const { status } = req.body;

    try {
        await Ticket.updateTicketStatus(ticketId, status);
        res.status(200).send("Status updated successfully");
    } catch (error) {
        console.error("Error updating ticket status:", error);
        res.status(500).send("Failed to update ticket status");
    }
};

exports.getReports = async (req, res) => {
    try {
        const [reports] = await Report.getVisibleReports();
        res.render('user/dashboard', { reports });
    } catch (error) {
        console.error("Error fetching reports:", error);
        res.status(500).send("Error fetching reports");
    }
};

exports.getReportDetails = async (req, res) => {
    const reportId = req.params.id;

    try {
        const [result] = await Report.getReportDetails(reportId);
        if (result.length === 0) return res.status(404).send("Report not found");
        res.render('user/reportDetails', { report: result[0] });
    } catch (error) {
        console.error("Error retrieving report details:", error);
        res.status(500).send("Error retrieving report details");
    }
};
// ฟังก์ชันดึงรายการ FAQ
exports.getFaqList = async (req, res) => {
  const query = 'SELECT knowledge_base_id, title FROM knowledgebase';
  
  try {
    const [results] = await db.query(query);  // Use promise with async/await
    res.render('user/faq', { faqs: results, searchTerm: '' });
  } catch (err) {
    console.error('Error fetching FAQ list:', err);
    return res.status(500).send('Server error');
  }
};



// ฟังก์ชันดึงรายละเอียด FAQ
exports.getFaqDetail = async (req, res) => {
  const faqId = parseInt(req.params.faq_id);

  console.log("Fetching FAQ with ID:", faqId); // ตรวจสอบว่า faqId เป็นค่าที่ถูกต้อง

  try {
      const [faq] = await KnowledgeBase.getFaqDetail(faqId);  // เรียกใช้ KnowledgeBase
      console.log("FAQ result:", faq); // ตรวจสอบผลลัพธ์ที่ได้จากฐานข้อมูล

      if (!faq || faq.length === 0) {
          return res.status(404).send("FAQ not found");
      }
      res.render('user/faqDetail', { faq: faq[0] });
  } catch (error) {
      console.error(`Error retrieving FAQ detail for ID ${faqId}:`, error);
      res.status(500).send("Error retrieving FAQ detail");
  }
};


// ฟังก์ชันค้นหา FAQ
exports.searchFaqs = async (req, res) => {
  const searchTerm = req.query.search || '';
  const query = `SELECT knowledge_base_id, title FROM knowledgebase WHERE title LIKE ?`;

  try {
    const [results] = await db.query(query, [`%${searchTerm}%`]);  // Use promise with async/await
    res.render('user/faq', { faqs: results, searchTerm });  // ส่ง searchTerm ไปด้วย
  } catch (err) {
    console.error('Error searching FAQs:', err);
    return res.status(500).send('Server error');
  }
};