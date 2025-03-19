var express = require('express');
var router = express.Router();
const db = require('../db');


function checkRole(requiredRole) {
  return (req, res, next) => {
    if (!req.session.user) {
      req.session.user = null;
      return res.redirect('/users/login');
    }

    const userRole = req.session.user.role?.toLowerCase();
    if (!userRole || userRole !== requiredRole.toLowerCase()) {
      return res.status(403).send('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
    }

    // ส่ง user ไปยัง ejs template
    res.locals.user = req.session.user; // ส่ง user ไปยังทุกหน้า
    next();
  };
}

router.get("/", (req, res) => {
  console.log("📢 กำลังเข้าถึงเส้นทาง /check_report");

  if (!req.session.user) {
    return res.redirect("/users/login");
  }

  const { user } = req.session;
  const teacher = user.teacher;

  const sql = `
  SELECT ad.document_id, ad.document_type, ad.file_path, ad.create_up,
         u.name AS student_name,  -- ดึงชื่อจากตาราง user
         c.name AS company_name,
         r.status
  FROM approval_document ad
  LEFT JOIN internship_request r ON ad.request_id = r.request_id  
  LEFT JOIN user u ON r.student_id = u.user_id  -- เชื่อมโยง student_id กับ user_id
  LEFT JOIN company c ON r.company_id = c.company_id
  WHERE ad.request_id IS NOT NULL;  -- กรองเฉพาะ request_id ที่ไม่ใช่ NULL
`;

  db.query(sql, (error, results) => {
    if (error) {
      console.error("❌ Error fetching documents:", error);
      return res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูล");
    }

    console.log("✅ ข้อมูลที่ดึงมา:", results);

    res.render("check_report", {
      title: "รายงานการฝึกงาน",
      user: user,
      teacher: teacher,
      documents: results.length > 0 ? results : [],
      message: results.length > 0 ? "" : "ไม่มีเอกสารที่ต้องตรวจสอบ"
    });
  });
});

router.get("/report_evaluation", (req, res) => {
  const { user, teacher } = req.session;
  const documentId = req.query.document_id;
  const baseUrl = req.protocol + "://" + req.get("host"); // สร้าง baseUrl

  const sql = `
    SELECT ad.document_id, ad.document_type, ad.file_path, ad.create_up,
           u.name AS student_name,
           c.name AS company_name,
           r.status
    FROM approval_document ad
    LEFT JOIN internship_request r ON ad.request_id = r.request_id  
    LEFT JOIN user u ON r.student_id = u.user_id
    LEFT JOIN company c ON r.company_id = c.company_id
    WHERE ad.document_id = ?;
  `;

  db.query(sql, [documentId], (error, results) => {
    if (error) {
      console.error("❌ Error fetching document:", error);
      return res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูล");
    }

    if (results.length === 0) {
      return res.status(404).send("❌ ไม่พบเอกสาร");
    }

    res.render("report_evaluation", {
      document: results[0],
      user: user,
      teacher: teacher,
      title: "ประเมินรายงาน",
      baseUrl: baseUrl  // ส่ง baseUrl ไปยัง EJS
    });
  });
});
router.post("/submit_evaluation", async (req, res) => {
  console.log("🔹 [START] รับคำขอ POST /submit_evaluation");
  console.log("📩 ข้อมูลที่ได้รับจากฟอร์ม:", req.body);

  const { scores, round, additionalComments, documentId } = req.body;
  const { user } = req.session;

  if (!user || !user.id) {
    console.error("❌ [ERROR] ไม่มี session ผู้ใช้ หรือ user_id ไม่ถูกต้อง", req.session);
    return res.status(401).send("❌ ไม่มีการตรวจสอบผู้ใช้");
  }

  const assign_by = user.id;

  if (!scores || !documentId || scores.length === 0) {
    console.error("❌ [ERROR] ข้อมูลไม่ครบถ้วน");
    return res.status(400).send("❌ ข้อมูลไม่ครบถ้วน");
  }

  try {
    // 1. ดึง `student_id` จาก `internship_history` โดยใช้ `document_id`
    const studentQuery = `
      SELECT ih.student_id, ih.history_id 
      FROM internship_history ih
      JOIN approval_document ad ON ad.request_id = ih.internship_request_id
      WHERE ad.document_id = ?
    `;

    const [studentRows] = await db.promise().query(studentQuery, [documentId]);

    if (studentRows.length === 0) {
      console.error("❌ [ERROR] ไม่พบ studentId สำหรับ document_id:", documentId);
      return res.status(400).send("❌ ไม่พบ studentId");
    }

    const studentId = studentRows[0].student_id;
    const historyId = studentRows[0].history_id;
    console.log("👤 [Student] studentId:", studentId);
    console.log("📜 [History] historyId:", historyId);

    // 2. ดึง `criteria_id` จาก `adviser_evaluation_criteria`
    let criteriaQuery = "SELECT criteria_id FROM adviser_evaluation_criteria ORDER BY create_up ASC";
    let [criteriaRows] = await db.promise().query(criteriaQuery);

    if (criteriaRows.length < 6) {
      console.log("❌ [ERROR] จำนวนหัวข้อการประเมินไม่ครบ 6 หัวข้อ, ทำการเพิ่มข้อมูล...");

      const insertQuery = `
        INSERT INTO adviser_evaluation_criteria (criteria_id, criteria_name, create_up)
        VALUES
        (UUID(), 'Criteria 5', NOW()),
        (UUID(), 'Criteria 6', NOW());
      `;

      await db.promise().query(insertQuery);

      [criteriaRows] = await db.promise().query(criteriaQuery);
      console.log("✅ [Criteria] เพิ่มข้อมูลสำเร็จ และดึงข้อมูลใหม่");
    }

    console.log("📝 [Criteria] จำนวนหัวข้อจากฐานข้อมูล:", criteriaRows.length);
    console.log("📝 [Scores] จำนวนคะแนนที่ได้รับ:", scores.length);

    if (criteriaRows.length !== scores.length) {
      console.error("❌ [ERROR] จำนวนหัวข้อการประเมินและคะแนนไม่ตรงกัน");
      return res.status(400).send(`❌ จำนวนหัวข้อการประเมิน (${criteriaRows.length}) และคะแนน (${scores.length}) ไม่ตรงกัน`);
    }

    const evaluation_date = new Date().toISOString().split("T")[0];
    const comment = additionalComments || "";

    // 3. บันทึกข้อมูลลง adviser_evaluation โดยใช้ historyId
    const sql = `
      INSERT INTO adviser_evaluation 
      (evaluation_id, history_id, no, score, round, evaluation_date, comment, assign_by, criteria_id, create_up) 
      VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const promises = scores.map((score, index) => {
      const no = index + 1;
      const criteria_id = criteriaRows[index].criteria_id;

      console.log(`🔹 [INSERT] หัวข้อที่ ${no} | คะแนน: ${score} | criteria_id: ${criteria_id}`);

      return db.promise().query(sql, [
        historyId, // ใช้ `historyId` แทน `studentId`
        no, score, round, evaluation_date, comment, assign_by, criteria_id
      ]);
    });

    await Promise.all(promises);

    console.log("🎉 [SUCCESS] บันทึกการประเมินสำเร็จ");
    res.redirect(`/report_evaluation?document_id=${documentId}`);
  } catch (error) {
    console.error("❌ [ERROR] เกิดข้อผิดพลาดในการประมวลผล:", error);
    res.status(500).send("เกิดข้อผิดพลาดในการประมวลผล");
  }
});

module.exports = router;