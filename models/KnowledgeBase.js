// เชื่อมต่อกับ db.js
const db = require('../config/db'); // นำเข้าการเชื่อมต่อฐานข้อมูล

// ฟังก์ชันดึงรายการ FAQ
const getFaqList = () => {
  const sql = 'SELECT knowledge_base_id, title FROM knowledgebase';
  return db.query(sql);  // ใช้ db.query เพื่อทำการ query ข้อมูล
};

// ฟังก์ชันดึงรายละเอียด FAQ
const getFaqDetail = (faqId) => {
  const sql = 'SELECT title, content FROM knowledgebase WHERE knowledge_base_id = ?';
  console.log("Executing query:", sql, "with faqId:", faqId); // Log SQL query
  return db.query(sql, [faqId]);
};


// ฟังก์ชันค้นหา FAQ
const searchFaqs = (searchTerm) => {
  const sql = `SELECT knowledge_base_id, title FROM knowledgebase WHERE title LIKE ?`;
  return db.query(sql, [`%${searchTerm}%`]);  // ใช้ db.query เพื่อทำการ query ข้อมูล
};

// ส่งออกฟังก์ชันทั้งหมด
module.exports = {
  getFaqList,
  getFaqDetail,
  searchFaqs
};
