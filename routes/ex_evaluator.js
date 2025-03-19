// evaluator.js (routes/evaluator.js)
var express = require('express');
var router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// โหลดหน้า evaluator (แสดงหน้า HTML)
router.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/users/login');
    }

    const { user } = req.session;
    const evaluator = user.evaluator;

    res.render('ex_evaluator', {
        title: 'หน้าแรก',
        user: user,
        evaluator: evaluator
    });
});

// routes/evaluator.js
router.get('/data', async (req, res) => {
    const { user } = req.session;
    if (!user) {
        return res.status(401).json({ message: "กรุณาเข้าสู่ระบบก่อน" });
    }

    const sql = `SELECT u.user_id, u.name, u.email, s.student_code, ir.request_id
                 FROM internship_request ir
                 INNER JOIN user u ON ir.student_id = u.user_id
                 INNER JOIN student s ON u.student_id = s.student_id
                 WHERE ir.status = 'A' AND ir.delete_up IS NULL;`;

    try {
        const [students] = await db.promise().query(sql);
        if (students.length === 0) {
            return res.status(404).json({ message: "ไม่พบนักศึกษาที่ได้รับการอนุมัติฝึกงาน" });
        }

        return res.status(200).json(students);
    } catch (error) {
        console.error('❌ Database Error:', error);
        return res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลนักศึกษา" });
    }
});
// บันทึกการประเมินโดย evaluator
router.post('/dashboard/save', async (req, res) => {
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
        "ความรับผิดชอบต่อหน้าที่", 
        "การทำงานเป็นทีม", 
        "ความตรงต่อเวลา", 
        "ความคิดริเริ่มและความสร้างสรรค์", 
        "การสื่อสารและการนำเสนอ", 
        "การแก้ไขปัญหาเฉพาะหน้า", 
        "บุคลิกภาพและการวางตัว"
    ];

    try {
        const [historyRows] = await db.promise().query('SELECT history_id FROM internship_history WHERE internship_request_id = ?', [request_id]);

        if (historyRows.length === 0) {
            return res.status(404).json({ message: "ไม่พบข้อมูลการฝึกงานของนักศึกษาคนนี้" });
        }

        const history_id = historyRows[0].history_id;

        const promises = criteriaDefaultNames.map((criteriaName, index) => {
            const score = scores[index];
            const criteria_id = require('crypto').randomUUID(); // ใช้ crypto สำหรับ UUID

            const insertCriteriaQuery = `INSERT INTO evaluator_evaluation_criteria (criteria_id, criteria_name, create_up) VALUES (?, ?, NOW())`;
            const insertEvaluationQuery = `INSERT INTO evaluator_evaluation (history_id, score, no, evaluation_date, comment, criteria_id) VALUES (?, ?, ?, ?, ?, ?)`;

            return new Promise((resolve, reject) => {
                db.promise().query(insertCriteriaQuery, [criteria_id, criteriaName])
                    .then(() => {
                        return db.promise().query(insertEvaluationQuery, [
                            history_id,
                            score,
                            index + 1,
                            new Date(),
                            additionalComments || '',
                            criteria_id
                        ]);
                    })
                    .then(() => resolve())
                    .catch((err) => reject(err));
            });
        });

        // รอจนกว่าการบันทึกข้อมูลทั้งหมดจะเสร็จ
        await Promise.all(promises);

        res.status(201).json({ message: "บันทึกการประเมินสำเร็จ" });
    } catch (error) {
        console.error("❌ Error during evaluation saving:", error);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล", error: error.message });
    }
});

module.exports = router;
