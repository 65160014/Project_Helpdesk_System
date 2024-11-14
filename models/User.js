const db = require('../config/db');

class User {
    static async getFaqList() {
        const query = `SELECT knowledge_base_id, title FROM knowledgebase`;
        return db.query(query);
    }

    static async getFaqDetail(faqId) {
        const query = `SELECT title, content FROM knowledgebase WHERE knowledge_base_id = ?`;
        return db.query(query, [faqId]);
    }

    static async searchFaqs(searchTerm) {
        const query = `SELECT knowledge_base_id, title FROM knowledgebase WHERE title LIKE ?`;
        return db.query(query, [`%${searchTerm}%`]);
    }
}

module.exports = User;
