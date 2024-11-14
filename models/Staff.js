const db = require('../config/db');

class Staff {
    static async getStaffByUsername(username) {
        const query = `SELECT staff_id FROM staff WHERE name = ?`;
        const [results] = await db.query(query, [username]);
        return results[0];
    }
}

module.exports = Staff;
