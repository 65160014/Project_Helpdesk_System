const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/dashboard', userController.showDashboard);

router.get('/tickets', userController.tickets);

router.get('/search', userController.search);

// สร้าง Ticket ใหม่
router.post('/tickets', userController.createTicket);

// ดูรายการ Ticket ทั้งหมด
// router.get('/tickets', userController.viewTickets);

// ดูข้อมูล Knowledge Base
router.get('/knowledge-base', userController.viewKnowledgeBase);

module.exports = router;
