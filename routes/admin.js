const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { checkAdminRole } = require('../middleware/authMiddleware'); // Importing the auth middleware

// Route definitions
router.get('/dashboard', checkAdminRole, adminController.getDashboard);
router.get('/report/add', checkAdminRole, adminController.showAddReportForm);
router.post('/report', checkAdminRole, adminController.addReport);
router.get('/report/:id', checkAdminRole, adminController.getReportDetails); // Ensure this is correct
router.post('/report/edit/:id', checkAdminRole, adminController.updateReport); // Ensure this is correct

router.get('/tickets', checkAdminRole, adminController.viewTickets);
router.get('/tickets/:ticket_id', checkAdminRole, adminController.viewTicketDetail);
router.post('/tickets/:ticket_id/set-priority', checkAdminRole, adminController.setPriority);
router.post('/tickets/:ticket_id/set-status', checkAdminRole, adminController.setStatus);
// Route to display staff selection page
router.get('/tickets/:ticket_id/select-staff', checkAdminRole, adminController.getStaffSelection);
// Route to assign staff to a ticket
router.post('/tickets/:ticket_id/assign-staff', checkAdminRole, adminController.assignStaffToTicket);
router.get('/status/:status', checkAdminRole, adminController.getTicketsByStatus);
router.get('/queue/:priority', checkAdminRole, adminController.getTicketsByPriority);

// Route to display the list of FAQs
router.get('/search', checkAdminRole, adminController.getFaqList);
// Route to display a single FAQ detail by ID
router.get('/search/:id', checkAdminRole, adminController.getFaqDetail);
router.get('/searchbar', checkAdminRole, adminController.searchFaqs);

router.get('/status', checkAdminRole, adminController.status);
router.get('/queue', checkAdminRole, adminController.queue);

// Route to get all users
router.get('/userList', checkAdminRole, adminController.getAllUsers);
// Route to get users by role
router.get('/role/:role', checkAdminRole, adminController.getUsersByRole);
router.get('/role/all', checkAdminRole, adminController.getAllUsers);
// Route to get user by ID for editing
router.get('/users/:userId', checkAdminRole, adminController.getUserById);
// Route to update user information
router.post('/users/:userId/edit', checkAdminRole, adminController.updateUser);
router.get('/searchUser', checkAdminRole, adminController.searchUser);
// Route for the new user page
router.get('/newUser', checkAdminRole, adminController.showNewUserForm);
// Route for creating a new user
router.post('/createUser', checkAdminRole, adminController.createUser);

module.exports = router;
