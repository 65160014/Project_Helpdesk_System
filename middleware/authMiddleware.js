// middleware/authMiddleware.js

const checkAdminRole = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send("Access denied. Admins only.");
    }
    next(); // ถ้าผู้ใช้เป็น Admin ให้ดำเนินการต่อไป
};


module.exports = { checkAdminRole };
