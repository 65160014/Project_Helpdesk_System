const db = require('../config/db');

const Queue = {
  create: (name, description, callback) => {
    const sql = 'INSERT INTO queues (name, description) VALUES (?, ?)';
    db.query(sql, [name, description], (err, result) => {
      callback(err, result);
    });
  },

  findAll: (callback) => {
    const sql = 'SELECT * FROM queues';
    db.query(sql, (err, results) => {
      callback(err, results);
    });
  },

  findById: (queueId, callback) => {
    const sql = 'SELECT * FROM queues WHERE id = ?';
    db.query(sql, [queueId], (err, result) => {
      callback(err, result[0]);
    });
  },

  updateQueue: (queueId, name, description, callback) => {
    const sql = 'UPDATE queues SET name = ?, description = ? WHERE id = ?';
    db.query(sql, [name, description, queueId], (err, result) => {
      callback(err, result);
    });
  },

  deleteQueue: (queueId, callback) => {
    const sql = 'DELETE FROM queues WHERE id = ?';
    db.query(sql, [queueId], (err, result) => {
      callback(err, result);
    });
  }
};

module.exports = Queue;
