var express = require('express');
var router = express.Router();
const db = require('../db');  // เชื่อมต่อฐานข้อมูล

// Route หน้า teacher/dashboard
router.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/users/login');
  }

  const { user } = req.session;
  const teacher = user.teacher; // ดึงข้อมูลนักศึกษาจาก session
  
  // ดึงข้อมูลผู้ใช้จากฐานข้อมูล
  db.query('SELECT * FROM user', (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send("มีข้อผิดพลาดในการดึงข้อมูล");
    }

    // ส่งข้อมูล user และ teacher ไปยัง view พร้อมกับข้อมูลจากฐานข้อมูล
    res.render('manage_user', {
      title: 'หน้าแรก',
      user: user,
      teacher: teacher,
      users: result // ส่งข้อมูลจากฐานข้อมูลไปยัง view
    });
  });
});

module.exports = router;
