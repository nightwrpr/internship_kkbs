const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const db = require('../db'); // เชื่อมต่อกับฐานข้อมูล

// แสดงฟอร์มเพิ่มผู้ใช้
router.get('/', (req, res) => {
    res.render('add_user'); // เพิ่ม view ชื่อ 'addUser' ให้ตรงกับชื่อไฟล์ที่ใช้
});

// เพิ่มผู้ใช้ใหม่
router.post('/', async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).send('กรุณากรอกข้อมูลให้ครบถ้วน');
    }

    const user_id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    // เตรียมค่าเริ่มต้น
    let mentor_id = null;
    let adviser_id = null;
    let student_id = null;
    let evaluator_id = null;

    // ถ้าเป็น student สร้าง student_id ใหม่และเพิ่มข้อมูลลงในตาราง student
    if (role === 'student') {
        student_id = uuidv4();  // สร้าง student_id ใหม่

        // เพิ่มข้อมูล student ลงในตาราง student
        const studentQuery = `
            INSERT INTO student (student_id, student_code, major, graduation_status, internship_status, create_up)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        
        const studentValues = [student_id, 'student_code_' + student_id, 'Major', 'In Progress', 'Not Started'];

        try {
            // ใช้ promise ในการ query
            await db.promise().query(studentQuery, studentValues);
        } catch (err) {
            console.error('❌ Error inserting student data:', err);
            return res.status(500).send('เกิดข้อผิดพลาดในการบันทึกข้อมูลนักเรียน');
        }
    } else if (role === 'mentor') {
        mentor_id = uuidv4();
    } else if (role === 'adviser') {
        adviser_id = uuidv4();
    } else if (role === 'evaluator') {
        evaluator_id = uuidv4();
    }

    // เพิ่มข้อมูล user ลงในตาราง user
    const query = `
        INSERT INTO user (user_id, name, email, password, role, mentor_id, adviser_id, student_id, evaluator_id, create_up)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const values = [user_id, name, email, hashedPassword, role, mentor_id, adviser_id, student_id, evaluator_id];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error('❌ Error inserting user:', err);
            return res.status(500).send('เกิดข้อผิดพลาดในการบันทึกผู้ใช้');
        }

        console.log('✅ เพิ่มผู้ใช้ใหม่สำเร็จ');
        return res.redirect('/admin/dashboard'); // หรือเส้นทางที่ต้องการให้กลับไปหลังเพิ่มข้อมูล
    });
});

module.exports = router;
