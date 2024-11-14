const db = require('../config/db');

class Ticket {
    static async createTicket(userId, subject, body, createdAt, queueId) {
        const query = `INSERT INTO tickets (user_id, title, description, created_at, queue_id) VALUES (?, ?, ?, ?, ?)`;
        return db.query(query, [userId, subject, body, createdAt, queueId]);
    }

    static async getUserTickets(userId, searchTerm, status) {
        let query = `
            SELECT ticket_id, title, status, created_at, IFNULL(updated_at, created_at) AS display_updated_at
            FROM tickets
            WHERE user_id = ? AND title LIKE ?
        `;
        let params = [userId, `%${searchTerm}%`];

        switch (status) {
            case 'open':
                query += ' AND status IN (?, ?)';
                params.push('Open', 'Reopened');
                break;
            case 'pending':
                query += ' AND status IN (?, ?, ?)';
                params.push('In Progress', 'Pending', 'Assigned');
                break;
            case 'resolved':
                query += ' AND status = ?';
                params.push('Resolved');
                break;
            case 'closed':
                query += ' AND status = ?';
                params.push('Closed');
                break;
        }
        query += ' ORDER BY created_at DESC';
        return db.query(query, params);
    }

    static async getTicketDetail(ticketId) {
        const query = `
            SELECT t.ticket_id, t.title, t.description, t.status, t.created_at, t.updated_at,
                   u.user_id, u.username, u.email
            FROM tickets t
            JOIN users u ON t.user_id = u.user_id
            WHERE t.ticket_id = ?
        `;
        return db.query(query, [ticketId]);
    }

    static async updateTicketStatus(ticketId, status) {
        const query = `UPDATE tickets SET status = ?, updated_at = NOW() WHERE ticket_id = ?`;
        return db.query(query, [status, ticketId]);
    }

    static async getDashboardStats(startDate) {
        const newTicketsQuery = `SELECT COUNT(*) AS count FROM tickets WHERE created_at >= ?`;
        const openTicketsQuery = `SELECT COUNT(*) AS count FROM tickets WHERE status IN ('Open', 'Reopened', 'Assigned', 'Pending') AND updated_at >= ?`;
        const resolvedTicketsQuery = `SELECT COUNT(*) AS count FROM tickets WHERE status = 'Resolved' AND updated_at >= ?`;
        const closedTicketsQuery = `SELECT COUNT(*) AS count FROM tickets WHERE status = 'Closed' AND updated_at >= ?`;

        const [newTickets] = await db.query(newTicketsQuery, [startDate]);
        const [pendingTickets] = await db.query(openTicketsQuery, [startDate]);
        const [resolvedTickets] = await db.query(resolvedTicketsQuery, [startDate]);
        const [closedTickets] = await db.query(closedTicketsQuery, [startDate]);

        return {
            newTickets: newTickets[0].count,
            pendingTickets: pendingTickets[0].count,
            resolvedTickets: resolvedTickets[0].count,
            closedTickets: closedTickets[0].count,
        };
    }
    static isValidStatus(status) {
        const validStatuses = ['In Progress', 'Pending', 'Resolved', 'Closed', 'Reopened', 'Escalated'];
        return validStatuses.includes(status);
    }

