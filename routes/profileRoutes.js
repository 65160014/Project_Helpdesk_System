const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

// Route แสดงหน้าโปรไฟล์
router.get('/profile', profileController.viewProfile);

// Route สำหรับการเปลี่ยนรหัสผ่าน
router.post('/profile/change-password', profileController.changePassword);

// Route สำหรับการ Logout
router.get('/logout', profileController.logout);

module.exports = router;
