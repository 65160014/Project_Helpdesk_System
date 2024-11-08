// middleware/authMiddleware.js

const checkAdminRole = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send("Access denied. Admins only.");
    }
    next(); // ถ้าผู้ใช้เป็น Admin ให้ดำเนินการต่อไป
};

const checkStaffRole = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'staff') {
        return res.status(403).send("Access denied. Staff members only.");
    }
    next(); // ถ้าผู้ใช้เป็น Staff ให้ดำเนินการต่อไป
};

// ส่งออกทั้งสอง middleware ในออบเจ็กต์เดียวกัน
module.exports = { checkAdminRole, checkStaffRole };
