var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');
const fs = require('fs');
const db = require('../db'); // เชื่อมต่อกับฐานข้อมูล
const { v4: uuidv4 } = require('uuid');

// 📂 กำหนดการจัดเก็บไฟล์อัปโหลด
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // กำหนดเส้นทางให้เก็บไฟล์ใน uploads/uploads
    const uploadPath = path.join(__dirname, 'uploads', 'uploads');

    try {
      // ตรวจสอบว่าโฟลเดอร์ uploads/uploads มีอยู่หรือไม่
      if (!fs.existsSync(uploadPath)) {
        // ถ้าโฟลเดอร์ไม่มีก็สร้างขึ้นมา
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      // ส่งคืนเส้นทางที่เก็บไฟล์
      cb(null, uploadPath); // ใช้โฟลเดอร์ uploads/uploads สำหรับการเก็บไฟล์
    } catch (err) {
      // ถ้ามีข้อผิดพลาดในการสร้างโฟลเดอร์
      cb(new Error('❌ Failed to create upload directory'), null);
    }
  },
  filename: (req, file, cb) => {
    // สร้างชื่อไฟล์ที่ไม่ซ้ำกันโดยใช้ timestamp
    const uniqueSuffix = Date.now() + path.extname(file.originalname); // สร้างชื่อไฟล์ใหม่โดยใช้ timestamp
    cb(null, uniqueSuffix); // ใช้ชื่อไฟล์ที่ไม่ซ้ำ
  }
});
const upload = multer({ storage: storage });

// Route หน้า send_report
router.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/users/login');
  }

  const { user } = req.session;
  const student = user.student;

  res.render('send_report', {
    title: 'ส่งรายงานการฝึกงาน',
    user: user,
    student: student
  });
});

router.post('/submit_report', upload.single('report_file'), async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/users/login');
  }

  if (!req.file) {
    return res.status(400).send('กรุณาอัปโหลดไฟล์');
  }

  const { user } = req.session;
  const document_id = uuidv4();
  const document_type = 'internship_report';
  const file_path = `/uploads/${req.file.filename}`; // เก็บ path เต็ม
  const user_id = user.id;

  try {
    // ตรวจสอบว่า user_id มีอยู่ในตาราง user หรือไม่
    const userExists = await new Promise((resolve, reject) => {
      db.query(
        `SELECT user_id FROM user WHERE user_id = ?`,
        [user_id],
        (err, results) => {
          if (err) return reject('เกิดข้อผิดพลาดในการตรวจสอบ user_id');
          if (results.length === 0) return reject('ไม่พบ user_id นี้ในระบบ');
          resolve(results[0].user_id);
        }
      );
    });

    // ค้นหา request_id จาก internship_request
    let request_id = await new Promise((resolve, reject) => {
      db.query(
        `SELECT request_id FROM internship_request WHERE student_id = ?`,
        [userExists],
        (err, results) => {
          if (err) return reject('เกิดข้อผิดพลาดในการดึง request_id');
          resolve(results.length > 0 ? results[0].request_id : null);
        }
      );
    });

    if (!request_id) {
      // ถ้าไม่มี request_id, สร้างใหม่
      request_id = uuidv4();
      const status = 'P'; // Pending
      const position_id = 'default_position_id';

      await new Promise((resolve, reject) => {
        db.query(
          `INSERT INTO internship_request (request_id, student_id, status, position_id) 
          VALUES (?, ?, ?, ?)`,
          [request_id, userExists, status, position_id],
          (err) => {
            if (err) return reject('เกิดข้อผิดพลาดในการสร้าง request_id');
            resolve();
          }
        );
      });
    }

    console.log('🚀 request_id:', request_id);

    // ค้นหา history_id จาก internship_history
    let history_id = await new Promise((resolve, reject) => {
      db.query(
        `SELECT history_id FROM internship_history WHERE student_id = ?`,
        [userExists],
        (err, results) => {
          if (err) return reject('เกิดข้อผิดพลาดในการดึง history_id');
          if (results.length === 0) return reject('ไม่พบ history_id นี้ในระบบ');
          resolve(results[0].history_id);
        }
      );
    });

    // เพิ่มข้อมูลลงตาราง document (ลบ internship_history_id ออก)
    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO document (document_id, document_type, file_path, request_id) 
        VALUES (?, ?, ?, ?)`, // ลบ internship_history_id
        [document_id, document_type, file_path, request_id],
        (err, results) => {
          if (err) {
            console.error('❌ เกิดข้อผิดพลาดในการบันทึก document:', err);
            return reject('เกิดข้อผิดพลาดในการบันทึกข้อมูล document');
          }
          resolve(results);
        }
      );
    });

    // เพิ่มข้อมูลลงตาราง approval_document โดยใช้ history_id ที่ดึงมา
    await new Promise((resolve, reject) => {
      console.log('ข้อมูลที่จะเพิ่มลงใน approval_document:', {
        document_id, document_type, file_path, history_id, request_id
      });
    
      db.query(
        `INSERT INTO approval_document (document_id, document_type, file_path, history_id, request_id) 
        VALUES (?, ?, ?, ?, ?)`,
        [document_id, document_type, file_path, history_id, request_id],
        (err) => {
          if (err) {
            console.error('❌ เกิดข้อผิดพลาดในการบันทึก approval_document:', err);
            return reject('เกิดข้อผิดพลาดในการบันทึก approval_document');
          }
          resolve();
        }
      );
    });

    res.send('<script>alert("อัปโหลดสำเร็จ!"); window.location.href = "/";</script>');
  } catch (error) {
    console.error(error);
    res.status(500).send('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  }
});

module.exports = router;