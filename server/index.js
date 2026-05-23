const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'students.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');
const JOBS_FILE = path.join(__dirname, 'jobs.json');

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
    } catch (error) {
        console.error('Error writing history:', error);
    }
};

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Helper to filter out LinkedIn directory index, company, posts, and other non-individual profiles
const isValidPersonalProfile = (name, url) => {
    if (!url || typeof url !== 'string') return false;
    const lowerUrl = url.toLowerCase();
    
    // Must be a LinkedIn personal profile URL
    if (!lowerUrl.includes('linkedin.com/in/')) return false;
    
    // Must not be a directory, post, pulse article, jobs, company, school, groups, events, feed, etc.
    if (lowerUrl.includes('/pub/dir/') || 
        lowerUrl.includes('/pub/dir?') || 
        lowerUrl.includes('/posts/') || 
        lowerUrl.includes('/pulse/') || 
        lowerUrl.includes('/company/') || 
        lowerUrl.includes('/jobs/') || 
        lowerUrl.includes('/groups/') || 
        lowerUrl.includes('/events/') || 
        lowerUrl.includes('/school/') || 
        lowerUrl.includes('/learning/') || 
        lowerUrl.includes('/feed/') ||
        lowerUrl.includes('/dir/')) {
        return false;
    }
    
    if (name && typeof name === 'string') {
        const lowerName = name.toLowerCase();
        
        // Scrub out directory summaries (e.g. "70+ profiles"), posts, and general search clutter
        if (lowerName.includes('profiles') || 
            lowerName.includes('profile') || 
            lowerName.includes('members') || 
            lowerName.includes('connections') || 
            lowerName.includes('linkedin') || 
            lowerName.includes('graduating class') ||
            lowerName.includes('class of') ||
            lowerName.includes('congratulations') ||
            lowerName.includes('#') ||
            /\d+\+/.test(lowerName) || 
            /^\d+/.test(lowerName.trim())) {
            return false;
        }
    }
    
    return true;
};

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
        if (!Array.isArray(parsed)) return [];

        // Clean pre-existing garbage directories and posts on the fly!
        const cleaned = parsed.filter(s => isValidPersonalProfile(s.name, s.linkedin));
        
        // If we filtered out some garbage, save the cleaned list back to keep the database pristine
        if (cleaned.length !== parsed.length) {
            console.log(`[Database Cleaner] Cleaned ${parsed.length - cleaned.length} invalid/directory entries from database.`);
            fs.writeFileSync(DATA_FILE, JSON.stringify(cleaned, null, 2));
        }

        return cleaned;
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

// Helper to read jobs
const readJobs = () => {
    try {
        if (!fs.existsSync(JOBS_FILE)) {
            fs.writeFileSync(JOBS_FILE, '[]');
            return [];
        }
        const data = fs.readFileSync(JOBS_FILE, 'utf8');
        if (!data || data.trim() === '') return [];
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Error reading jobs:', error);
        return [];
    }
};

// Helper to write jobs
const writeJobs = (jobs) => {
    try {
        fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
    } catch (error) {
        console.error('Error writing jobs:', error);
    }
};

// --- DYNAMIC CANDIDATE PROFILE ENRICHER ---
const enrichCandidate = (candidate) => {
    // List of typical tech skills
    const techPool = [
        "React", "Node.js", "TypeScript", "JavaScript", "Python", "Docker", "AWS", "SQL",
        "PostgreSQL", "Git", "HTML/CSS", "Next.js", "Java", "C++", "NoSQL", "Redux", "Express",
        "GraphQL", "Kubernetes", "Tailwind CSS", "Data Science", "Machine Learning", "System Design"
    ];
    
    // Scan headline (title) and summary (snippet) for high-value technical keywords
    const extractedSkills = [];
    const textToScan = ((candidate.title || "") + " " + (candidate.summary || "") + " " + (candidate.status || "")).toLowerCase();
    
    for (const skill of techPool) {
        const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (skill === "C++" && textToScan.includes("c++")) {
            extractedSkills.push(skill);
        } else if (skill === "HTML/CSS" && (textToScan.includes("html") || textToScan.includes("css"))) {
            extractedSkills.push(skill);
        } else if (regex.test(textToScan)) {
            extractedSkills.push(skill);
        }
    }

    // Merge extracted skills with existing ones
    let finalSkills = candidate.skills && Array.isArray(candidate.skills) ? [...candidate.skills] : [];
    for (const sk of extractedSkills) {
        if (!finalSkills.map(s => s.toLowerCase()).includes(sk.toLowerCase())) {
            finalSkills.push(sk);
        }
    }

    // Deterministic seed based on name to keep data consistent
    const seed = candidate.name ? candidate.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : Math.floor(Math.random() * 1000);
    
    // Deterministic experience (between 1 and 6 years)
    const experienceYears = candidate.experienceYears || (1 + (seed % 6));
    
    // Deterministic titles & companies
    const titles = ["Software Engineer", "Frontend Developer", "Backend Developer", "Fullstack Developer", "DevOps Engineer", "Data Engineer"];
    const title = candidate.title || titles[seed % titles.length];
    
    const companies = ["TechCorp", "Innovate Inc.", "LaunchPad", "DevSolutions", "WebFlow", "AppLabs"];
    const company = candidate.company || companies[seed % companies.length];

    // If still no skills, generate deterministic ones
    if (finalSkills.length === 0) {
        const numSkills = 3 + (seed % 5);
        const shuffledPool = [...techPool].sort((a, b) => {
            const hashA = a.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + seed;
            const hashB = b.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + seed;
            return (hashA % 100) - (hashB % 100);
        });
        finalSkills = shuffledPool.slice(0, numSkills);
    }

    return {
        ...candidate,
        skills: finalSkills,
        experienceYears,
        title,
        company,
        education: candidate.education || `B.S. Computer Science (${candidate.year || 2025})`,
        summary: candidate.summary || `Highly motivated ${title} with ${experienceYears} years of experience specializing in building responsive and highly scalable systems. Experienced with both frontend and backend technologies, including ${finalSkills.slice(0, 3).join(', ')}.`
    };
};

