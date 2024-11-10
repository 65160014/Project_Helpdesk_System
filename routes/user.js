const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/dashboard', userController.getDashboard);
router.get('/report/:id', userController.getReportDetails);

router.get('/newTickets', userController.newTicketsPage);

// สร้าง Ticket ใหม่
router.post('/newTickets', userController.createTicket);

// ดูรายการ Ticket ทั้งหมด
router.get('/tickets', userController.viewTickets);

router.get('/tickets/:ticket_id', userController.viewTicketDetail);

// เพิ่ม route สำหรับอัปเดตสถานะของ Ticket
router.post('/ticket/:ticket_id/set-status', userController.updateTicketStatus);



// // Route to display the list of FAQs
router.get('/search', userController.getFaqList);
// // Route to display a single FAQ detail by ID
router.get('/search/:id', userController.getFaqDetail);
router.get('/searchbar', userController.searchFaqs);

module.exports = router;
