const express = require('express');
const authGuard = require('../middleware/auth.guard');
const router = express.Router();

router.get('/jira', authGuard, async (req, res) => {
  res.json({ configured: false, instanceUrl: null });
});

module.exports = router;