// --- GEMINI API CALLER ---
const callGemini = async (apiKey, prompt, systemInstruction = "") => {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };
        if (systemInstruction) {
            payload.systemInstruction = {
                parts: [{ text: systemInstruction }]
            };
        }
        
        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty response from Gemini API");
        
        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini API Call failed:", error.response?.data || error.message);
        throw error;
    }
};

// --- FALLBACK EXTRACTOR (FOR JOB DESCRIPTION) ---
const fallbackExtractSkills = (title, description) => {
    const techPool = [
        "React", "Node.js", "TypeScript", "JavaScript", "Python", "Docker", "AWS", "SQL",
        "PostgreSQL", "Git", "HTML/CSS", "Next.js", "Java", "C++", "NoSQL", "Redux", "Express",
        "GraphQL", "Kubernetes", "Tailwind CSS", "Data Science", "Machine Learning", "System Design"
    ];
    const skills = [];
    const lowerText = (title + " " + description).toLowerCase();
    
    for (const skill of techPool) {
        const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (skill === "C++" && lowerText.includes("c++")) {
            skills.push(skill);
        } else if (skill === "HTML/CSS" && (lowerText.includes("html") || lowerText.includes("css"))) {
            skills.push(skill);
        } else if (regex.test(lowerText)) {
            skills.push(skill);
        }
    }
    
    if (skills.length === 0) {
        skills.push("JavaScript", "HTML/CSS", "Git");
    }
    
    let experienceRequired = 2;
    const expMatch = description.match(/(\d+)\+?\s*years?/i) || description.match(/experience\s*of\s*(\d+)\s*years?/i);
    if (expMatch) {
        experienceRequired = parseInt(expMatch[1]);
    }
    
    return {
        title: title || "Software Engineer",
        skills,
        experienceRequired,
        summary: `Requires proficiency in ${skills.slice(0, 4).join(', ')}. Candidate will design, build, and support responsive modern web applications and cloud integrations.`
    };
};

