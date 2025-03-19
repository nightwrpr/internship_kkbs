var express = require('express');
var router = express.Router();
const db = require('../db');

// Route หน้า teacher/dashboard
router.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/users/login');
  }

  const { user } = req.session;
  const teacher = user.teacher;

  console.log(user, teacher); // Debug ข้อมูล session

  res.render('adviser_present_evaluation', {
    title: 'หน้าแรก',
    user: user,   // ส่งข้อมูล user ไปที่ view
    teacher: teacher // ส่งข้อมูล student ไปที่ view
  });
});

router.get('/dashboard/students', (req, res) => {
  db.query(`
    SELECT u.user_id, u.name, u.email, s.student_code, ir.request_id
    FROM internship_request ir
    INNER JOIN user u ON ir.student_id = u.user_id
    INNER JOIN student s ON u.student_id = s.student_id
    WHERE ir.status = 'A' AND ir.delete_up IS NULL;
  `, (error, students) => {
    if (error) {
      console.error('❌ Database Error:', error);
      return res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลนักศึกษา" });
    }

    if (students.length === 0) {
      return res.status(404).json({ message: "ไม่พบนักศึกษาที่ได้รับการอนุมัติฝึกงาน" });
    }

    return res.status(200).json(students);
  });
});

const { v4: uuidv4 } = require('uuid');

// Route สำหรับบันทึกการประเมิน
router.post('/dashboard/save', (req, res) => {
  const { request_id, scores, additionalComments = '', criteriaNames } = req.body;

  if (!request_id) {
    return res.status(400).json({ message: "ไม่พบ request_id" });
  }

  if (!scores || scores.length === 0) {
    return res.status(400).json({ message: "กรุณากรอกคะแนนสำหรับทุกเกณฑ์" });
  }

  if (criteriaNames && criteriaNames.length !== scores.length) {
    return res.status(400).json({ message: "จำนวนเกณฑ์และคะแนนไม่ตรงกัน" });
  }

  const criteriaDefaultNames = criteriaNames || [
    "เนื้อหาครบถ้วนตามหัวข้อที่กำหนด", 
    "รูปแบบของสื่อเหมาะสมกับเนื้อหาที่นำเสนอ", 
    "ความสวยงามของสื่อที่ใช้", 
    "การใช้ภาษาในการนำเสนอ", 
    "การตอบคำถาม", 
    "นำเสนอภายในเวลาที่กำหนด", 
    "บุคลิกภาพและการแต่งกาย"
  ];

  db.query('SELECT history_id FROM internship_history WHERE internship_request_id = ?', [request_id], (error, historyRows) => {
    if (error) {
      console.error('❌ Database Error:', error);
      return res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูล" });
    }

    if (historyRows.length === 0) {
      return res.status(404).json({ message: "ไม่พบข้อมูลการฝึกงานของนักศึกษาคนนี้" });
    }

    const history_id = historyRows[0].history_id;
    console.log("🔍 history_id ที่ได้:", history_id);

    const promises = criteriaDefaultNames.map((criteriaName, index) => {
      const score = scores[index];
      const criteria_id = uuidv4(); 

      const insertCriteriaQuery = `INSERT INTO adviser_evaluation_criteria (criteria_id, criteria_name, create_up) VALUES (?, ?, NOW())`;
      const insertEvaluationQuery = `INSERT INTO adviser_evaluation (history_id, score, no, evaluation_date, comment, criteria_id) VALUES (?, ?, ?, ?, ?, ?)`;

      return new Promise((resolve, reject) => {
        db.query(insertCriteriaQuery, [criteria_id, criteriaName], (err) => {
          if (err) return reject(err);

          db.query(insertEvaluationQuery, [
            history_id,
            score,
            index + 1,
            new Date(),
            additionalComments || '',
            criteria_id
          ], (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
      });
    });

    Promise.all(promises)
      .then(() => {
        console.log("✅ บันทึกการประเมินสำเร็จ");
        res.status(201).json({ message: "บันทึกการประเมินสำเร็จ" });
      })
      .catch((error) => {
        console.error("❌ Error during evaluation saving:", error);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล", error: error.message });
      });
  });
});

module.exports = router;
