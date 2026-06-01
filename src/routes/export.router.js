const express = require('express');
const authGuard = require('../middleware/auth.guard');
const TicketRepository = require('../repositories/ticket.repository');
const NotificationRepository = require('../repositories/notification.repository');
const JiraService = require('../services/jira.service');

const router = express.Router();

router.post('/jira', authGuard, async (req, res) => {
  const { ticketIds } = req.body;

  if (!ticketIds || !Array.isArray(ticketIds)) {
    return res.status(400).json({ error: "Invalid ticket IDs" });
  }

  const results = [];
  
  for (const id of ticketIds) {
    try {
      const ticket = await TicketRepository.findById(id);
      
      if (!ticket || ticket.userId !== req.user.id || ticket.status !== 'approved') {
        results.push({ 
          ticketId: id, 
          success: false, 
          error: 'Ticket not found or not approved' 
        });
        continue;
      }

      // Apelăm serviciul de Jira
      const jiraIssue = await JiraService.createIssue(ticket);

      // Marcăm în baza de date
      await TicketRepository.markAsExported(id, jiraIssue.key);

      results.push({ 
        ticketId: id, 
        success: true, 
        jiraKey: jiraIssue.key 
      });
      
    } catch (error) {
      console.error(`Export failed for ticket ${id}:`, error.message);
      results.push({ 
        ticketId: id, 
        success: false, 
        error: error.message 
      });
    }
  }

  // CALCULĂM STATISTICILE
  const exportedCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

  // Adăugăm notificarea în baza de date
  if (exportedCount > 0) {
    await NotificationRepository.create({
      userId: req.user.id,
      type: 'export',
      title: 'Export Jira finalizat',
      message: `${exportedCount} tichete exportate cu succes`,
      data: { exportedCount }
    });
  }

  // Trimitem obiectul complet așteptat de frontend
  res.json({ 
    exported: exportedCount,
    failed: failedCount,
    results 
  }); 
});

module.exports = router;