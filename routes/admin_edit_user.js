const express = require('express');
const router = express.Router();
const db = require('../db');

// ✅ Route: แสดงฟอร์มแก้ไขผู้ใช้
router.get('/:user_id', (req, res) => {
    const userId = req.params.user_id;

    // คำสั่ง SQL ที่ใช้ JOIN ตาราง user, student, company และ position_open
    const sql = `
     SELECT 
    u.user_id, u.name, u.email, u.role, u.create_up, 
    s.student_id, s.major, s.graduation_status, s.internship_status, 
    c.company_id, c.name AS company_name, c.address AS company_address, 
    po.position_id, po.position_name
    FROM user u
    LEFT JOIN student s ON u.user_id = s.student_id  -- เปลี่ยนจาก u.user_id เป็น s.student_id
    LEFT JOIN company c ON s.student_id = c.company_id  -- ปรับการเชื่อมโยงระหว่าง student และ company
    LEFT JOIN position_open po ON c.company_id = po.company_id
    WHERE u.user_id = ?
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้:', err);
            return res.status(500).send('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        }
        if (results.length === 0) {
            return res.status(404).send('ไม่พบผู้ใช้ที่ต้องการแก้ไข');
        }

        const user = results[0];
        res.render('admin_edit_user', { user }); // ส่ง user ไปหน้า view
    });
});

// ✅ Route: รับข้อมูลจากฟอร์มและอัปเดตใน DB
router.post('/:user_id', (req, res) => {
    const userId = req.params.user_id;
    const { name, email, role, major, status, company, position, department, evaluationArea } = req.body;

    // อัปเดตข้อมูลในตาราง user
    let updateFields = { name, email, role };

    // เพิ่มเงื่อนไขอัปเดตข้อมูลแต่ละ role
    if (role === 'student') {
        // ไม่อัปเดต status ที่ตาราง user
    } else if (role === 'mentor') {
        updateFields.company = company;
        updateFields.position = position;
    } else if (role === 'adviser') {
        updateFields.department = department;
    } else if (role === 'evaluator') {
        updateFields.evaluation_area = evaluationArea;
    }

    // คำสั่งอัปเดตข้อมูลในตาราง user
    const sqlUser = 'UPDATE user SET ? WHERE user_id = ?';
    db.query(sqlUser, [updateFields, userId], (err, result) => {
        if (err) {
            console.error('เกิดข้อผิดพลาดในการอัปเดตข้อมูลผู้ใช้:', err);
            return res.status(500).send('เกิดข้อผิดพลาดในการอัปเดตข้อมูล');
        }

        // ถ้า role เป็น 'student' ให้ไปอัปเดตข้อมูลในตาราง student ด้วย
        if (role === 'student') {
            const sqlStudent = `
                UPDATE student 
                SET major = ?, internship_status = ? 
                WHERE student_id = (SELECT student_id FROM user WHERE user_id = ?)
            `;
            db.query(sqlStudent, [major, status, userId], (err, result) => {
                if (err) {
                    console.error('เกิดข้อผิดพลาดในการอัปเดตข้อมูลนักศึกษา:', err);
                    return res.status(500).send('เกิดข้อผิดพลาดในการอัปเดตข้อมูลนักศึกษา');
                }
                res.redirect('/edit_user'); // กลับไปยังหน้ารายชื่อผู้ใช้
            });
        } else {
            res.redirect('/edit_user'); // กลับไปยังหน้ารายชื่อผู้ใช้
        }
    });
});
module.exports = router;
