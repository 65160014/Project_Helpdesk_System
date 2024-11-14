const Staff = require('../models/Staff');
const Ticket = require('../models/Ticket');
const KnowledgeBase = require('../models/KnowledgeBase');

// แสดงตั๋วที่ได้รับมอบหมายให้กับพนักงานที่ล็อกอิน
exports.viewAssignedTickets = async (req, res) => {
    const { username } = req.session.user;
    const { status, priority } = req.query;

    try {
        const staff = await Staff.getStaffByUsername(username);
        const tickets = await Ticket.getAssignedTickets(staff.staff_id, status, priority);
        
        res.render('staff/tickets', {
            tickets,
            staff_id: staff.staff_id,
            selectedStatus: status || 'all',
            selectedPriority: priority || 'all'
        });
    } catch (error) {
        console.error('Error fetching assigned tickets:', error);
        res.status(500).send('Error fetching assigned tickets');
    }
};

// แสดงรายละเอียดของตั๋วที่ได้รับมอบหมายให้กับพนักงานที่ล็อกอิน
exports.viewTicketDetail = async (req, res) => {
    const ticketId = parseInt(req.params.ticket_id, 10);
    const { username } = req.session.user;

    if (isNaN(ticketId)) {
        return res.status(400).send('Invalid ticket ID');
    }

    try {
        const staff = await Staff.getStaffByUsername(username);
        const ticket = await Ticket.getAssignedTicketDetail(ticketId, staff.staff_id);

        if (!ticket) {
            return res.status(404).send('Ticket not found or not assigned to this staff member');
        }

        res.render('staff/ticketDetail', { ticket });
    } catch (error) {
        console.error('Error retrieving ticket details:', error);
        res.status(500).send('Server error');
    }
};

// อัปเดตสถานะของตั๋ว
exports.setStatus = async (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10);
  const { status } = req.body;

  // Log ข้อมูลที่เข้ามา
  console.log('Received status update request:', { ticketId, status });

  if (!Ticket.isValidStatus(status)) {
      console.error('Invalid status:', status);
      return res.status(400).send('Invalid status');
  }

  try {
      console.log(`Attempting to update status of ticket ${ticketId} to ${status}`);

      // เรียกฟังก์ชันอัพเดตสถานะ
      await Ticket.updateTicketStatus(ticketId, status);

      console.log(`Status of ticket ${ticketId} updated successfully to ${status}`);
      
      res.status(200).send('Status updated successfully');
  } catch (error) {
      console.error('Error setting status:', error);
      res.status(500).send('Failed to update ticket status');
  }
};


exports.setPriority = async (req, res) => {
  const ticketId = parseInt(req.params.ticket_id, 10);
  const { priority } = req.body;

  try {
      await Ticket.updatePriority(ticketId, priority);
      res.status(200).send('Priority updated successfully');
  } catch (error) {
      console.error('Error setting priority:', error);
      res.status(500).send('Failed to update ticket priority');
  }
};


// แสดงหน้า status ของตั๋ว
exports.status = (req, res) => {
  res.render('staff/status');
};

exports.getTicketsByStatus = async (req, res) => {
  const status = req.params.status;
  const searchTerm = req.query.search || '';
  const { username } = req.session.user;

  console.log('Received status:', status);
  console.log('Received search term:', searchTerm);

  try {
    // เรียกฟังก์ชันจาก Model
    const tickets = await Ticket.getTicketsByStatus(status, searchTerm, username);

    // Log ข้อมูลที่ได้จากฐานข้อมูล
    console.log('Tickets fetched from database:', tickets);
    
    // ส่งข้อมูลไปยัง view
    res.render('staff/statusPage', {
      tickets: tickets,  // ใช้ตัวแปร 'tickets' ที่ได้รับจาก Model
      searchTerm: searchTerm, 
      status: status 
    });

  } catch (error) {
    console.error('Error fetching tickets by status:', error.message);
    res.status(500).send('Server Error');
  }
};





// แสดงหน้า queue ของตั๋ว
exports.queue = (req, res) => {
  res.render('staff/queue');
};

// ฟังก์ชันดึงข้อมูลตั๋วตามความสำคัญ (priority) ของคิว
exports.getTicketsByPriority = async (req, res) => {
  const priority = req.params.priority;  // รับค่าความสำคัญจาก URL เช่น 'low', 'medium', 'high', 'urgent'
  let searchTerm = req.query.search || '';  // รับคำค้นหาจาก query string หรือกำหนดเป็นค่าว่างถ้าไม่มี

  const { username } = req.session.user;  // ดึง username ของพนักงานที่ล็อกอินเข้าม

  try {
      // ใช้ Method จาก Ticket model ที่ได้สร้างขึ้น
      const tickets = await Ticket.getTicketsByPriority(priority, searchTerm, username);
      
      // ส่งผลลัพธ์ไปยัง view 'staff/ticketsByPriority' เพื่อแสดงข้อมูลตั๋วที่ค้นหาได้
      res.render('staff/ticketsByPriority', { tickets, priority, searchTerm });
  } catch (error) {
      console.error('Error fetching tickets:', error.message);
      return res.status(500).send('Error fetching tickets');
  }
};

// ฟังก์ชันดึงรายการ FAQ ทั้งหมด
exports.getFaqList = async (req, res) => {
  try {
      // เรียกใช้ฟังก์ชัน getFaqList จาก Model
      const [faqs] = await KnowledgeBase.getFaqList(); // ดึงข้อมูล FAQ ทั้งหมด
      res.render('staff/faq', { faqs, searchTerm: '' });
  } catch (error) {
      console.error('Error fetching FAQ list:', error);
      res.status(500).send('Server error');
  }
};

// ฟังก์ชันดึงรายละเอียด FAQ ตาม ID
exports.getFaqDetail = async (req, res) => {
  const faqId = parseInt(req.params.id, 10); // รับ ID ของ FAQ จาก URL

  try {
    // เรียกใช้ฟังก์ชัน getFaqDetail จาก Model และดึงข้อมูลจาก array
    const [faq] = await KnowledgeBase.getFaqDetail(faqId);
    
    // ตรวจสอบว่าได้ข้อมูลหรือไม่
    if (!faq) {
      return res.status(404).send('FAQ not found');
    }

    // ส่งข้อมูลไปยัง View
    res.render('staff/faqDetail', { faq: faq[0] });
  } catch (error) {
    console.error('Error fetching FAQ detail:', error);
    res.status(500).send('Server error');
  }
};



// ฟังก์ชันค้นหา FAQ ตามคำค้นหา
exports.searchFaqs = async (req, res) => {
  const searchTerm = req.query.search || ''; // รับคำค้นหาจาก query string

  try {
      // เรียกใช้ฟังก์ชัน searchFaqs จาก Model
      const [faqs] = await KnowledgeBase.searchFaqs(searchTerm); // ค้นหา FAQ
      res.render('staff/faq', { faqs, searchTerm });
  } catch (error) {
      console.error('Error searching FAQs:', error);
      res.status(500).send('Server error');
  }
};