const db = require('../config/db');

class Ticket {
    static async getNewTicketsCount(startDate) {
        const query = `SELECT COUNT(*) AS count FROM tickets WHERE created_at >= ?`;
        const [results] = await db.query(query, [startDate]);
        return results[0].count; // Accessing the first row of the result array
    }

    static async getPendingTicketsCount(startDate) {
        const query = `SELECT COUNT(*) AS count FROM tickets WHERE status IN ('Open', 'Reopened', 'Assigned', 'Pending') AND updated_at >= ?`;
        const [results] = await db.query(query, [startDate]);
        return results[0].count; // Accessing the first row of the result array
    }

    static async getResolvedTicketsCount(startDate) {
        const query = `SELECT COUNT(*) AS count FROM tickets WHERE status = 'Resolved' AND updated_at >= ?`;
        const [results] = await db.query(query, [startDate]);
        return results[0].count; // Accessing the first row of the result array
    }

    static async getClosedTicketsCount(startDate) {
        const query = `SELECT COUNT(*) AS count FROM tickets WHERE status = 'Closed' AND updated_at >= ?`;
        const [results] = await db.query(query, [startDate]);
        return results[0].count; // Accessing the first row of the result array
    }
    static async getTickets({ status, priority }) {
        let query = `
            SELECT tickets.ticket_id, tickets.title, tickets.status, tickets.created_at,
                   IFNULL(tickets.updated_at, tickets.created_at) AS display_updated_at,
                   tickets.user_id, users.username, users.email,
                   queue.priority, queue.name AS agent_name
            FROM tickets
            LEFT JOIN users ON tickets.user_id = users.user_id
            LEFT JOIN queue ON tickets.queue_id = queue.queue_id
            WHERE 1=1
        `;
        const params = [];

        // Filter by status
        if (status && status !== 'all') {
            switch (status) {
                case 'open':
                    query += ` AND tickets.status IN (?, ?)`;
                    params.push('New', 'Reopened');
                    break;
                case 'pending':
                    query += ` AND tickets.status IN (?, ?, ?)`;
                    params.push('In Progress', 'Pending', 'Assigned');
                    break;
                case 'resolved':
                    query += ` AND tickets.status = ?`;
                    params.push('Resolved');
                    break;
                case 'closed':
                    query += ` AND tickets.status = ?`;
                    params.push('Closed');
                    break;
                default:
                    throw new Error('Invalid status');
            }
        }

        // Filter by priority
        if (priority && priority !== 'all') {
            query += ` AND queue.priority = ?`;
            params.push(priority);
        }

        // Order by creation date
        query += ` ORDER BY tickets.created_at DESC`;

        const [results] = await db.query(query, params);
        return results;
    }

    static async getTicketDetails(ticketId) {
        const query = `
            SELECT t.ticket_id, t.title, t.description, t.status, t.created_at, t.updated_at,
                   t.queue_id, u.user_id, u.username, u.email
            FROM tickets t
            JOIN users u ON t.user_id = u.user_id
            WHERE t.ticket_id = ?
        `;
        const [results] = await db.query(query, [ticketId]);
        if (results.length === 0) {
            throw new Error('Ticket not found');
        }
        return results[0];
    }

    static async getStaffList() {
        const query = `SELECT * FROM staff`;
        const [results] = await db.query(query);
        return results;
    }

    static async assignStaff(ticketId, staffId) {
        const [[{ queue_id: queueId }]] = await db.query(`SELECT queue_id FROM tickets WHERE ticket_id = ?`, [ticketId]);
        if (!queueId) throw new Error('Ticket not found');

        // Remove existing staff assignments
        await db.query(`DELETE FROM staff_has_queue WHERE queue_id = ?`, [queueId]);

        // Assign new staff
        await db.query(`INSERT INTO staff_has_queue (queue_id, staff_id) VALUES (?, ?)`, [queueId, staffId]);

        // Update queue name
        const [[{ name: staffName }]] = await db.query(`SELECT name FROM staff WHERE staff_id = ?`, [staffId]);
        await db.query(`UPDATE queue SET name = ? WHERE queue_id = ?`, [staffName, queueId]);

        // Update ticket status
        await db.query(`UPDATE tickets SET status = 'Assigned' WHERE ticket_id = ?`, [ticketId]);
    }
    
