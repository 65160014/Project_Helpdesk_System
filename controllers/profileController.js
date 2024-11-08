const db = require('../config/db');  // สมมติว่าคุณใช้ db.js สำหรับการเชื่อมต่อกับฐานข้อมูล

// แสดงหน้าโปรไฟล์
exports.viewProfile = (req, res) => {
    const { username } = req.session.user;  // สมมติว่าชื่อผู้ใช้เก็บใน session

    // ดึงข้อมูลจากตาราง users ตามชื่อผู้ใช้
    db.query('SELECT username, email FROM users WHERE username = ?', [username], (error, results) => {
        if (error) {
            console.error("Error fetching user data:", error);
            return res.status(500).send("Error fetching user data");
        }
        
        if (results.length > 0) {
            const user = results[0];
            res.render('profile', { user });  // ส่งข้อมูลไปแสดงในหน้า profile
        } else {
            res.status(404).send("User not found");
        }
    });
};

// เปลี่ยนรหัสผ่าน
exports.changePassword = (req, res) => {
    const { username } = req.session.user;  // สมมติว่าชื่อผู้ใช้เก็บใน session
    const { oldPassword, newPassword } = req.body;

    // ตรวจสอบรหัสผ่านเก่าจากฐานข้อมูล
    db.query('SELECT password FROM users WHERE username = ?', [username], (error, results) => {
        if (error) {
            console.error("Error fetching user data:", error);
            return res.status(500).send("Error fetching user data");
        }

        if (results.length > 0) {
            const storedPassword = results[0].password;

            // เปรียบเทียบรหัสผ่านเก่าที่ผู้ใช้กรอก
            if (storedPassword !== oldPassword) {
                return res.status(400).send("Old password is incorrect");
            }

            // อัพเดต password ใหม่
            db.query('UPDATE users SET password = ? WHERE username = ?', [newPassword, username], (updateError) => {
                if (updateError) {
                    console.error("Error updating password:", updateError);
                    return res.status(500).send("Failed to update password");
                }

                res.send("Password updated successfully");
            });
        } else {
            res.status(404).send("User not found");
        }
    });
};

// ฟังก์ชัน logout
exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error logging out:", err);
            return res.status(500).send("Failed to log out");
        }
        res.redirect('/login');  // เปลี่ยนเป็นเส้นทางที่ต้องการ
    });
};
