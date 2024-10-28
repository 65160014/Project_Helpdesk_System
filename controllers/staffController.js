const db = require('../config/db');


exports.dashboard = (req, res) => {
    res.render('staff/dashboard', { username: req.session.user.username });
  };

exports.viewNewTickets = (req, res) => {
  const sql = `SELECT * FROM tickets WHERE status = 'New'`;
  db.query(sql, (err, results) => {
    if (err) throw err;
    res.render('newTickets', { tickets: results });
  });
};

exports.assignTicket = (req, res) => {
  const { staffId } = req.body;
  const ticketId = req.params.id;
  const sql = `UPDATE tickets SET staff_id = ?, status = 'In Progress' WHERE id = ?`;
  db.query(sql, [staffId, ticketId], (err, result) => {
    if (err) throw err;
    res.redirect('/staff/tickets/new');
  });
};