    static async getTicketsByStatus(status, searchTerm = '') {
        let query;
        let params = [];

        switch (status) {
            case 'open':
                query = 'SELECT * FROM tickets WHERE status IN (?, ?) AND title LIKE ?';
                params = ['New', 'Reopened', `%${searchTerm}%`];
                break;
            case 'pending':
                query = 'SELECT * FROM tickets WHERE status IN (?, ?, ?) AND title LIKE ?';
                params = ['In Progress', 'Pending', 'Assigned', `%${searchTerm}%`];
                break;
            case 'resolved':
                query = 'SELECT * FROM tickets WHERE status = ? AND title LIKE ?';
                params = ['Resolved', `%${searchTerm}%`];
                break;
            case 'closed':
                query = 'SELECT * FROM tickets WHERE status = ? AND title LIKE ?';
                params = ['Closed', `%${searchTerm}%`];
                break;
            default:
                throw new Error('Invalid status');
        }

        const [results] = await db.query(query, params);
        return results;
    }

    static async getTicketsByPriority(priority, searchQuery = '') {
        // Step 1: Fetch queue IDs for the given priority
        const queueQuery = 'SELECT queue_id FROM queue WHERE priority = ?';
        const [queueResults] = await db.query(queueQuery, [priority]);

        if (!queueResults.length) return []; // No queues found for the given priority

        const queueIds = queueResults.map(result => result.queue_id);

        // Step 2: Fetch tickets using queue IDs
        const ticketsQuery = 'SELECT * FROM tickets WHERE queue_id IN (?) AND title LIKE ?';
        const [ticketResults] = await db.query(ticketsQuery, [queueIds, `%${searchQuery}%`]);

        return ticketResults;
    }
}


class Report {
    static async getAllReports() {
        const query = `SELECT * FROM report`;
        const results = await db.query(query);
        return results;
    }
    static async addReport(adminName, title, content) {
        const query = `INSERT INTO report (admin_name, title, content, status) VALUES (?, ?, ?, 'show')`;
        try {
            const results = await db.query(query, [adminName, title, content]);
            return results.insertId; // Return ID ของรายงานที่เพิ่ม
        } catch (error) {
            console.error("Error adding report:", error.message);
            throw new Error("Error adding report");
        }
    }    
    
    // ฟังก์ชันดึงรายละเอียดรายงานตาม ID
    static async getReportDetails(reportId) {
        const query = "SELECT * FROM report WHERE report_id = ?";
        const [results] = await db.query(query, [reportId]);
        if (results.length === 0) {
            throw new Error("Report not found");
        }
        return results[0];
    }

    // ฟังก์ชันอัปเดตรายงาน
    static async updateReport(reportId, title, content, status) {
        const query = "UPDATE report SET title = ?, content = ?, status = ? WHERE report_id = ?";
        const [results] = await db.query(query, [title, content, status, reportId]);
        return results.affectedRows; // จำนวนแถวที่ถูกอัปเดต
    }
}

class User {
    static async countUsersByRole() {
        const roles = ['all', 'admin', 'staff', 'user'];
        const counts = {};
        roles.forEach(role => (counts[role] = 0));
        const promises = roles.map(async (role) => {
            const query =
                role === 'all'
                    ? 'SELECT COUNT(*) AS count FROM users'
                    : 'SELECT COUNT(*) AS count FROM users WHERE role = ?';
            const params = role === 'all' ? [] : [role];
            const [results] = await db.query(query, params);
            counts[role] = results[0].count;
        });
        await Promise.all(promises);
        return counts;
    }

    static async getUsersByRole(role) {
        const query =
            role === 'all'
                ? 'SELECT * FROM users'
                : 'SELECT * FROM users WHERE role = ?';
        const params = role === 'all' ? [] : [role];
        const [results] = await db.query(query, params);
        return results;
    }

    static async searchUserByUsername(username) {
        const query = 'SELECT * FROM users WHERE username LIKE ?';
        const [results] = await db.query(query, [`%${username}%`]);
        return results;
    }

    static async getUserById(userId) {
        const query = 'SELECT * FROM users WHERE user_id = ?';
        const [results] = await db.query(query, [userId]);
        return results.length ? results[0] : null;
    }

    static async updateUser(userId, { username, email, password, role }) {
        const query = `
            UPDATE users SET username = ?, email = ?, password = ?, role = ? WHERE user_id = ?
        `;
        const [results] = await db.query(query, [username, email, password, role, userId]);
        return results.affectedRows > 0;
    }

    static async createUser({ username, email, password, role }) {
        const query = `
            INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)
        `;
        const [results] = await db.query(query, [username, email, password, role]);
        return results.insertId;
    }

    static async createStaff(username, email) {
        const query = `
            INSERT INTO staff (name, email) VALUES (?, ?)
        `;
        await db.query(query, [username, email]);
    }
}

module.exports = { Ticket, Report, User };