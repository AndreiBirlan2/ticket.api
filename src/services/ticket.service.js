const xlsx = require('xlsx');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash" 
});

const TicketService = {
    parseExcel(buffer) {
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = xlsx.utils.sheet_to_json(sheet);
        return rawData;
    },

    pickField(row, ...candidates) {
        if (!row) {
            return '';
        }

        function normalize(value) {
            return String(value)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        }

        const availableKeys = Object.keys(row);

        for (const candidate of candidates) {
            const normalizedCandidate = normalize(candidate);

            const matchedKey = availableKeys.find(key => normalize(key) === normalizedCandidate);

            if (!matchedKey) {
                continue;
            }

            const value = String(row[matchedKey]).trim();
            if (value) {
                return value;
            }
        }

        return '';
    },

    async analyzeTaskWithAI(rowData) {
        try {
            console.log('🤖 Analyzing with Gemini 2.5 Flash...');
            
            const prompt = `Analizează acest tichet și returnează STRICT JSON (fără markdown, fără explicații):
                {
                    "type": "Bug" sau "Feature",
                    "severity": "Critical" | "High" | "Medium" | "Low",
                    "summary": "titlu scurt și clar (max 80 caractere)",
                    "description": "descriere detaliată — NU LĂSA GOL. Dacă datele brute au câmp 'Descriere Eroare' sau 'Descriere' sau 'Description', preia conținutul de acolo și extinde-l. Dacă lipsește complet, generează o descriere pe baza titlului."
                }

                Date tichet brut (atenție: cheile pot fi în română — 'Titlu', 'Descriere Eroare', 'Tip', 'Severitate'):
                ${JSON.stringify(rowData, null, 2)}

                Reguli:
                - type = "Bug" dacă ceva nu funcționează corect, altfel "Feature"
                - severity = "Critical" pentru crash/blocker, "High" pentru major, "Medium" pentru normal, "Low" pentru minor
                - summary = rezumă problema într-o propoziție scurtă
                - description = detalii complete

                Răspunde DOAR cu JSON, fără text înainte sau după.`;

            const result = await model.generateContent(prompt);
            const response = result.response;
            const content = response.text();
            
            console.log('📥 Gemini response:', content.substring(0, 200));
            
            let cleanContent = content
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();
            
            const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in AI response');
            }
            
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('✅ Parsed AI result:', {
                type: parsed.type,
                severity: parsed.severity,
                summary: parsed.summary?.substring(0, 50) + '...'
            });

            const fallbackSummary = this.pickField(rowData, 'Titlu', 'Title', 'Summary', 'Issue');
            const fallbackDescription = this.pickField(rowData, 'Descriere Eroare', 'Descriere', 'Description', 'Details', 'Desc');
            const fallbackSteps = this.pickField(rowData, 'Steps to Reproduce', 'Steps', 'Pasi');
            
            return {
                summary: (parsed.summary && parsed.summary.trim()) || fallbackSummary || "New Ticket",
                description: (parsed.description && parsed.description.trim()) || fallbackDescription || "",
                type: parsed.type || "Bug",
                severity: parsed.severity || "Medium",
                stepsToReproduce: (parsed.steps && parsed.steps.trim()) || fallbackSteps,
                aiAnalyzed: true
            };

        } catch (error) {
            console.error("⚠️ AI analysis failed:", error.message);
            
            const text = JSON.stringify(rowData).toLowerCase();
            
            let type = 'Bug';
            const featureKeywords = ['feature', 'functionalitate', 'enhancement', 'nou', 'add', 'adauga', 'request'];
            if (featureKeywords.some(kw => text.includes(kw))) {
                type = 'Feature';
            }
            
            let severity = 'Medium';
            if (['crash', 'critical', 'blocker', 'urgent', 'down', 'picat', 'nu functioneaza'].some(kw => text.includes(kw))) {
                severity = 'Critical';
            } else if (['important', 'major', 'broken', 'high', 'stricat', 'nu merge'].some(kw => text.includes(kw))) {
                severity = 'High';
            } else if (['minor', 'low', 'cosmetic', 'typo', 'text'].some(kw => text.includes(kw))) {
                severity = 'Low';
            }
            
            console.log('📦 Using fallback classification:', { type, severity });
            
            return {
                summary: this.pickField(rowData, 'Titlu', 'Title', 'Summary', 'Issue') || "New Ticket",
                description: this.pickField(rowData, 'Descriere Eroare', 'Descriere', 'Description', 'Details', 'Desc'),
                type,
                severity,
                stepsToReproduce: this.pickField(rowData, 'Steps to Reproduce', 'Steps', 'Pasi'),
                aiAnalyzed: false
            };
        }
    },

    calculateDiceSimilarity(str1, str2) {
        const getBigrams = (str) => {
            const s = str.toLowerCase().replace(/\s+/g, '');
            const bigrams = new Set();
            for (let i = 0; i < s.length - 1; i++) {
                bigrams.add(s.substring(i, i + 2));
            }
            return bigrams;
        };

        if (!str1 || !str2) return 0;
        if (str1 === str2) return 1;

        const bigrams1 = getBigrams(str1);
        const bigrams2 = getBigrams(str2);
        
        let intersection = 0;
        for (const bigram of bigrams1) {
            if (bigrams2.has(bigram)) {
                intersection++;
            }
        }

        return (2 * intersection) / (bigrams1.size + bigrams2.size);
    },

    findDuplicates(newTicket, existingTickets, threshold = 0.6) {
        return existingTickets
            .map(existing => {
                const summarySim = this.calculateDiceSimilarity(newTicket.summary, existing.summary);
                const descSim = this.calculateDiceSimilarity(newTicket.description, existing.description);

                const totalSimilarity = (summarySim * 0.7) + (descSim * 0.3);

                return {
                    id: existing.id,
                    summary: existing.summary,
                    similarity: Math.round(totalSimilarity * 100)
                };
            })
            .filter(match => match.similarity >= threshold * 100)
            .sort((a, b) => b.similarity - a.similarity);
    }
};

module.exports = TicketService;