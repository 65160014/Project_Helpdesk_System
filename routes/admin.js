const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { checkAdminRole } = require('../middleware/authMiddleware'); // นำเข้า middleware สำหรับตรวจสอบสิทธิ์แอดมิน

// หน้า dashboard

// แสดงหน้า dashboard สำหรับแอดมิน
router.get('/dashboard', checkAdminRole, adminController.getDashboard);

// แสดงฟอร์มสำหรับเพิ่มรายงานใหม่
router.get('/report/add', checkAdminRole, adminController.showAddReportForm);

// เพิ่มรายงานใหม่ (รับข้อมูลจากฟอร์ม)
router.post('/report', checkAdminRole, adminController.addReport);

// ดูรายละเอียดของรายงานตาม ID
router.get('/report/:id', checkAdminRole, adminController.getReportDetails);

// แก้ไขรายงานตาม ID (รับข้อมูลจากฟอร์ม)
router.post('/report/edit/:id', checkAdminRole, adminController.updateReport);


// หน้า tickets

// แสดงรายการตั๋วทั้งหมด
router.get('/tickets', checkAdminRole, adminController.viewTickets);
// ดูรายละเอียดของตั๋วตาม ticket_id
router.get('/tickets/:ticket_id', checkAdminRole, adminController.viewTicketDetail);
// กำหนดลำดับความสำคัญให้กับตั๋วตาม ticket_id
router.post('/tickets/:ticket_id/set-priority', checkAdminRole, adminController.setPriority);
// กำหนดสถานะให้กับตั๋วตาม ticket_id
router.post('/tickets/:ticket_id/set-status', checkAdminRole, adminController.setStatus);
// แสดงหน้าเลือก staff สำหรับตั๋วตาม ticket_id
router.get('/tickets/:ticket_id/select-staff', checkAdminRole, adminController.getStaffSelection);
// กำหนด staff ให้กับตั๋วตาม ticket_id
router.post('/tickets/:ticket_id/assign-staff', checkAdminRole, adminController.assignStaffToTicket);


// หน้า status , queue

// แสดงหน้าสถานะต่างๆ ของตั๋ว
router.get('/status', checkAdminRole, adminController.status);
// แสดงหน้า queue ของตั๋ว
router.get('/queue', checkAdminRole, adminController.queue);
// ดูตั๋วตามสถานะที่ระบุ
router.get('/status/:status', checkAdminRole, adminController.getTicketsByStatus);
// ดูตั๋วตามลำดับความสำคัญที่ระบุ
router.get('/queue/:priority', checkAdminRole, adminController.getTicketsByPriority);


// หน้า users

// แสดงรายการผู้ใช้ทั้งหมด
router.get('/userList', checkAdminRole, adminController.getAllUsers);
// แสดงผู้ใช้ตาม role ที่ระบุ
router.get('/role/:role', checkAdminRole, adminController.getUsersByRole);
// แสดงผู้ใช้ทุกคนในระบบ
router.get('/role/all', checkAdminRole, adminController.getAllUsers);
// ดึงข้อมูลผู้ใช้ตาม userId เพื่อนำไปแก้ไข
router.get('/users/:userId', checkAdminRole, adminController.getUserById);
// อัปเดตข้อมูลผู้ใช้ตาม userId
router.post('/users/:userId/edit', checkAdminRole, adminController.updateUser);
// ค้นหาผู้ใช้ตาม username
router.get('/searchUser', checkAdminRole, adminController.searchUser);
// แสดงหน้าสำหรับเพิ่มผู้ใช้ใหม่
router.get('/newUser', checkAdminRole, adminController.showNewUserForm);
// สร้างผู้ใช้ใหม่ (รับข้อมูลจากฟอร์ม)
router.post('/createUser', checkAdminRole, adminController.createUser);

module.exports = router;


// หน้า search

// // แสดงรายการ FAQ ทั้งหมด
// router.get('/search', checkAdminRole, adminController.getFaqList);
// // แสดงรายละเอียดของ FAQ ตาม ID
// router.get('/search/:id', checkAdminRole, adminController.getFaqDetail);
// // ค้นหา FAQ
// router.get('/searchbar', checkAdminRole, adminController.searchFaqs);