const express = require('express');
const router = express.Router();
const db = require('../db');

// แสดงข้อมูลผู้ใช้ทั้งหมด
router.get('/', (req, res) => {
    // เปลี่ยน student → user (ถ้าคุณตั้ง session.user)
    if (!req.session.user) {
        return res.redirect('/users/login');
    }

    const query = 'SELECT user_id, name, email, role, create_up FROM user';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            return res.status(500).send('Internal Server Error');
        }

        res.render('edit_user', { 
            user: req.session.user,  // ส่งข้อมูล session ที่ถูกต้องไปยัง view
            users: results 
        });
    });
});

module.exports = router;
