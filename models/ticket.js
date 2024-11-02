const db = require('../config/db');

const Ticket = {
  create: (userId, subject, description, callback) => {
    const sql = 'INSERT INTO tickets (user_id, subject, description, status) VALUES (?, ?, ?, "New")';
    db.query(sql, [userId, subject, description], (err, result) => {
      callback(err, result);
    });
  },

  findByUserId: (userId, callback) => {
    const sql = 'SELECT * FROM tickets WHERE user_id = ?';
    db.query(sql, [userId], (err, results) => {
      callback(err, results);
    });
  },

  findAllNew: (callback) => {
    const sql = 'SELECT * FROM tickets WHERE status = "New"';
    db.query(sql, (err, results) => {
      callback(err, results);
    });
  },

  assignToStaff: (ticketId, staffId, callback) => {
    const sql = 'UPDATE tickets SET staff_id = ?, status = "In Progress" WHERE id = ?';
    db.query(sql, [staffId, ticketId], (err, result) => {
      callback(err, result);
    });
  },

  updateStatus: (ticketId, status, callback) => {
    const sql = 'UPDATE tickets SET status = ? WHERE id = ?';
    db.query(sql, [status, ticketId], (err, result) => {
      callback(err, result);
    });
  },

  findById: (ticketId, callback) => {
    const sql = 'SELECT * FROM tickets WHERE id = ?';
    db.query(sql, [ticketId], (err, result) => {
      callback(err, result[0]);
    });
  },

  // New delete method
  delete: (ticketId, callback) => {
    const sql = 'DELETE FROM tickets WHERE id = ?';
    db.query(sql, [ticketId], (err, result) => {
      callback(err, result);
    });
  }
};

module.exports = Ticket;
