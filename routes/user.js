const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// แสดงหน้าแดชบอร์ด
router.get('/dashboard', userController.getDashboard);
// แสดงรายละเอียดของรายงานตาม ID
router.get('/report/:id', userController.getReportDetails);

// แสดงหน้าเพิ่มตั๋วใหม่
router.get('/newTickets', userController.newTicketsPage);
// สร้างตั๋วใหม่โดยส่งข้อมูลผ่าน POST
router.post('/newTickets', userController.createTicket);
// ดูรายการตั๋วทั้งหมดของผู้ใช้
router.get('/tickets', userController.viewTickets);
// ดูรายละเอียดของตั๋วตาม ID
router.get('/tickets/:ticket_id', userController.viewTicketDetail);
// เพิ่ม route สำหรับอัปเดตสถานะของตั๋ว
router.post('/ticket/:ticket_id/set-status', userController.updateTicketStatus);

// แสดงรายการคำถามที่พบบ่อย (FAQ)
router.get('/search', userController.getFaqList);
// แสดงรายละเอียดคำถามที่พบบ่อย (FAQ) โดยระบุ ID
router.get('/search/:faq_id', userController.getFaqDetail);
// ค้นหาคำถามที่พบบ่อย (FAQ) โดยใช้คำค้นหาที่ส่งผ่าน query
router.get('/searchbar', userController.searchFaqs);

module.exports = router;
