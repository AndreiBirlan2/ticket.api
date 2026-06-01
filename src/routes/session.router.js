const express = require('express');
const authGuard = require('../middleware/auth.guard');
const router = express.Router();

router.get('/', authGuard, async (req, res) => {
  res.json([]);
});

router.post('/:id/approve-all', authGuard, async (req, res) => {
  res.json({ approved: 0 });
});

module.exports = router;