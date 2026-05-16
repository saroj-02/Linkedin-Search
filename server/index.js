const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'students.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');

// Helper to read history
const readHistory = () => {
    try {
        if (!fs.existsSync(HISTORY_FILE)) {
            fs.writeFileSync(HISTORY_FILE, '[]');
            return [];
        }
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        return [];
    }
};

// Helper to write history
const writeHistory = (history) => {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch (error) {}
};

app.use(cors());
app.use(bodyParser.json());

// Helper to read data
const readData = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, '[]');
            return [];
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        if (!data || data.trim() === '') return [];
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Error reading data:', error);
        return [];
    }
};

// Helper to write data
const writeData = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing data:', error);
    }
};

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all students
app.get('/api/students', (req, res) => {
    const students = readData();
    res.json(students);
});

// Search students
app.get('/api/students/search', (req, res) => {
    const { q, year } = req.query;
    let students = readData();

    if (q) {
        const query = q.toLowerCase();
        students = students.filter(s => 
            (s.name && s.name.toLowerCase().includes(query)) || 
            (s.email && s.email.toLowerCase().includes(query))
        );
    }

    if (year) {
        students = students.filter(s => s.year === parseInt(year));
    }

    res.json(students);
});

// Get all history
app.get('/api/history', (req, res) => {
    const history = readHistory();
    res.json(history);
});

// Get settings
app.get('/api/settings', (req, res) => {
    res.json({
        serper: process.env.SERPER_API_KEY ? 'Configured (Active)' : 'Missing',
        proxycurl: process.env.PROXYCURL_API_KEY ? 'Configured (Active)' : 'Missing',
        apollo: process.env.APOLLO_API_KEY ? 'Configured (Active)' : 'Missing',
        rapidapi_host: process.env.RAPIDAPI_HOST || 'None'
    });
});

