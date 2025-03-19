var express = require('express');
var router = express.Router();
const db = require('../db');

// หน้า dashboard mentor
router.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/users/login');
  }

  const { user } = req.session;

  res.render('mentor_evaluation', {
    title: 'หน้าแรก',
    user: user
  });
});

// ✅ API: ดึงนักศึกษาของ mentor
router.get('/mentor_evaluation', async (req, res) => {
  const { user } = req.session;

  if (!user) {
    return res.status(401).json({ message: "กรุณาเข้าสู่ระบบ" });
  }

  const userId = user.user_id;  // แก้จาก user.id เป็น user.user_id

  try {
    // ดึง mentor_id จาก user
    const mentorQuery = `SELECT mentor_id FROM user WHERE user_id = ?`;
    db.query(mentorQuery, [userId], (err, mentorResults) => {
      if (err) {
        console.error('❌ Database Error (mentor_id):', err);
        return res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึง mentor_id" });
      }

      if (!mentorResults.length || !mentorResults[0].mentor_id) {
        return res.status(404).json({ message: "ไม่พบ mentor_id" });
      }

      const mentorId = mentorResults[0].mentor_id;

      const studentQuery = `
        SELECT u.user_id, u.name, u.email, s.student_code
        FROM user u
        INNER JOIN student s ON u.student_id = s.student_id
        WHERE u.mentor_id = ?;
      `;

      db.query(studentQuery, [mentorId], (err, studentResults) => {
        if (err) {
          console.error('❌ Database Error (students):', err);
          return res.status(500).json({ message: "ดึงข้อมูลนักศึกษาไม่สำเร็จ" });
        }

        if (!studentResults.length) {
          return res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
        }

        res.status(200).json({ students: studentResults });
      });
    });
  } catch (error) {
    console.error('❌ Unexpected Error:', error);
    res.status(500).json({ message: "ข้อผิดพลาดไม่คาดคิด" });
  }
});

// ✅ POST: บันทึกการประเมิน
router.post('/submit', async (req, res) => {
  const { q1_1, q1_2, q2_1, q2_2, q2_3, q2_4, q2_5, q2_6, q3_1, q3_2, feedback, request_id } = req.body;

  const scores = [q1_1, q1_2, q2_1, q2_2, q2_3, q2_4, q2_5, q2_6, q3_1, q3_2];
  if (scores.some(score => score == null)) {
    return res.status(400).json({ message: "กรุณากรอกคะแนนทุกข้อ" });
  }

  try {
    const [historyRows] = await db.promise().query(
      'SELECT history_id FROM internship_history WHERE internship_request_id = ?', [request_id]
    );

    if (!historyRows.length) {
      return res.status(404).json({ message: "ไม่พบข้อมูลการฝึกงาน" });
    }

    const history_id = historyRows[0].history_id;

    const criteriaNames = [
      "คุณภาพงาน", "ความสามารถในการเรียนรู้และประยุกต์วิชาการ", "ความรับผิดชอบและเป็นผู้ที่ไว้วางใจได้",
      "การตรงต่อเวลา", "ความสนใจ อุตสาหะ และมุ่งมั่นทำงานให้สำเร็จ", "ความเอาใจใส่ต่อผู้รับบริการ",
      "ความสามารถเริ่มต้นทำงานได้ด้วยตนเอง", "การตอบสนองต่อการสั่งการ", "บุคลิกภาพ", "มนุษยสัมพันธ์และความสามารถในการทำงานร่วมกับผู้อื่น"
    ];

    const promises = criteriaNames.map((criteriaName, index) => {
      const score = scores[index];
      const criteria_id = require('crypto').randomUUID();

      const insertCriteriaQuery = `INSERT INTO mentor_evaluation_criteria (criteria_id, criteria_name, create_up) VALUES (?, ?, NOW())`;
      const insertEvaluationQuery = `INSERT INTO mentor_evaluation (history_id, score, no, evaluation_date, comment, criteria_id) VALUES (?, ?, ?, NOW(), ?, ?)`;

      return db.promise().query(insertCriteriaQuery, [criteria_id, criteriaName])
        .then(() => db.promise().query(insertEvaluationQuery, [
          history_id,
          score,
          index + 1,
          feedback || '',
          criteria_id
        ]));
    });

    await Promise.all(promises);

    res.status(201).json({ message: "บันทึกการประเมินสำเร็จ" });

  } catch (error) {
    console.error("❌ Error during evaluation saving:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึก", error: error.message });
  }
});
module.exports = router;