    static async getAssignedTickets(staffId, status, priority) {
        let query = `
            SELECT tickets.ticket_id, tickets.title, tickets.status, tickets.created_at,
                   IFNULL(tickets.updated_at, tickets.created_at) AS display_updated_at,
                   tickets.user_id, queue.priority,
                   users.username AS ticket_owner_username, users.email AS ticket_owner_email
            FROM tickets
            JOIN queue ON tickets.queue_id = queue.queue_id
            JOIN staff_has_queue ON queue.queue_id = staff_has_queue.queue_id
            JOIN users ON tickets.user_id = users.user_id
            WHERE staff_has_queue.staff_id = ?`;

        const params = [staffId];

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
            }
        }

        if (priority && priority !== 'all') {
            query += ` AND queue.priority = ?`;
            params.push(priority);
        }

        query += ` ORDER BY tickets.created_at DESC`;
        const [results] = await db.query(query, params);
        return results;
    }

    static async getAssignedTicketDetail(ticketId, staffId) {
        const query = `
            SELECT t.ticket_id, t.title, t.description, t.status, t.created_at, t.updated_at,
                   t.queue_id, u.username AS ticket_owner_username, u.email AS ticket_owner_email
            FROM tickets t
            JOIN users u ON t.user_id = u.user_id
            JOIN staff_has_queue shq ON t.queue_id = shq.queue_id
            WHERE t.ticket_id = ? AND shq.staff_id = ?`;
        const [results] = await db.query(query, [ticketId, staffId]);
        return results[0];
    }

    static async assignToStaffIfNotAssigned(staffId, ticketId) {
        const checkQuery = `SELECT * FROM staff_has_ticket WHERE staff_id = ? AND ticket_id = ?`;
        const [checkResults] = await db.query(checkQuery, [staffId, ticketId]);

        if (checkResults.length === 0) {
            const insertQuery = `INSERT INTO staff_has_ticket (staff_id, ticket_id, assigned_at) VALUES (?, ?, NOW())`;
            await db.query(insertQuery, [staffId, ticketId]);
        } else {
            const updateQuery = `UPDATE staff_has_ticket SET assigned_at = NOW() WHERE staff_id = ? AND ticket_id = ?`;
            await db.query(updateQuery, [staffId, ticketId]);
        }
    }

    static async updatePriority(ticketId, priority) {
        try {
            // ดึง queue_id จากตาราง tickets
            const [ticketResult] = await db.query(`SELECT queue_id FROM tickets WHERE ticket_id = ?`, [ticketId]);
            if (ticketResult.length === 0) {
                throw new Error('Ticket not found');
            }
            const queueId = ticketResult[0].queue_id;
    
            // อัพเดต priority ในตาราง queue
            await db.query(`UPDATE queue SET priority = ? WHERE queue_id = ?`, [priority, queueId]);
    
            // อัพเดต updated_at ในตาราง tickets
            await db.query(`UPDATE tickets SET updated_at = NOW() WHERE ticket_id = ?`, [ticketId]);
            
        } catch (error) {
            console.error('Failed to update priority:', error.message);
            throw error;
        }
    }
    
    static async getTicketsByStatus(status, searchTerm, username) {
        try {
            // Log ข้อมูลที่รับเข้ามา
            console.log('Received status:', status);
            console.log('Received search term:', searchTerm);
            console.log('Received username:', username);
    
            // คำสั่ง SQL เพื่อค้นหา queue_id ของพนักงานที่ล็อกอิน
            const queueQuery = `SELECT queue_id FROM queue WHERE name = ?`;
            const queueResults = await db.query(queueQuery, [username]);
    
            if (queueResults.length === 0) {
                throw new Error('Queue information not found');
            }
    
            // ดึง queue_id ทั้งหมดจาก array แรก (ไม่สนใจ array ที่สอง)
            const queueIds = queueResults[0].map(result => result.queue_id);
                
            if (!queueIds || queueIds.length === 0) {
                throw new Error('No queue IDs found');
            }
    
            // สร้าง query ที่เหมาะสมตามสถานะที่เลือก
            let query;
            let params = [];
    
            switch (status) {
                case 'open':
                    query = `SELECT * FROM tickets 
                            WHERE tickets.status IN (?, ?) AND tickets.queue_id IN (?) AND tickets.title LIKE ?`;
                    params = ['New', 'Reopened', queueIds, `%${searchTerm}%`];
                    break;
                case 'pending':
                    query = `SELECT * FROM tickets 
                            WHERE tickets.status IN (?, ?, ?) AND tickets.queue_id IN (?) AND tickets.title LIKE ?`;
                    params = ['In Progress', 'Pending', 'Assigned', queueIds, `%${searchTerm}%`];
                    break;
                case 'resolved':
                    query = `SELECT * FROM tickets 
                            WHERE tickets.status = ? AND tickets.queue_id IN (?) AND tickets.title LIKE ?`;
                    params = ['Resolved', queueIds, `%${searchTerm}%`];
                    break;
                case 'closed':
                    query = `SELECT * FROM tickets 
                            WHERE tickets.status = ? AND tickets.queue_id IN (?) AND tickets.title LIKE ?`;
                    params = ['Closed', queueIds, `%${searchTerm}%`];
                    break;
                default:
                    throw new Error('Invalid status');
            }
    
            // ดึงข้อมูลตั๋วจากฐานข้อมูลตาม query ที่สร้างขึ้น
            const result = await db.query(query, params);
    
            // ตรวจสอบข้อมูลที่ดึงมาจากฐานข้อมูล
            console.log('Tickets fetched from database:', result[0]); // result[0] คือข้อมูล ticket จริงๆ
    
            // ส่งคืนผลลัพธ์
            return result[0];  // ส่งเฉพาะ array แรก
        } catch (error) {
            console.error('Failed to fetch tickets by status:', error.message);
            throw error;
        }
    }
    

    // ฟังก์ชันสำหรับกรองตั๋วตาม priority
    static async getTicketsByPriority(priority, searchTerm) {
        try {
            // คำสั่ง SQL สำหรับดึงข้อมูลตั๋วที่ตรงกับ priority และคำค้นหา
            const query = `
                SELECT *
                FROM tickets 
                JOIN queue ON tickets.queue_id = queue.queue_id
                WHERE queue.priority = ? AND tickets.title LIKE ?
                ORDER BY tickets.created_at DESC
            `;
            
            // สร้างพารามิเตอร์สำหรับ query
            const params = [priority, `%${searchTerm}%`];

            // ดึงข้อมูลตั๋วจากฐานข้อมูล
            const [results] = await db.query(query, params);

            // ส่งผลลัพธ์กลับ
            return results;
        } catch (error) {
            console.error('Failed to fetch tickets by priority:', error.message);
            throw error;
        }
    }
}



module.exports = Ticket;