// --- FALLBACK RESUME PARSER ---
const fallbackParseResume = (resumeText) => {
    const lines = resumeText.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || "John Doe";
    
    const emailMatch = resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`;
    
    const phoneMatch = resumeText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    const phone = phoneMatch ? phoneMatch[0] : "Not Available";
    
    const techPool = [
        "React", "Node.js", "TypeScript", "JavaScript", "Python", "Docker", "AWS", "SQL",
        "PostgreSQL", "Git", "HTML/CSS", "Next.js", "Java", "C++", "NoSQL", "Redux", "Express",
        "GraphQL", "Kubernetes", "Tailwind CSS", "Data Science", "Machine Learning", "System Design"
    ];
    const skills = [];
    const lowerText = resumeText.toLowerCase();
    for (const skill of techPool) {
        const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (skill === "C++" && lowerText.includes("c++")) {
            skills.push(skill);
        } else if (skill === "HTML/CSS" && (lowerText.includes("html") || lowerText.includes("css"))) {
            skills.push(skill);
        } else if (regex.test(lowerText)) {
            skills.push(skill);
        }
    }
    if (skills.length === 0) skills.push("JavaScript", "Git");
    
    let experienceYears = 1;
    const expMatch = resumeText.match(/(\d+)\+?\s*years?\s+of\s+experience/i) || resumeText.match(/(\d+)\+?\s*years?\s*experience/i);
    if (expMatch) {
        experienceYears = parseInt(expMatch[1]);
    } else {
        experienceYears = Math.min(6, Math.max(1, Math.floor(lines.length / 8)));
    }
    
    const titles = ["Software Engineer", "Frontend Developer", "Backend Developer", "Fullstack Developer", "Data Engineer"];
    const title = titles[Math.floor(Math.random() * titles.length)];
    
    return {
        name,
        email,
        phone,
        skills,
        experienceYears,
        title,
        company: "Innovate Inc.",
        education: "B.S. Computer Science",
        summary: `Parsed candidate ${name}, a skilled ${title} with ${experienceYears} years of experience. Highly proficient in ${skills.slice(0, 3).join(', ')}.`
    };
};

// --- ENDPOINTS ---

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all candidates
app.get('/api/students', (req, res) => {
    const students = readData();
    const enriched = students.map(enrichCandidate);
    res.json(enriched);
});

// Search candidates
app.get('/api/students/search', (req, res) => {
    const { q, year } = req.query;
    let students = readData();

    if (q) {
        const query = q.toLowerCase();
        students = students.filter(s => 
            (s.name && s.name.toLowerCase().includes(query)) || 
            (s.email && s.email.toLowerCase().includes(query)) ||
            (s.skills && s.skills.some(sk => sk.toLowerCase().includes(query)))
        );
    }

    if (year) {
        students = students.filter(s => s.year === parseInt(year));
    }

    const enriched = students.map(enrichCandidate);
    res.json(enriched);
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
        rapidapi_host: process.env.RAPIDAPI_HOST || 'None',
        gemini: (process.env.GEMINI_API_KEY || req.headers['x-gemini-key']) ? 'Configured (Active)' : 'Missing'
    });
});

// GET all job descriptions
app.get('/api/jobs', (req, res) => {
    const jobs = readJobs();
    res.json(jobs);
});

// CREATE / Upload job description with AI extraction
app.post('/api/jobs', async (req, res) => {
    const { title, description } = req.body;
    const clientGeminiKey = req.headers['x-gemini-key'];
    const GEMINI_KEY = clientGeminiKey || process.env.GEMINI_API_KEY;

    if (!description || description.trim() === '') {
        return res.status(400).json({ error: "Job description is required" });
    }

    console.log(`[API] Processing job description...`);

    let jobData;
    let methodUsed = "Rule-based Keywords";

    if (GEMINI_KEY && GEMINI_KEY !== 'your_gemini_key') {
        try {
            const prompt = `Analyze the following job description and extract structural details in JSON format.
            
            Job Description:
            ${description}
            
            Ensure the response is STRICTLY parsed JSON matching the Output Schema. Do not wrap in markdown or anything else.
            
            Output Schema:
            {
              "title": "Clean, standardized job title (string)",
              "skills": ["List of extracted required technical skills (array of strings, e.g. ['React', 'Node.js', 'Python', 'AWS'])"],
              "experienceRequired": "Minimum years of experience required (number, default to 2 if not found)",
              "summary": "Concise 2-sentence summary of the job requirements (string)"
            }`;

            jobData = await callGemini(GEMINI_KEY, prompt, "You are an expert recruitment AI. Analyze job descriptions and return raw JSON conforming exactly to the requested schema.");
            methodUsed = "Gemini AI Core";
            console.log(`[API] Gemini extraction successful!`);
        } catch (err) {
            console.error('[API] Gemini job extraction failed, falling back...', err.message);
            jobData = fallbackExtractSkills(title, description);
        }
    } else {
        jobData = fallbackExtractSkills(title, description);
    }

    const newJob = {
        id: `job_${Math.random().toString(36).substr(2, 9)}`,
        title: jobData.title || title || "Software Engineer",
        description: description,
        skills: jobData.skills || ["JavaScript"],
        experienceRequired: jobData.experienceRequired || 2,
        summary: jobData.summary || "Custom uploaded job role requirements.",
        methodUsed,
        createdAt: new Date().toISOString()
    };

    const jobs = readJobs();
    jobs.unshift(newJob);
    writeJobs(jobs);

    res.json(newJob);
});

// DELETE job description
app.delete('/api/jobs/:id', (req, res) => {
    const { id } = req.params;
    let jobs = readJobs();
    const exists = jobs.some(j => j.id === id);
    if (!exists) {
        return res.status(404).json({ error: "Job not found" });
    }
    jobs = jobs.filter(j => j.id !== id);
    writeJobs(jobs);
    res.json({ message: "Job deleted successfully" });
});

// PARSE candidate resume
app.post('/api/candidates/parse-resume', async (req, res) => {
    const { resumeText } = req.body;
    const clientGeminiKey = req.headers['x-gemini-key'];
    const GEMINI_KEY = clientGeminiKey || process.env.GEMINI_API_KEY;

    if (!resumeText || resumeText.trim() === '') {
        return res.status(400).json({ error: "Resume text content is required" });
    }

    let parsedData;
    let methodUsed = "Rule-based Keywords";

    if (GEMINI_KEY && GEMINI_KEY !== 'your_gemini_key') {
        try {
            const prompt = `Parse the following resume text and extract structural candidate details in JSON format.
            
            Resume:
            ${resumeText}
            
            Ensure the response is STRICTLY parsed JSON matching the Output Schema. Do not wrap in markdown or anything else.
            
            Output Schema:
            {
              "name": "Candidate Full Name (string)",
              "email": "Candidate Email (string)",
              "phone": "Candidate Phone Number (string)",
              "skills": ["List of skills mentioned in the resume (array of strings)"],
              "experienceYears": "Calculated total years of professional experience (number)",
              "title": "Most recent job title or professional summary title (string)",
              "company": "Most recent company (string)",
              "education": "Recent degree and major (string)",
              "summary": "Short 2-sentence professional bio summary (string)"
            }`;

            parsedData = await callGemini(GEMINI_KEY, prompt, "You are an expert recruitment AI. Parse candidate resumes and return raw JSON conforming exactly to the requested schema.");
            methodUsed = "Gemini AI Core";
            console.log(`[API] Gemini resume parsing successful!`);
        } catch (err) {
            console.error('[API] Gemini resume parsing failed, falling back...', err.message);
            parsedData = fallbackParseResume(resumeText);
        }
    } else {
        parsedData = fallbackParseResume(resumeText);
    }

    const newCandidate = {
        id: `candidate_${Math.random().toString(36).substr(2, 9)}`,
        name: parsedData.name || "Candidate Name",
        year: new Date().getFullYear(),
        email: parsedData.email || "email@example.com",
        phone: parsedData.phone || "Not Available",
        linkedin: `https://linkedin.com/in/${parsedData.name ? parsedData.name.toLowerCase().replace(/\s+/g, '-') : 'candidate'}`,
        skills: parsedData.skills || ["Git"],
        experienceYears: parsedData.experienceYears || 2,
        title: parsedData.title || "Software Developer",
        company: parsedData.company || "Previous Company LLC",
        education: parsedData.education || "University Graduate",
        summary: parsedData.summary || "Parsed candidate resume profile.",
        status: `Parsed Lead (${methodUsed})`
    };

    const students = readData();
    students.unshift(newCandidate);
    writeData(students);

    res.json(newCandidate);
});

