const { Ticket, Report, User } = require('../models/adminModel');// นำเข้า Ticket และ Report จาก adminModel

// ฟังก์ชันเพื่อดึงข้อมูลตั๋วตามช่วงเวลา
const getDashboard = async (req, res) => {
  try {
    const { period = 'daily' } = req.query;

    let startDate;
    const currentDate = new Date();
    switch (period) {
      case 'daily':
        startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - 1);
        break;
      case 'weekly':
        startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(currentDate);
        startDate.setMonth(currentDate.getMonth() - 1);
        break;
      default:
        startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - 1);
    }


    // ใช้ Ticket class ในการดึงข้อมูล
    const newTickets = await Ticket.getNewTicketsCount(startDate);
    const pendingTickets = await Ticket.getPendingTicketsCount(startDate);
    const resolvedTickets = await Ticket.getResolvedTicketsCount(startDate);
    const closedTickets = await Ticket.getClosedTicketsCount(startDate);
    

    // ใช้ Report class ในการดึงข้อมูลรายงาน
    const reports = await Report.getAllReports();

    res.render('admin/dashboard', {
      period : period,
      newTickets : newTickets,
      pendingTickets : pendingTickets,
      resolvedTickets : resolvedTickets,
      closedTickets : closedTickets,
      reports : reports[0],
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error.message);
    res.status(500).send("Error fetching dashboard data");
  }
};

// ฟังก์ชันเพื่อแสดงฟอร์มการเพิ่มรายงาน
const showAddReportForm = (req, res) => {
  const adminName = req.session.user.username; // ดึงชื่อผู้ดูแลจาก session
  res.render('admin/addReport', { adminName }); // ส่งข้อมูลชื่อผู้ดูแลไปที่ view
};

// ฟังก์ชันสำหรับเพิ่มรายงานใหม่
const addReport = async (req, res) => {
  try {
      const { title, content } = req.body;
      const adminName = req.session.user.username; // Assuming session is correctly set up
      await Report.addReport(adminName, title, content);
      res.redirect('/admin/dashboard'); // กลับไปที่หน้าแดชบอร์ดหลังจากเพิ่มรายงานเสร็จ
  } catch (error) {
      console.error("Error adding report:", error.message);
      res.status(500).send("Error adding report");
  }
};

// ฟังก์ชันแสดงรายละเอียดรายงาน
const getReportDetails = async (req, res) => {
  try {
    const reportId = req.params.id;

    // ใช้ Report class ในการดึงรายละเอียดรายงาน
    const report = await Report.getReportDetails(reportId);
    res.render('admin/reportDetails', { report });
  } catch (error) {
    console.error("Error fetching report details:", error.message);

    if (error.message === "Report not found") {
      return res.status(404).send("Report not found");
    }

    res.status(500).send("Error fetching report details");
  }
};

// ฟังก์ชันสำหรับแก้ไขรายงาน
const updateReport = async (req, res) => {
  try {
    const reportId = req.params.id;
    const { title, content, status } = req.body;

    // ใช้ Report class ในการอัปเดตรายงาน
    const updatedRows = await Report.updateReport(reportId, title, content, status);

    if (updatedRows === 0) {
      return res.status(404).send("Report not found");
    }

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error("Error updating report:", error.message);
    res.status(500).send("Error updating report");
  }
};

// View tickets with filters
const viewTickets = async (req, res) => {
  try {
    const { status, priority } = req.query;

    // Use Ticket model to fetch tickets
    const tickets = await Ticket.getTickets({ status, priority });

    res.render('admin/tickets', {
      tickets,
      selectedStatus: status || 'all',
      selectedPriority: priority || 'all',
    });
  } catch (error) {
    console.error('Error retrieving tickets:', error.message);
    res.status(500).send('Error retrieving tickets');
  }
};

// View ticket details
const viewTicketDetail = async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticket_id, 10);

    // Use Ticket model to fetch ticket details
    const ticket = await Ticket.getTicketDetails(ticketId);

    res.render('admin/ticketDetail', { ticket });
  } catch (error) {
    console.error('Error retrieving ticket details:', error.message);
    if (error.message === 'Ticket not found') {
      return res.status(404).send('Ticket not found');
    }
    res.status(500).send('Error retrieving ticket details');
  }
};

// Get staff selection for ticket assignment
const getStaffSelection = async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticket_id, 10);

    // Use Ticket model to fetch staff list
    const staffList = await Ticket.getStaffList();

    res.render('admin/select-staff', { ticketId, staffList });
  } catch (error) {
    console.error('Error fetching staff list:', error.message);
    res.status(500).send('Error fetching staff list');
  }
};

