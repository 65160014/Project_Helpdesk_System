const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { checkStaffRole } = require('../middleware/authMiddleware');

// Route to view tickets assigned to the logged-in staff member
router.get('/assigned-tickets', checkStaffRole, staffController.viewAssignedTickets);

// Route to view the details of a specific ticket
router.get('/ticket/:ticket_id', checkStaffRole, staffController.viewTicketDetail);

// Route to update the status of a ticket (assigned to the staff member)
router.post('/ticket/:ticket_id/set-status', checkStaffRole, staffController.setStatus);

// Route to update the priority of a ticket (assigned to the staff member)
router.post('/tickets/:ticket_id/set-priority', checkStaffRole, staffController.setPriority);

// Route สำหรับแสดงหน้า status
router.get('/tickets/status', checkStaffRole, staffController.status);

// Route to view tickets by status for a specific staff member
router.get('/tickets/status/:status', checkStaffRole, staffController.getTicketsByStatus);

// Route สำหรับแสดงหน้า queue
router.get('/tickets/queue', checkStaffRole, staffController.queue);

// Route to view tickets by priority for a specific staff member
router.get('/tickets/priority/:priority', checkStaffRole, staffController.getTicketsByPriority);


// // Route to display the list of FAQs
router.get('/search', checkStaffRole, staffController.getFaqList);
// // Route to display a single FAQ detail by ID
router.get('/search/:id', checkStaffRole, staffController.getFaqDetail);
router.get('/searchbar', checkStaffRole, staffController.searchFaqs);

module.exports = router;
