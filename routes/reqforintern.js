const express = require('express');
const router = express.Router();
const db = require('../db'); // เชื่อมต่อกับฐานข้อมูล MySQL
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // กำหนดเส้นทางให้เก็บไฟล์ใน uploads/uploads
    const uploadPath = path.join(__dirname, 'uploads', 'uploads');

    try {
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath); // ใช้โฟลเดอร์ uploads/uploads สำหรับการเก็บไฟล์
    } catch (err) {
      cb(new Error('❌ Failed to create upload directory'), null);
    }
  },
  filename: (req, file, cb) => {
    // ใช้ชื่อไฟล์เดิมที่อัปโหลดมา
    const fileName = file.originalname;
    cb(null, fileName); // เก็บชื่อไฟล์ปกติจาก file.originalname
  }
});

// 📏 ตั้งค่าขนาดไฟล์สูงสุด และประเภทไฟล์ที่อนุญาต
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // จำกัดขนาดไฟล์ 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('❌ ประเภทไฟล์ไม่รองรับ (รองรับเฉพาะ .pdf, .jpg, .png)'), false);
    }
  }
}).fields([
  { name: 'documents[resume]', maxCount: 1 },
  { name: 'documents[transcript]', maxCount: 1 },
  { name: 'documents[id_card]', maxCount: 1 },
  { name: 'documents[consent]', maxCount: 1 },
  { name: 'documents[parent_id]', maxCount: 1 },
  { name: 'documents[student_card]', maxCount: 1 },
  { name: 'documents[bank_book]', maxCount: 1 },
  { name: 'documents[passport]', maxCount: 1 }
]);

// 🔴 Middleware ดักจับข้อผิดพลาด Multer
const uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: '❌ ขนาดไฟล์เกิน 5MB' });
      }
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};
// Middleware สำหรับตรวจสอบการเข้าสู่ระบบและสิทธิ์
function checkRole(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/users/login'); // หากไม่ได้เข้าสู่ระบบ ให้กลับไปที่หน้า login
  }

  const userRole = req.session.user.role?.toLowerCase();
  if (!['admin', 'student'].includes(userRole)) {
    return res.status(403).send('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
  }

  next();
}

// Function ดึงข้อมูลนักศึกษา
async function fetchStudentData(studentId) {
  try {
    const [results] = await db.promise().query(
      `SELECT student_code, major, graduation_status, internship_status 
       FROM student WHERE student_id = ? LIMIT 1`,
      [studentId]
    );
    return results.length > 0 ? results[0] : null;
  } catch (err) {
    console.error('❌ Error fetching student data:', err);
    throw err;
  }
}

// 📌 Route: แสดงฟอร์มคำร้องฝึกงาน (admin/student)
router.get('/', checkRole, async (req, res) => {
  const user = req.session.user;
  const userId = user.id;

  if (!userId) {
    return res.status(400).send('ไม่พบข้อมูลผู้ใช้ใน session');
  }

  try {
    const [userResults] = await db.promise().query(
      'SELECT name, email, student_id FROM user WHERE user_id = ? LIMIT 1',
      [userId]
    );

    if (userResults.length === 0) {
      return res.status(404).send('ไม่พบข้อมูลผู้ใช้');
    }

    const userData = userResults[0];
    const student = await fetchStudentData(userData.student_id);
    if (!student) {
      return res.status(404).send('ไม่พบข้อมูลนักศึกษา');
    }

    const [company] = await db.promise().query('SELECT company_id, name FROM company');
    const [position_open] = await db.promise().query('SELECT position_name, position_id FROM position_open');

    res.render('reqforintern', {
      user: userData,
      student,
      company,
      position_open,
      errorMessage: req.session.errorMessage || null,
      successMessage: req.session.successMessage || null
    });

    req.session.errorMessage = null;
    req.session.successMessage = null;
  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
  }
});

router.post('/submit', checkRole, upload, async (req, res) => {
  console.log('📨 Received data:', req.body);
  console.log('📁 Uploaded files:', req.files);

  const { position_id, company_id, request_start_date, request_end_date, semester, course_opening_id } = req.body;
  const documents = req.files; // get uploaded files from req.files

  // ตรวจสอบว่ามีข้อมูลครบถ้วนหรือไม่
  if (!position_id || !company_id || !request_start_date || !request_end_date || !semester || !course_opening_id) {
    req.session.errorMessage = 'กรุณากรอกข้อมูลให้ครบถ้วน';
    return res.redirect('/reqforintern');
  }

  const user_id = req.session.user.id; // ตรวจสอบ user_id ใน session

  try {
    // ดึง user_id จาก session และตรวจสอบว่าอยู่ในตาราง user
    const [results] = await db.promise().query('SELECT user_id FROM user WHERE user_id = ?', [user_id]);

    if (results.length === 0) {
      req.session.errorMessage = 'ไม่พบข้อมูลผู้ใช้งาน';
      return res.redirect('/reqforintern');
    }

    const user_id_from_db = results[0].user_id; // ใช้ user_id จากตาราง user
    if (!user_id_from_db) {
      req.session.errorMessage = 'ไม่พบข้อมูล user_id';
      return res.redirect('/reqforintern');
    }

    const request_id = uuidv4();
    const status = 'P'; // Pending

    // การเพิ่มข้อมูลใน internship_request โดยใช้ user_id
    const sqlInsertRequest = `INSERT INTO internship_request 
      (request_id, company_id, position_id, request_start_date, request_end_date, student_id, semester, status, course_opening_id, create_up) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
    await db.promise().query(sqlInsertRequest, [
      request_id, company_id, position_id, request_start_date, request_end_date, user_id_from_db, semester, status, course_opening_id
    ]);

    // เพิ่มข้อมูลใน internship_history หลังจากบันทึก internship_request
    const history_id = uuidv4();
    const sqlInsertHistory = `INSERT INTO internship_history 
      (history_id, student_id, internship_request_id, create_up) 
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
    await db.promise().query(sqlInsertHistory, [
      history_id, user_id_from_db, request_id
    ]);

    // บันทึกไฟล์เอกสารที่อัปโหลด
    if (documents) {
      for (let [key, files] of Object.entries(documents)) {
        files.forEach(async (file) => {
          const document_id = uuidv4();
          
          // ดึงชื่อไฟล์จาก path โดยไม่เอา path ทั้งหมด
          const fileName = path.basename(file.path);
          
          const sqlInsertDocument = `INSERT INTO document (document_id, document_type, file_path, request_id, create_up)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`;
          await db.promise().query(sqlInsertDocument, [document_id, key, fileName, request_id]);  // ใช้ fileName แทนการเก็บ path เต็ม
        });
      }
    }

    console.log('✅ บันทึกข้อมูลเรียบร้อย:', request_id);
    req.session.successMessage = 'บันทึกคำร้องและเอกสารเรียบร้อย';
    return res.redirect('/');
  } catch (err) {
    console.error('❌ Error:', err);
    req.session.errorMessage = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
    return res.redirect('/reqforintern');
  }
});
module.exports = router;
