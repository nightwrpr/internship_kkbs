var express = require('express');
var router = express.Router();
const db = require('../db');
const crypto = require("crypto"); // ใช้สร้าง UUID
// 🏠 หน้าแรก (ดึงข้อมูลผู้ใช้) -- ไม่ตรวจสอบ session ในกรณีนี้
router.get('/', (req, res) => {
  const { user } = req.session || {};
  const teacher = user?.teacher || null;

  console.log("Session User:", user); // Debug ข้อมูล session

  res.render('adviser_nites_evaluation', {
    title: 'หน้าแรก',
    user: user,
    teacher: teacher
  });
});
router.post('/save', async (req, res) => {
  try {
    // 🔍 ตรวจสอบข้อมูลที่รับมา
    console.log("📥 ข้อมูลที่ได้รับจาก client:", req.body);

    const { request_id, scores, additionalComments, criteriaNames } = req.body;

    // ตรวจสอบว่ามีข้อมูลทั้งหมดหรือไม่
    if (!request_id || !scores || (criteriaNames && criteriaNames.length !== scores.length)) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน กรุณากรอกข้อมูลให้ครบ" });
    }

    // หากไม่มี criteriaNames ให้ใช้ค่าเริ่มต้น
    const criteriaDefaultNames = criteriaNames || ["หัวข้อ 1", "หัวข้อ 2", "หัวข้อ 3", "หัวข้อ 4", "หัวข้อ 5", "หัวข้อ 6"];

    // 🔍 ค้นหา history_id ที่เกี่ยวข้องกับ request_id
    const [historyResult] = await db.promise().query(
      `SELECT history_id FROM internship_history WHERE internship_request_id = ?`,
      [request_id]
    );

    if (!historyResult.length) {
      return res.status(404).json({ message: "ไม่พบข้อมูล history สำหรับ request_id นี้" });
    }

    const history_id = historyResult[0]?.history_id;
    console.log("🔍 history_id ที่ได้:", history_id);

    // ✅ ตรวจสอบค่า scores และ criteriaNames ก่อน Insert
    console.log("📊 scores ที่จะบันทึก:", scores);
    console.log("📋 criteriaNames ที่จะบันทึก:", criteriaDefaultNames);

    // ✅ เพิ่มข้อมูลลงตาราง adviser_evaluation_criteria และ adviser_evaluation
    const promises = criteriaDefaultNames.map((criteriaName, index) => {
      const score = scores[index];
      const criteria_id = require('crypto').randomUUID(); // ใช้ crypto สำหรับ UUID

      // เพิ่มข้อมูลลงในตาราง adviser_evaluation_criteria
      const insertCriteriaQuery = `
        INSERT INTO adviser_evaluation_criteria (criteria_id, criteria_name, create_up)
        VALUES (?, ?, NOW())`;

      db.promise().query(insertCriteriaQuery, [criteria_id, criteriaName]);

      // เพิ่มข้อมูลลงในตาราง adviser_evaluation
      const insertEvaluationQuery = `
        INSERT INTO adviser_evaluation (history_id, score, no, evaluation_date, comment, criteria_id)
        VALUES (?, ?, ?, ?, ?, ?)`;

      return db.promise().query(insertEvaluationQuery, [
        history_id,
        score,
        index + 1,
        new Date(),
        additionalComments || '',
        criteria_id
      ]);
    });

    // รอจนกว่าจะบันทึกข้อมูลทั้งหมดเสร็จ
    await Promise.all(promises);

    console.log("✅ บันทึกการประเมินสำเร็จ");
    res.status(201).json({ message: "บันทึกการประเมินสำเร็จ" });
  } catch (error) {
    console.error("❌ Error saving evaluation:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล", error: error.message });
  }
});

// 🏫 ดึงข้อมูลนักศึกษา
router.get('/get-all-students', async (req, res) => {
  try {
    const [students] = await db.promise().query(
      `SELECT u.user_id, u.name, u.email, s.student_code, ir.request_id
       FROM internship_request ir
       INNER JOIN user u ON ir.student_id = u.user_id
       INNER JOIN student s ON u.student_id = s.student_id
       WHERE ir.status = 'A' AND ir.delete_up IS NULL`
    );

    if (students.length === 0) {
      return res.status(404).json({ message: "ไม่พบนักศึกษาที่ได้รับการอนุมัติฝึกงาน" });
    }

    return res.status(200).json(students);
  } catch (error) {
    console.error("❌ Database Error:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลนักศึกษา" });
  }
});

module.exports = router;