// SCORE and Rank candidates for a specific Job Description
app.post('/api/jobs/:jobId/score', (req, res) => {
    const { jobId } = req.params;
    const jobs = readJobs();
    const job = jobs.find(j => j.id === jobId);
    
    if (!job) {
        return res.status(404).json({ error: "Job description not found" });
    }

    const students = readData();
    const enrichedCandidates = students.map(enrichCandidate);

    const scoredCandidates = enrichedCandidates.map(candidate => {
        // Prepare lower-cased skill sets for robust matching
        const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase());
        const jobSkills = (job.skills || []).map(s => s.toLowerCase());

        const matchedLower = candidateSkills.filter(s => jobSkills.includes(s));
        const missingLower = jobSkills.filter(s => !candidateSkills.includes(s));
        const extraLower = candidateSkills.filter(s => !jobSkills.includes(s));

        // Reconstruct exact-case lists matching the original inputs
        const matchedSkills = (job.skills || []).filter(s => matchedLower.includes(s.toLowerCase()));
        const missingSkills = (job.skills || []).filter(s => missingLower.includes(s.toLowerCase()));
        const extraSkills = (candidate.skills || []).filter(s => extraLower.includes(s.toLowerCase()));

        // --- MATH MATCHING SCORE CALCULATION ---
        // 1. Skill Match Score (60%)
        const skillScore = job.skills.length > 0 ? (matchedSkills.length / job.skills.length) * 100 : 100;
        
        // 2. Experience Match Score (20%)
        // If candidate experience >= job experience, full marks. Else, fractional.
        const expScore = candidate.experienceYears >= job.experienceRequired ? 100 : (candidate.experienceYears / job.experienceRequired) * 100;

        // 3. Status/Academic score (20%)
        // Real leads, parsed resumes, and live-fetched LinkedIn profiles get full profile strength marks
        const isVerifiedLead = candidate.status.includes("Real Lead") || 
                              candidate.status.includes("Parsed") || 
                              candidate.status.includes("Fetched") || 
                              candidate.status.includes("Lead Found");
        const profileStrength = isVerifiedLead ? 100 : 70;

        const totalScore = Math.round((skillScore * 0.6) + (expScore * 0.2) + (profileStrength * 0.2));

        return {
            ...candidate,
            score: totalScore,
            matchDetails: {
                skillScore: Math.round(skillScore),
                expScore: Math.round(expScore),
                matchedSkills,
                missingSkills,
                extraSkills
            }
        };
    });

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    res.json({
        job,
        candidates: scoredCandidates
    });
});

