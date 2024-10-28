const db = require('../config/db');

const User = {
  create: (username, password, role, callback) => {
    const sql = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
    db.query(sql, [username, password, role], (err, result) => {
      callback(err, result);
    });
  },

  findByUsername: (username, callback) => {
    const sql = 'SELECT * FROM users WHERE username = ?';
    db.query(sql, [username], (err, result) => {
      callback(err, result[0]);
    });
  },

  findById: (id, callback) => {
    const sql = 'SELECT * FROM users WHERE id = ?';
    db.query(sql, [id], (err, result) => {
      callback(err, result[0]);
    });
  },

  updateUserRole: (id, role, callback) => {
    const sql = 'UPDATE users SET role = ? WHERE id = ?';
    db.query(sql, [role, id], (err, result) => {
      callback(err, result);
    });
  },

  deleteUser: (id, callback) => {
    const sql = 'DELETE FROM users WHERE id = ?';
    db.query(sql, [id], (err, result) => {
      callback(err, result);
    });
  },

  getAllUsers: (callback) => {
    const sql = 'SELECT * FROM users';
    db.query(sql, (err, results) => {
      callback(err, results);
    });
  }
};

module.exports = User;
