const db = require('../config/db');

exports.dashboard = (req, res) => {
    res.render('admin/dashboard', { username: req.session.user.username });
  };
  
exports.viewUsers = (req, res) => {
  const sql = `SELECT * FROM users`;
  db.query(sql, (err, results) => {
    if (err) throw err;
    res.render('users', { users: results });
  });
};

exports.editUser = (req, res) => {
  const userId = req.params.id;
  const { username, role } = req.body;
  const sql = `UPDATE users SET username = ?, role = ? WHERE id = ?`;
  db.query(sql, [username, role, userId], (err, result) => {
    if (err) throw err;
    res.redirect('/admin/users');
  });
};

exports.deleteUser = (req, res) => {
  const userId = req.params.id;
  const sql = `DELETE FROM users WHERE id = ?`;
  db.query(sql, [userId], (err, result) => {
    if (err) throw err;
    res.redirect('/admin/users');
  });
};