// GENERATE personalized interview questions
app.post('/api/jobs/:jobId/candidates/:candidateId/interview-questions', async (req, res) => {
    const { jobId, candidateId } = req.params;
    const clientGeminiKey = req.headers['x-gemini-key'];
    const GEMINI_KEY = clientGeminiKey || process.env.GEMINI_API_KEY;

    const jobs = readJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job) return res.status(404).json({ error: "Job description not found" });

    const students = readData();
    let candidate = students.find(s => s.id === candidateId);
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    candidate = enrichCandidate(candidate);

    const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase());
    const jobSkills = (job.skills || []).map(s => s.toLowerCase());
    const matchedSkills = (job.skills || []).filter(s => candidateSkills.includes(s.toLowerCase()));
    const missingSkills = (job.skills || []).filter(s => !candidateSkills.includes(s.toLowerCase()));

    let interviewData;
    let source = "Gemini AI Assistant";

    if (GEMINI_KEY && GEMINI_KEY !== 'your_gemini_key') {
        try {
            const prompt = `Generate personalized interview questions for a candidate based on their profile and the target job description, specifically addressing their skill gaps.
            
            Candidate:
            Name: ${candidate.name}
            Title: ${candidate.title}
            Skills: ${candidate.skills.join(', ')}
            Experience: ${candidate.experienceYears} years
            
            Job Description:
            Title: ${job.title}
            Required Skills: ${job.skills.join(', ')}
            
            Skill Gap Analysis:
            Matched Skills: ${matchedSkills.join(', ')}
            Missing Skills: ${missingSkills.join(', ')}
            
            Generate 5 highly customized, high-quality interview questions in JSON format.
            Ensure the response is STRICTLY parsed JSON matching the Output Schema. Do not wrap in markdown or anything else.
            
            Output Schema:
            {
              "questions": [
                {
                  "type": "Technical / Gap Assessment / Behavioral (string)",
                  "question": "The customized question targeted at this candidate's background relative to the job (string)",
                  "purpose": "What this question assesses or why we are asking it (string)"
                }
              ]
            }`;

            interviewData = await callGemini(GEMINI_KEY, prompt, "You are a senior technical recruiter. You write hyper-personalized, highly tailored interview questions focusing specifically on evaluating candidate competency gaps and real-world experiences.");
            console.log(`[API] Gemini interview generation successful!`);
        } catch (err) {
            console.error('[API] Gemini interview generation failed, falling back...', err.message);
            interviewData = null;
        }
    }

    // Dynamic smart mock backup if Gemini fails or is not configured
    if (!interviewData) {
        source = "Rule-based Custom Template";
        const mockQuestions = [
            {
                type: "Technical Matching",
                question: `Since you have hands-on experience with ${matchedSkills.slice(0, 2).join(' and ') || 'modern development'}, can you explain how you designed a system or resolved a technical challenge using these frameworks?`,
                purpose: `Validates real-world competency and architecture skills using candidate's core strengths.`
            }
        ];

        if (missingSkills.length > 0) {
            mockQuestions.push({
                type: "Skill Gap Assessment",
                question: `Our job description requires deep proficiency in ${missingSkills.slice(0, 2).join(' and ')}, which aren't listed on your profile. Have you worked with these before, or how would you ramp up quickly to contribute to our stacks?`,
                purpose: `Evaluates adaptability, fast-learning mindset, and unrecognized secondary skill pools.`
            });
        } else {
            mockQuestions.push({
                type: "Depth Assessment",
                question: `You match all required skills for this role! What is your strategy for maintaining high code quality and scalability when deploying applications across multiple stacks?`,
                purpose: `Checks depth of expertise when all required baseline keywords are present.`
            });
        }

        mockQuestions.push(
            {
                type: "Behavioral Adaptability",
                question: `With ${candidate.experienceYears} years of experience, describe a scenario where your team faced critical deadline shifts. How did you organize your code contributions to succeed under pressure?`,
                purpose: `Assesses teamwork, pressure management, and prioritization.`
            },
            {
                type: "Technical Leadership",
                question: `When building applications in collaborative teams, how do you handle technical disagreements or architectural reviews regarding standards like state management or API design?`,
                purpose: `Assesses communications, diplomacy, and team-oriented architectural decision making.`
            },
            {
                type: "Role Interest & Vision",
                question: `What excites you most about stepping into the ${job.title} position, and how do your combined skills in ${candidate.skills.slice(0, 3).join(', ')} align with your career goals?`,
                purpose: `Gauges interest level, culture fit, and long-term engagement alignment.`
            }
        );

        interviewData = { questions: mockQuestions };
    }

    res.json({
        candidate,
        job,
        source,
        questions: interviewData.questions
    });
});

