const express = require('express');
const multer = require('multer');
const authGuard = require('../middleware/auth.guard');
const TicketService = require('../services/ticket.service');
const TicketRepository = require('../repositories/ticket.repository');
const NotificationRepository = require('../repositories/notification.repository');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/tickets - Fetch all tickets for the dashboard
router.get('/', authGuard, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 100;

    const tickets = await TicketRepository.getByUserId(userId, limit);

    const stats = {
      totalTickets: tickets.length,
      byType: {
        bug: tickets.filter(t => t.type === 'Bug').length,
        feature: tickets.filter(t => t.type === 'Feature').length
      },
      byStatus: {
        pending: tickets.filter(t => t.status === 'pending').length,
        approved: tickets.filter(t => t.status === 'approved').length,
        exported: tickets.filter(t => t.status === 'exported').length
      },
      bySeverity: {
        critical: tickets.filter(t => t.severity === 'Critical').length,
        high: tickets.filter(t => t.severity === 'High').length,
        medium: tickets.filter(t => t.severity === 'Medium').length,
        low: tickets.filter(t => t.severity === 'Low').length
      }
    };

    res.json({
      success: true,
      tickets: tickets,
      total: tickets.length,
      stats: stats
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// POST /api/tickets/upload - Upload and process Excel
router.post('/upload', authGuard, upload.single('file'), async (req, res) => {
  let processedTickets = []; 
  let sessionId = null;
  let duplicateCount = 0;

  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const existingTickets = await TicketRepository.getByUserId(req.user.id, 1000);

    const rawRows = TicketService.parseExcel(req.file.buffer);
    
    sessionId = await TicketRepository.createUploadSession({
      userId: req.user.id,
      fileName: req.file.originalname,
      ticketCount: rawRows.length
    });

    for (const row of rawRows) {
      const aiResult = await TicketService.analyzeTaskWithAI(row);

      const potentialDuplicates = TicketService.findDuplicates(aiResult, existingTickets, 0.6);
      
      if (potentialDuplicates.length > 0) {
        duplicateCount++;
      }

      const ticketData = {
        ...aiResult,
        userId: req.user.id,
        sessionId: sessionId,
        status: 'pending', 
        reporter: 'System',
        originalText: JSON.stringify(row),
        stepsToReproduce: aiResult.stepsToReproduce || ''
      };

      const newTicketId = await TicketRepository.createTicket(ticketData);

      processedTickets.push({
        id: newTicketId,
        ...ticketData,
        duplicates: potentialDuplicates,
        createdAt: new Date() 
      });
    }

    await NotificationRepository.create({
      userId: req.user.id,
      type: 'upload',
      title: 'Fișier procesat',
      message: `${processedTickets.length} tichete extrase din "${req.file.originalname}"`
    });

    if (duplicateCount > 0) {
      await NotificationRepository.create({
        userId: req.user.id,
        type: 'duplicate',
        title: 'Duplicate detectate',
        message: `${duplicateCount} tichete au similarități cu tichete existente`
      });
    }

    const criticalCount = processedTickets.filter(t => t.severity === 'Critical').length;
    if (criticalCount > 0) {
      await NotificationRepository.create({
        userId: req.user.id,
        type: 'critical',
        title: 'Tichete Critical detectate!',
        message: `${criticalCount} tichete necesită atenție imediată`
      });
    }

    res.json({
      success: true,
      session: {
        id: sessionId,
        fileName: req.file.originalname
      },
      stats: {
        total: processedTickets.length,
        bugs: processedTickets.filter(t => t.type === 'Bug').length,
        features: processedTickets.filter(t => t.type === 'Feature').length,
        critical: criticalCount,
        withDuplicates: duplicateCount
      },
      tickets: processedTickets
    });

  } catch (error) {
    console.error('CRASH IN UPLOAD:', error);
    res.status(500).json({ error: "Failed to process upload" });
  }
});

// PUT /api/tickets/:id - Edit a ticket
router.put('/:id', authGuard, async (req, res) => {
  try {
    if(TicketRepository.updateTicket) {
       await TicketRepository.updateTicket(req.params.id, req.body);
    }
    res.json({ success: true, id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: "Failed to update ticket" });
  }
});

// POST /api/tickets/:id/approve - Approve a ticket
router.post('/:id/approve', authGuard, async (req, res) => {
  try {
    if (TicketRepository.updateTicketStatus) {
      await TicketRepository.updateTicketStatus(req.params.id, 'approved');
    } 
    res.json({ success: true, id: req.params.id, status: 'approved' });
  } catch (error) {
    res.status(500).json({ error: "Failed to approve ticket" });
  }
});

router.get('/jira/config-status', authGuard, (req, res) => {
  const isConfigured = !!(
    process.env.JIRA_INSTANCE_URL && 
    process.env.JIRA_API_TOKEN && 
    process.env.JIRA_PROJECT_KEY
  );
  
  res.json({ configured: isConfigured });
});

router.get('/stats', authGuard, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const tickets = await TicketRepository.getByUserId(userId, 5000); 

    const stats = {
      totalTickets: tickets.length,
      byType: {
        bug: tickets.filter(t => t.type === 'Bug').length,
        feature: tickets.filter(t => t.type === 'Feature').length
      },
      byStatus: {
        pending: tickets.filter(t => t.status === 'pending').length,
        approved: tickets.filter(t => t.status === 'approved').length,
        exported: tickets.filter(t => t.status === 'exported').length
      },
      bySeverity: {
        critical: tickets.filter(t => t.severity === 'Critical').length,
        high: tickets.filter(t => t.severity === 'High').length,
        medium: tickets.filter(t => t.severity === 'Medium').length,
        low: tickets.filter(t => t.severity === 'Low').length
      }
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;