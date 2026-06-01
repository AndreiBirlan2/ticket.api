const express = require('express');
const authGuard = require('../middleware/auth.guard');
const router = express.Router();

router.get('/', authGuard, async (req, res) => {
  res.json({
    totalTickets: 0,
    byStatus: { pending: 0, approved: 0, exported: 0 },
    byType: { bug: 0, feature: 0 },
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0 }
  });
});

module.exports = router;