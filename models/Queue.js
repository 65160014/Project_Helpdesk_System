const db = require('../config/db');

class Queue {
    static async createQueue() {
        const query = `INSERT INTO queue (name, priority) VALUES (NULL, NULL)`;
        return db.query(query);
    }
}

module.exports = Queue;
