const express = require('express');
const router = express.Router();
const db = require('../db');

// Route ที่ใช้ในการแสดงหน้า assign mentor
router.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/users/login');
    }

    const { user } = req.session;

    // ดึงนักศึกษาทั้งหมด
    const studentQuery = `
        SELECT s.student_id, u.name 
        FROM student s
        JOIN user u ON s.student_id = u.student_id
    `;

    // ดึงพี่เลี้ยง (mentor) ทั้งหมดจาก user ที่ role = 'mentor'
    const mentorQuery = `
    SELECT u.user_id, u.name, mentor_id
    FROM user u
    WHERE u.role = 'mentor'
    `;

    // ดึงข้อมูลนักศึกษา
    db.query(studentQuery, (err, students) => {
        if (err) {
            console.error('Error fetching students:', err);
            return res.status(500).send('Error loading students');
        }

        // ดึงข้อมูลพี่เลี้ยง
        db.query(mentorQuery, (err, mentors) => {
            if (err) {
                console.error('Error fetching mentors:', err);
                return res.status(500).send('Error loading mentors');
            }

            // ตรวจสอบข้อมูล mentors
            console.log(mentors); // เพิ่มบรรทัดนี้เพื่อเช็คข้อมูลพี่เลี้ยง

            // ส่งข้อมูลไปที่ view
            res.render('assign_mentor', {
                title: 'เพิ่มพี่เลี้ยง',
                user,
                students,
                mentors
            });
        });
    });
});
router.post('/assign', (req, res) => {
    const { student_id, mentor_id } = req.body;

    console.log("Student ID:", student_id);
    console.log("Mentor ID:", mentor_id);

    if (!Array.isArray(student_id) && !student_id) {
        return res.status(400).send('ข้อมูลไม่ครบถ้วน');
    }

    if (!mentor_id) {
        return res.status(400).send('ไม่พบ mentor_id');
    }

    // ตรวจสอบว่า mentor_id ที่ส่งมามีอยู่ในฐานข้อมูลและมีบทบาทเป็น "mentor"
    const checkMentorQuery = 'SELECT * FROM user WHERE mentor_id = ? AND role = "mentor"';
    db.query(checkMentorQuery, [mentor_id], (err, result) => {
        if (err) {
            console.error('เกิดข้อผิดพลาดในการตรวจสอบพี่เลี้ยง:', err);
            return res.status(500).send('เกิดข้อผิดพลาดในการตรวจสอบพี่เลี้ยง');
        } else if (result.length === 0) {
            console.log(`ไม่พบ mentor_id: ${mentor_id} ในฐานข้อมูล`);
            return res.status(400).send('ไม่พบพี่เลี้ยงที่เลือก');
        } else {
            // ใช้ mentor_id ในการอัปเดต student_id
            const updateQuery = 'UPDATE user SET mentor_id = ? WHERE student_id = ?';

            const updatePromises = (Array.isArray(student_id) ? student_id : [student_id]).map(id => {
                return new Promise((resolve, reject) => {
                    db.query(updateQuery, [mentor_id, id], (err) => {
                        if (err) {
                            console.error('อัปเดตผิดพลาดสำหรับ student_id:', id, err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            });

            Promise.all(updatePromises)
    .then(() => {
        console.log("✅ บันทึกการประเมินสำเร็จ");
        // ส่งคำตอบไปยัง client ครั้งเดียว
        res.status(201).json({ message: "บันทึกการประเมินสำเร็จ" });
    })
    .catch((error) => {
        console.error("❌ Error during evaluation saving:", error);
        // ส่งคำตอบเมื่อเกิดข้อผิดพลาด
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล", error: error.message });
    });
        }
    });
});

module.exports = router;
