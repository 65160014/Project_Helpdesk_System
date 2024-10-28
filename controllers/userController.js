const db = require('../config/db');

exports.tickets = (req, res) => {
  res.render('user/tickets', { username: req.session.user.username });
};

exports.showDashboard = (req, res) => {
    const user = req.user; // ดึงข้อมูลผู้ใช้จาก session หรือ authentication
    res.render('user/dashboard', { user: user }); // render ไปยัง views/user/dashboard.ejs พร้อมข้อมูล user
};

exports.search = (req, res) => {
    res.render('user/search');
  };


exports.createTicket = (req, res) => {
  const { userId, subject, description } = req.body;
  const sql = `INSERT INTO tickets (user_id, subject, description) VALUES (?, ?, ?)`;
  db.query(sql, [userId, subject, description], (err, result) => {
    if (err) throw err;
    res.redirect('/user/tickets');
  });
};

exports.viewTickets = (req, res) => {
  const userId = req.session.userId;
  const sql = `SELECT * FROM tickets WHERE user_id = ?`;
  db.query(sql, [userId], (err, results) => {
    if (err) throw err;
    res.render('tickets', { tickets: results });
  });
};

exports.viewKnowledgeBase = (req, res) => {
  const sql = `SELECT * FROM knowledge_base`;
  db.query(sql, (err, results) => {
    if (err) throw err;
    res.render('knowledgeBase', { articles: results });
  });
};
