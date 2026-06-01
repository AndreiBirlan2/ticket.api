const JiraService = {
  async createIssue(ticket) {
    const { 
      JIRA_INSTANCE_URL, 
      JIRA_USERNAME, 
      JIRA_API_TOKEN, 
      JIRA_PROJECT_KEY 
    } = process.env;

    if (!JIRA_INSTANCE_URL || !JIRA_API_TOKEN) {
      throw new Error("Jira integration is not configured in .env");
    }

    const auth = Buffer.from(`${JIRA_USERNAME}:${JIRA_API_TOKEN}`).toString('base64');
    console.log('>>>>>> ', ticket)
    const body = {
      fields: {
        project: { key: JIRA_PROJECT_KEY },
        summary: ticket.summary,
        description: {
          version: 1,
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: ticket.description || 'No description provided.' }]
          }]
        },
        issuetype: { name: ticket.type === 'Bug' ? 'Bug' : 'Task' }
      }
    };

    const response = await fetch(`${JIRA_INSTANCE_URL}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Jira API Error: ${errorData}`);
    }

    return await response.json(); // Returns { id, key, self }
  }
};

module.exports = JiraService;