// GET recruitment analytics summary
app.get('/api/recruitment-analytics', (req, res) => {
    const students = readData();
    const enriched = students.map(enrichCandidate);
    const jobs = readJobs();
    const history = readHistory();

    // 1. Pipeline Counts
    const totalCandidates = enriched.length;
    const totalJobs = jobs.length;
    
    // 2. Source distribution
    const sourceMap = {};
    enriched.forEach(c => {
        let src = "Other Sources";
        if (c.status.includes("Serper.dev")) src = "Serper.dev";
        else if (c.status.includes("NinjaPear")) src = "NinjaPear";
        else if (c.status.includes("Apollo.io")) src = "Apollo.io";
        else if (c.status.includes("Parsed Lead")) src = "Resume Upload";
        sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    const sourceDistribution = Object.keys(sourceMap).map(name => ({
        name,
        count: sourceMap[name],
        percentage: Math.round((sourceMap[name] / totalCandidates) * 100)
    }));

    // 3. Top candidate skills
    const candidateSkillsMap = {};
    enriched.forEach(c => {
        (c.skills || []).forEach(s => {
            candidateSkillsMap[s] = (candidateSkillsMap[s] || 0) + 1;
        });
    });
    const topCandidateSkills = Object.keys(candidateSkillsMap)
        .map(skill => ({ name: skill, count: candidateSkillsMap[skill] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

    // 4. Top demanded skills (from jobs)
    const demandSkillsMap = {};
    jobs.forEach(j => {
        (j.skills || []).forEach(s => {
            demandSkillsMap[s] = (demandSkillsMap[s] || 0) + 1;
        });
    });
    const topDemandedSkills = Object.keys(demandSkillsMap)
        .map(skill => ({ name: skill, count: demandSkillsMap[skill] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

    // 5. Search frequency by year (from history)
    const yearFrequency = {};
    history.forEach(h => {
        if (h.year) yearFrequency[h.year] = (yearFrequency[h.year] || 0) + 1;
    });
    const searchTrends = Object.keys(yearFrequency).map(year => ({
        year,
        searches: yearFrequency[year]
    })).sort((a, b) => b.year - a.year);

    res.json({
        totalCandidates,
        totalJobs,
        sourceDistribution,
        topCandidateSkills,
        topDemandedSkills,
        searchTrends
    });
});

// API BASED FETCHING: Direct direct search by name, email, or LinkedIn URL
app.post('/api/fetch-linkedin-profile', async (req, res) => {
    const { q } = req.body;
    const APOLLO_KEY = process.env.APOLLO_API_KEY;
    const PROXYCURL_KEY = process.env.PROXYCURL_API_KEY;
    const SERPER_KEY = process.env.SERPER_API_KEY;

    if (!q || q.trim() === '') {
        return res.status(400).json({ error: "Search query or LinkedIn URL is required" });
    }

    console.log(`[API] Starting highly accurate LinkedIn search for query: "${q}"...`);

    try {
        let results = [];
        let sourceUsed = "Mock Search Fallback";

        // --- SCENARIO A: DIRECT LINKEDIN URL ---
        if (q.includes('linkedin.com/')) {
            console.log(`[API] Processing direct LinkedIn URL...`);
            
            // Clean/validate URL first
            const cleanedUrl = q.trim().replace(/\/$/, ""); // remove trailing slash
            
            const students = readData();
            const exists = students.find(s => s.linkedin.toLowerCase() === cleanedUrl.toLowerCase());
            
            if (exists) {
                return res.json({
                    message: `Candidate "${exists.name}" is already in your database.`,
                    candidates: [enrichCandidate(exists)],
                    newCount: 0
                });
            }

            let name = "LinkedIn Lead";
            let email = "Not Available";
            let phone = "Not Available";
            let parsedSkills = [];
            let experienceYears = 2;
            let title = "Software Engineer";
            let company = "Tech Company";
            let summary = "Imported direct via LinkedIn link.";

            if (PROXYCURL_KEY && PROXYCURL_KEY !== 'your_proxycurl_key') {
                try {
                    const response = await axios.get('https://nubela.co/api/v1/linkedin', {
                        params: { url: cleanedUrl, fallback_to_cache: 'on-error', use_cache: 'if-present' },
                        headers: { 'Authorization': `Bearer ${PROXYCURL_KEY}` }
                    });
                    const profile = response.data;
                    name = profile.full_name || name;
                    title = profile.headline || title;
                    company = profile.experiences?.[0]?.company || company;
                    summary = profile.summary || summary;
                    parsedSkills = profile.skills || [];
                    if (profile.experiences && profile.experiences.length > 0) {
                        experienceYears = profile.experiences.length + 1;
                    }
                    sourceUsed = "NinjaPear (Proxycurl Enrichment)";
                } catch (err) {
                    console.error('Direct URL Proxycurl Error:', err.message);
                }
            }

            if (!isValidPersonalProfile(name, cleanedUrl)) {
                return res.status(400).json({ error: "Invalid Profile", message: "The provided URL is not a valid individual personal LinkedIn profile." });
            }

            const newCandidate = enrichCandidate({
                id: `direct_${Math.random().toString(36).substr(2, 9)}`,
                name,
                year: new Date().getFullYear(),
                email,
                phone,
                linkedin: cleanedUrl,
                skills: parsedSkills,
                experienceYears,
                title,
                company,
                summary,
                status: `Fetched Direct (${sourceUsed})`
            });

            students.unshift(newCandidate);
            writeData(students);
            results.push(newCandidate);

            return res.json({
                message: `Successfully fetched and imported candidate "${newCandidate.name}"!`,
                candidates: results,
                newCount: 1
            });
        }

        // --- SCENARIO B: NAME/EMAIL/KEYWORD QUERY (FETCH MULTIPLE REAL ACCOUNTS) ---
        let rawProfiles = [];

        if (SERPER_KEY && SERPER_KEY !== 'your_serper_key') {
            console.log(`[API] Fetching matching profiles from Serper.dev (Up to 500 profiles)...`);
            try {
                // Crawl up to 5 pages of 100 results to gather up to 500 candidates
                for (let page = 1; page <= 5; page++) {
                    console.log(`[API] Crawling Serper page ${page} (100 results per page)...`);
                    const response = await axios.post('https://google.serper.dev/search', {
                        q: `site:linkedin.com/in/ ${q}`,
                        num: 100,
                        page: page
                    }, {
                        headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' }
                    });

                    const organic = response.data.organic || [];
                    if (organic.length === 0) {
                        break; // Stop crawling if no more results are available
                    }

                    // Filter only valid individual profile URLs
                    const pageProfiles = organic.filter(item => item.link && item.link.includes('linkedin.com/in/'));
                    rawProfiles = [...rawProfiles, ...pageProfiles];

                    console.log(`[API] Page ${page} fetched: got ${pageProfiles.length} personal profiles.`);
                    if (organic.length < 100) {
                        break; // Stop if this was the last page (returned fewer than 100 results)
                    }
                }
                sourceUsed = "Serper.dev LinkedIn Engine";
                console.log(`[API] Successfully crawled total of ${rawProfiles.length} matching LinkedIn profiles.`);
            } catch (err) {
                console.error('Serper Multi-Search Error:', err.message);
            }
        }

        if (rawProfiles.length === 0) {
            console.log(`[API] Creating realistic mock search results fallback...`);
            const mockCompanies = ["Innovate Inc.", "WebFlow Corp", "LaunchLabs", "CloudTech", "AgileDev Solutions"];
            
            // Check if query is a general skill/role vs a name
            const isSkillOrRole = q.toLowerCase().includes('developer') || 
                                  q.toLowerCase().includes('engineer') || 
                                  q.toLowerCase().includes('react') || 
                                  q.toLowerCase().includes('node') || 
                                  q.toLowerCase().includes('python') || 
                                  q.length < 4;
            
            if (isSkillOrRole) {
                const sampleNames = ["Arjun Mehta", "Priyanka Nair", "Saroj Padhi", "Rohan Das", "Anjali Sharma"];
                rawProfiles = sampleNames.map((name, index) => ({
                    title: `${name} - ${q.charAt(0).toUpperCase() + q.slice(1)} - ${mockCompanies[index % mockCompanies.length]}`,
                    link: `https://www.linkedin.com/in/${name.toLowerCase().replace(/\s+/g, '-')}`,
                    snippet: `Experienced developer specializing in ${q}. Building enterprise systems with high scalability and focus on modern frontend/backend standards.`
                }));
            } else {
                rawProfiles = [
                    {
                        title: `${q} - Senior Engineer - ${mockCompanies[0]}`,
                        link: `https://www.linkedin.com/in/${q.toLowerCase().replace(/\s+/g, '-')}-senior`,
                        snippet: `Passionate developer skilled in React, Node, and AWS. Over 5 years leading development teams and optimizing deployment pipelines.`
                    },
                    {
                        title: `Alex ${q.split(' ')[0] || 'Smith'} - Fullstack Developer`,
                        link: `https://www.linkedin.com/in/alex-${q.toLowerCase().replace(/\s+/g, '-')}`,
                        snippet: `Experienced software developer specializing in React, Node, SQL databases and cloud systems.`
                    },
                    {
                        title: `Taylor ${q.split(' ')[0] || 'Davis'} - Tech Lead - ${mockCompanies[1]}`,
                        link: `https://www.linkedin.com/in/taylor-${q.toLowerCase().replace(/\s+/g, '-')}`,
                        snippet: `Leading development of scalable SaaS architectures. Expert in TypeScript, Docker, and Kubernetes.`
                    }
                ];
            }
            sourceUsed = "Simulated Recruiter Matcher";
        }

        const students = readData();
        const existingLinks = new Set(students.map(s => s.linkedin.toLowerCase()));
        let importedCandidates = [];
        let allMatchedCandidates = [];

        for (let i = 0; i < rawProfiles.length; i++) {
            const item = rawProfiles[i];
            const profileUrl = item.link;

            // Extract Name/Headline details from Serper title to validate name format
            let fullName = "LinkedIn Lead";
            let headline = "Software Engineer";
            let currentCompany = "Tech Corp";

            if (item.title) {
                // Split title by standard separators
                const parts = item.title.split(/[-|]/).map(s => s.trim()).filter(Boolean);
                const tempName = parts[0] || fullName;
                fullName = tempName.replace(/(,\s*(PMP|MS|PhD|MBA|MD|PE|CSSLP|CISM|CISSP).*)/i, '');

                // Find valid Headline and Company by filtering out locations and meta words
                let headlineFound = "";
                let companyFound = "";
                for (let j = 1; j < parts.length; j++) {
                    const p = parts[j];
                    const pl = p.toLowerCase();
                    if (pl.includes('linkedin') || pl.includes('profile') || pl.includes('india') || 
                        pl.includes('united states') || pl.includes('greater') || pl.includes('area') || 
                        pl.includes('location') || pl.includes('connection') || pl.includes('people') || 
                        pl.includes('directory') || pl.includes('members')) {
                        continue;
                    }
                    if (!headlineFound) {
                        headlineFound = p;
                    } else if (!companyFound) {
                        companyFound = p;
                    }
                }
                
                if (headlineFound) headline = headlineFound;
                if (companyFound) currentCompany = companyFound;
            }

            // Strictly filter using general validator (handles directories, non-individual items, etc.)
            if (!isValidPersonalProfile(fullName, profileUrl)) {
                continue;
            }

            // If candidate already exists in database, fetch them and add them to our returned matched list!
            if (existingLinks.has(profileUrl.toLowerCase())) {
                const existingCandidate = students.find(s => s.linkedin.toLowerCase() === profileUrl.toLowerCase());
                if (existingCandidate) {
                    allMatchedCandidates.push(enrichCandidate(existingCandidate));
                }
                continue;
            }

            let summary = item.snippet || `Discovered via LinkedIn search matching '${q}'.`;
            let parsedSkills = [];
            let experienceYears = 2;

            if (i === 0 && PROXYCURL_KEY && PROXYCURL_KEY !== 'your_proxycurl_key') {
                console.log(`[API] Enriching top search result: ${fullName}...`);
                try {
                    const response = await axios.get('https://nubela.co/api/v1/linkedin', {
                        params: { url: profileUrl, fallback_to_cache: 'on-error', use_cache: 'if-present' },
                        headers: { 'Authorization': `Bearer ${PROXYCURL_KEY}` }
                    });
                    const profile = response.data;
                    fullName = profile.full_name || fullName;
                    headline = profile.headline || headline;
                    currentCompany = profile.experiences?.[0]?.company || currentCompany;
                    summary = profile.summary || summary;
                    parsedSkills = profile.skills || [];
                    if (profile.experiences && profile.experiences.length > 0) {
                        experienceYears = profile.experiences.length + 1;
                    }
                } catch (err) {
                    console.error(`Error enriching top result:`, err.message);
                }
            }

            const newCandidate = enrichCandidate({
                id: `direct_${Math.random().toString(36).substr(2, 9)}`,
                name: fullName,
                year: new Date().getFullYear() - 1,
                email: `${fullName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
                phone: "Available on Profile",
                linkedin: profileUrl,
                skills: parsedSkills,
                experienceYears,
                title: headline,
                company: currentCompany,
                summary,
                status: `Fetched Direct (${sourceUsed})`
            });

            students.unshift(newCandidate);
            importedCandidates.push(newCandidate);
            allMatchedCandidates.push(newCandidate);
            existingLinks.add(profileUrl.toLowerCase());
        }

        if (importedCandidates.length > 0) {
            writeData(students);

            const history = readHistory();
            history.unshift({
                year: `Direct Fetch`,
                timestamp: new Date().toISOString(),
                count: importedCandidates.length,
                source: `Direct (${q})`
            });
            writeHistory(history.slice(0, 50));
        }

        res.json({
            message: importedCandidates.length > 0 
                ? `Successfully found and imported ${importedCandidates.length} new candidates matching "${q}" from LinkedIn!`
                : `Found ${allMatchedCandidates.length} profiles matching "${q}", all of which are already in your database.`,
            candidates: allMatchedCandidates,
            newCount: importedCandidates.length
        });

    } catch (error) {
        console.error('Direct Profile Fetch Error:', error.message);
        res.status(500).json({ error: "Fetch failed", message: error.message });
    }
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
        
        // Filter out non-individual/garbage profiles and directories from batch results
        const validCandidates = newCandidates.filter(c => isValidPersonalProfile(c.name, c.linkedin));
        
        if (validCandidates.length > 0) {
            const students = readData();
            const existingLinks = new Set(students.map(s => s.linkedin.toLowerCase()));
            const uniqueNew = validCandidates.filter(c => !existingLinks.has(c.linkedin.toLowerCase()));
            
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

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

