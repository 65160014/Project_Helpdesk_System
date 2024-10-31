const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

router.get('/tickets', staffController.tickets);

router.get('/status', staffController.status);

router.get('/queue', staffController.queue);


// ดูรายการ Ticket ใหม่
router.get('/tickets/new', staffController.viewNewTickets);

// กำหนด Ticket ให้ Staff
router.post('/tickets/assign/:id', staffController.assignTicket);

module.exports = router;
