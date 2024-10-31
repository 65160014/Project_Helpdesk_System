const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');


router.get('/dashboard', adminController.dashboard);

router.get('/tickets', adminController.viewTickets);

router.get('/search', adminController.search);

router.get('/status', adminController.status);

router.get('/queue', adminController.queue);

router.get('/userList', adminController.viewUsers);



// จัดการผู้ใช้งาน
// router.get('/users', adminController.viewUsers);
// router.post('/users/edit/:id', adminController.editUser);
// router.post('/users/delete/:id', adminController.deleteUser);

module.exports = router;
