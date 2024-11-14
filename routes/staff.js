const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { checkStaffRole } = require('../middleware/authMiddleware');

// Route สำหรับแสดงตั๋วที่ได้รับมอบหมายให้กับพนักงานที่ล็อกอิน
router.get('/assigned-tickets', checkStaffRole, staffController.viewAssignedTickets);
// Route สำหรับแสดงรายละเอียดของตั๋วที่เลือกตาม ticket_id
router.get('/ticket/:ticket_id', checkStaffRole, staffController.viewTicketDetail);
// Route สำหรับอัพเดตสถานะของตั๋วที่ได้รับมอบหมายให้พนักงาน
router.post('/ticket/:ticket_id/set-status', checkStaffRole, staffController.setStatus);
// Route สำหรับอัพเดตความสำคัญ (priority) ของตั๋วที่ได้รับมอบหมายให้พนักงาน
router.post('/tickets/:ticket_id/set-priority', checkStaffRole, staffController.setPriority);


// Route สำหรับแสดงหน้า status ของตั๋ว
router.get('/tickets/status', checkStaffRole, staffController.status);
// Route สำหรับแสดงตั๋วที่กรองตามสถานะที่พนักงานเลือก เช่น open, pending, resolved, closed
router.get('/tickets/status/:status', checkStaffRole, staffController.getTicketsByStatus);
// Route สำหรับแสดงหน้า queue ของตั๋ว
router.get('/tickets/queue', checkStaffRole, staffController.queue);
// Route สำหรับแสดงตั๋วที่กรองตามความสำคัญ (priority) เช่น low, medium, high
router.get('/tickets/priority/:priority', checkStaffRole, staffController.getTicketsByPriority);

// Route สำหรับแสดงรายการ FAQ ทั้งหมด
router.get('/search', checkStaffRole, staffController.getFaqList);
// Route สำหรับแสดงรายละเอียด FAQ โดยใช้ knowledge_base_id
router.get('/search/:id', checkStaffRole, staffController.getFaqDetail);
// Route สำหรับค้นหา FAQ ด้วยคำค้นหาจาก search bar
router.get('/searchbar', checkStaffRole, staffController.searchFaqs);

module.exports = router; 
