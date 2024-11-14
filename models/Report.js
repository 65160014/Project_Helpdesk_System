const db = require('../config/db');

class Report {
    static async getVisibleReports() {
        const query = `SELECT * FROM report WHERE status = 'show'`;
        return db.query(query);
    }

    static async getReportDetails(reportId) {
        const query = `SELECT * FROM report WHERE report_id = ?`;
        return db.query(query, [reportId]);
    }
}

module.exports = Report;
