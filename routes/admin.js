const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');


router.get('/dashboard', adminController.dashboard);

// จัดการผู้ใช้งาน
router.get('/users', adminController.viewUsers);
router.post('/users/edit/:id', adminController.editUser);
router.post('/users/delete/:id', adminController.deleteUser);

module.exports = router;