// Assign staff to a ticket
const assignStaffToTicket = async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticket_id, 10);
    const staffId = parseInt(req.body.staff_id, 10);

    // Use Ticket model to assign staff to the ticket
    await Ticket.assignStaff(ticketId, staffId);

    res.redirect(`/admin/tickets/${ticketId}`);
  } catch (error) {
    console.error('Error assigning staff to ticket:', error.message);
    res.status(500).send('Error assigning staff to ticket');
  }
};

// Render status page
const status = async (req, res) => {
  res.render('admin/status');
};

// Fetch tickets by status
const getTicketsByStatus = async (req, res) => {
  try {
      const status = req.params.status;
      const searchTerm = req.query.search || '';

      // Fetch tickets from the model
      const tickets = await Ticket.getTicketsByStatus(status, searchTerm);

      res.render('admin/statusPage', { tickets, status, searchTerm });
  } catch (error) {
      console.error('Error fetching tickets by status:', error.message);
      if (error.message === 'Invalid status') {
          return res.status(400).send('Invalid status');
      }
      res.status(500).send('Server Error');
  }
};

// Render queue page
const queue = async (req, res) => {
  res.render('admin/queue');
};

// Fetch tickets by priority
const getTicketsByPriority = async (req, res) => {
  try {
      const priority = req.params.priority; // e.g., 'low', 'medium', 'high', 'urgent'
      const searchQuery = req.query.search || '';

      // Fetch tickets from the model
      const tickets = await Ticket.getTicketsByPriority(priority, searchQuery);

      res.render('admin/ticketsByPriority', { tickets, priority, searchQuery });
  } catch (error) {
      console.error('Error fetching tickets by priority:', error.message);
      res.status(500).send('Server Error');
  }
};

// Render user list with counts
const getAllUsers = async (req, res) => {
  try {
      const userCounts = await User.countUsersByRole();
      res.render('admin/userList', { userCounts });
  } catch (error) {
      console.error('Error fetching user counts:', error.message);
      res.status(500).send('Server Error');
  }
};

// Get users by role
const getUsersByRole = async (req, res) => {
  const role = req.params.role;
  const displayRole = role === 'all' ? 'All Role' : role;
  try {
      const users = await User.getUsersByRole(role);
      res.render('admin/userbyrolePage', { users, displayRole });
  } catch (error) {
      console.error('Error fetching users by role:', error.message);
      res.status(500).send('Server Error');
  }
};

// Search user by username
const searchUser = async (req, res) => {
  const username = req.query.username;
  try {
      const users = await User.searchUserByUsername(username);
      res.render('admin/userbyrolePage', { users, displayRole: 'Search Results' });
  } catch (error) {
      console.error('Error searching user:', error.message);
      res.status(500).send('Server Error');
  }
};

// Get user by ID for editing
const getUserById = async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  try {
      const user = await User.getUserById(userId);
      if (!user) {
          return res.status(404).send('User not found');
      }
      res.render('admin/editUser', { user });
  } catch (error) {
      console.error('Error fetching user by ID:', error.message);
      res.status(500).send('Server Error');
  }
};

// Update user
const updateUser = async (req, res) => {
  const userId = req.params.userId;
  const { username, email, password, role } = req.body;

  try {
      const success = await User.updateUser(userId, { username, email, password, role });
      if (!success) {
          return res.status(404).send('User not found');
      }
      res.redirect('/admin/userList');
  } catch (error) {
      console.error('Error updating user:', error.message);
      res.status(500).send('Server Error');
  }
};

// Render form for new user creation
const showNewUserForm = (req, res) => {
  res.render('admin/newUser', { error: null });
};

// Create new user
const createUser = async (req, res) => {
  const { username, email, password, confirm_password, role } = req.body;

  if (password !== confirm_password) {
      return res.render('admin/newUser', { error: 'Passwords do not match' });
  }

  try {
      const userId = await User.createUser({ username, email, password, role });
      if (role === 'staff') {
          await User.createStaff(username, email);
      }
      res.redirect('/admin/userList');
  } catch (error) {
      console.error('Error creating user:', error.message);
      res.render('admin/newUser', { error: 'Failed to create user' });
  }
};


// ส่งออกฟังก์ชัน
module.exports = {
  getDashboard,
  showAddReportForm,
  addReport,
  getReportDetails,
  updateReport,
  viewTickets,
  viewTicketDetail,
  getStaffSelection,
  assignStaffToTicket,
  status,
  getTicketsByStatus,
  queue,
  getTicketsByPriority,
  getAllUsers,
  getUsersByRole,
  searchUser,
  getUserById,
  updateUser,
  showNewUserForm,
  createUser
};