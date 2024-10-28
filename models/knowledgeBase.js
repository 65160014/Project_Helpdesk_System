const db = require('../config/db');

const KnowledgeBase = {
  create: (title, content, callback) => {
    const sql = 'INSERT INTO knowledge_base (title, content) VALUES (?, ?)';
    db.query(sql, [title, content], (err, result) => {
      callback(err, result);
    });
  },

  findAll: (callback) => {
    const sql = 'SELECT * FROM knowledge_base';
    db.query(sql, (err, results) => {
      callback(err, results);
    });
  },

  findById: (articleId, callback) => {
    const sql = 'SELECT * FROM knowledge_base WHERE id = ?';
    db.query(sql, [articleId], (err, result) => {
      callback(err, result[0]);
    });
  },

  updateArticle: (articleId, title, content, callback) => {
    const sql = 'UPDATE knowledge_base SET title = ?, content = ? WHERE id = ?';
    db.query(sql, [title, content, articleId], (err, result) => {
      callback(err, result);
    });
  },

  deleteArticle: (articleId, callback) => {
    const sql = 'DELETE FROM knowledge_base WHERE id = ?';
    db.query(sql, [articleId], (err, result) => {
      callback(err, result);
    });
  }
};

module.exports = KnowledgeBase;