// API BASED FETCHING: Fetch from LinkedIn (Smart NinjaPear/Apollo Integration)
app.post('/api/fetch-linkedin', async (req, res) => {
    const { year } = req.body;
    const APOLLO_KEY = process.env.APOLLO_API_KEY;
    const PROXYCURL_KEY = process.env.PROXYCURL_API_KEY;
    const SERPER_KEY = process.env.SERPER_API_KEY;
    
    if (!year) {
        return res.status(400).json({ error: "Graduation year is required" });
    }

    console.log(`[API] Starting LinkedIn search workflow for class of ${year}...`);

    try {
        let newCandidates = [];
        let sourceUsed = "";

        // --- STEP 1: SERPER.DEV (PAGINATED DISCOVERY) ---
        if (SERPER_KEY && SERPER_KEY !== 'your_serper_key') {
            console.log(`[API] Step 1: Trying Serper.dev (Multiple Pages)...`);
            try {
                // Fetch up to 3 pages for more results
                for (let page = 1; page <= 3; page++) {
                    console.log(`[API] Fetching Serper page ${page}...`);
                    const response = await axios.post('https://google.serper.dev/search', {
                        q: `linkedin student "class of ${year}"`,
                        num: 10,
                        page: page
                    }, {
                        headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' }
                    });

                    const organic = response.data.organic || [];
                    if (organic.length > 0) {
                        const pageCandidates = organic.map(item => ({
                            id: `serper_${Math.random().toString(36).substr(2, 9)}`,
                            name: item.title ? item.title.split('-')[0].split('|')[0].trim() : "LinkedIn Candidate",
                            year: parseInt(year),
                            email: "Available on Profile",
                            phone: "Available on Profile",
                            linkedin: item.link,
                            status: "Lead Found (Serper.dev)"
                        }));
                        newCandidates = [...newCandidates, ...pageCandidates];
                    } else {
                        break; // Stop if no more results
                    }
                }
                if (newCandidates.length > 0) sourceUsed = "Serper.dev";
            } catch (err) {
                console.error('Serper.dev Error:', err.message);
            }
        }

        // --- STEP 2: PROXYCURL (HIGH-QUALITY ENRICHED SEARCH) ---
        if (newCandidates.length === 0 && PROXYCURL_KEY && PROXYCURL_KEY !== 'your_proxycurl_key') {
            console.log(`[API] Step 2: Trying NinjaPear (Paginated Search)...`);
            try {
                for (let page = 1; page <= 2; page++) {
                    const response = await axios.get('https://nubela.co/api/v1/employee/search', {
                        params: {
                            role: 'Student',
                            role_search: `Student graduate ${year}`,
                            page_size: 50,
                            page: page,
                            enrich_profiles: 'enrich'
                        },
                        headers: { 'X-Api-Key': PROXYCURL_KEY }
                    });
                    
                    const results = response.data.results || [];
                    if (results.length > 0) {
                        const pageCandidates = results.map(profile => ({
                            id: `proxy_${profile.id || Math.random()}`,
                            name: profile.full_name || "Unknown Candidate",
                            year: parseInt(year),
                            email: profile.work_email || profile.personal_emails?.[0] || "Not Available",
                            phone: profile.phone_numbers?.[0] || "Not Available",
                            linkedin: profile.linkedin_url || "Not Available",
                            status: "Real Lead (NinjaPear)"
                        }));
                        newCandidates = [...newCandidates, ...pageCandidates];
                    } else {
                        break;
                    }
                }
                if (newCandidates.length > 0) sourceUsed = "NinjaPear";
            } catch (err) {
                console.error('Proxycurl Error:', err.response?.data || err.message);
            }
        }

        // --- STEP 3: APOLLO.IO (ROBUST B2B FALLBACK) ---
        if (newCandidates.length === 0 && APOLLO_KEY && APOLLO_KEY !== 'your_apollo_key') {
            console.log(`[API] Step 3: Trying Apollo.io (api_search)...`);
            try {
                const response = await axios.post('https://api.apollo.io/v1/mixed_people/api_search', {
                    q_person_title_tags: ["student", "intern"],
                    q_person_keywords: `graduate ${year}`,
                    per_page: 50
                }, {
                    headers: { 'x-api-key': APOLLO_KEY, 'Content-Type': 'application/json' }
                });

                const people = response.data.people || [];
                newCandidates = people.map(person => ({
                    id: `apollo_${person.id}`,
                    name: person.name || "Unknown Candidate",
                    year: parseInt(year),
                    email: person.email || person.personal_emails?.[0] || "Not Available",
                    phone: person.phone_numbers?.[0]?.sanitized_number || "Not Available",
                    linkedin: person.linkedin_url || `https://linkedin.com/in/${person.id}`,
                    status: "Real Lead (Apollo.io)"
                }));
                sourceUsed = "Apollo.io";
            } catch (err) {
                console.error('Apollo Error:', err.message);
            }
        }

        // --- STEP 4: RAPIDAPI (LAST RESORT) ---
        if (newCandidates.length === 0 && process.env.RAPIDAPI_KEY) {
            const host = process.env.RAPIDAPI_HOST || 'linkedin-data-scraper.p.rapidapi.com';
            console.log(`[API] Step 4: Trying RapidAPI (${host})...`);
            try {
                const response = await axios.get(`https://${host}/search`, {
                    params: { query: `student ${year}`, page: '1' },
                    headers: {
                        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                        'x-rapidapi-host': host
                    }
                });

                const data = response.data.data || response.data.results || [];
                if (Array.isArray(data) && data.length > 0) {
                    newCandidates = data.slice(0, 10).map(profile => ({
                        id: `rapid_${profile.id || Math.random()}`,
                        name: profile.full_name || profile.name || "Candidate",
                        year: parseInt(year),
                        email: profile.email || "Not Available",
                        phone: profile.phone || "Not Available",
                        linkedin: profile.linkedin_url || "Not Available",
                        status: `Real Lead (${host})`
                    }));
                    sourceUsed = `RapidAPI (${host})`;
                }
            } catch (err) {
                const errorMsg = err.response?.data?.message || err.message;
                console.error(`RapidAPI Error:`, errorMsg);
                if (errorMsg.includes('not subscribed')) {
                    console.log("[API] RapidAPI subscription issue detected.");
                }
            }
        }

        // Log to History (for all attempts)
        const history = readHistory();
        history.unshift({
            year,
            timestamp: new Date().toISOString(),
            count: newCandidates.length,
            source: sourceUsed || "None (All APIs Failed)"
        });
        writeHistory(history.slice(0, 50));

        if (newCandidates.length > 0) {
            const students = readData();
            const existingLinks = new Set(students.map(s => s.linkedin));
            const uniqueNew = newCandidates.filter(c => !existingLinks.has(c.linkedin));
            
            if (uniqueNew.length > 0) {
                const updatedStudents = [...students, ...uniqueNew];
                writeData(updatedStudents);
                return res.json({
                    message: `Successfully found ${uniqueNew.length} new candidates via ${sourceUsed}!`,
                    newCount: uniqueNew.length,
                    candidates: uniqueNew
                });
            } else {
                return res.json({
                    message: `Found profiles via ${sourceUsed}, but they are already in your database.`,
                    newCount: 0,
                    candidates: []
                });
            }
        }

        // --- NO RESULTS FALLBACK ---
        console.log(`[API] All APIs exhausted or no results found.`);
        return res.json({
            message: "No live results found for this year. Please check your API keys or try a different year.",
            newCount: 0,
            candidates: [],
            isDemo: false
        });

    } catch (error) {
        console.error('Global Fetch Error:', error.message);
        res.status(500).json({ error: "Search failed", message: error.message });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
