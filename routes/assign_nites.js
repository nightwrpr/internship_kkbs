var express = require('express');
var router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/users/login');
    }

    const { user } = req.session;

    // ดึงนักศึกษา
    const studentQuery = `
        SELECT u.user_id, u.name, s.student_code 
        FROM user u
        JOIN student s ON u.student_id = s.student_id
        WHERE u.role = 'student'
    `;

    // ดึงอาจารย์นิเทศ (role = 'teacher')
    const mentorQuery = `
        SELECT user_id, name 
        FROM user 
        WHERE role = 'teacher'
    `;

    db.query(studentQuery, (err, students) => {
        if (err) {
            console.error('Error fetching students:', err);
            return res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลนักศึกษา');
        }

        db.query(mentorQuery, (err, mentors) => {
            if (err) {
                console.error('Error fetching mentors:', err);
                return res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลอาจารย์นิเทศ');
            }

            res.render('assign_nites', {
                title: 'เพิ่มอาจารย์นิเทศให้กับนักศึกษา',
                user: user,
                students: students,
                mentors: mentors
            });
        });
    });
});

module.exports = router;
