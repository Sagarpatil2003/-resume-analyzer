require("dotenv").config();
const express = require("express");
const multer = require("multer");
const pdf = require('html-pdf-node');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const router = express.Router();

// Multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
});

// Initialize Gemini (AI Studio key)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post("/analyze", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Extract text from PDF
    const pdfData = await pdfParse(req.file.buffer);
    const resumeText = pdfData.text;

    if (!resumeText || resumeText.trim().length === 0) {
      return res.status(400).json({ error: "Could not extract text from PDF" });
    }

    // Get Gemini model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    // Generate response
    const result = await model.generateContent(
      `
      You are an expert ATS (Applicant Tracking System) Analyzer. 
      Analyze the following resume text and provide a JSON response.
      
      Resume Text: ${resumeText}

      The JSON must follow this exact structure:
      {
        "score": number (0-100),
        "summary": "Short 2 sentence professional overview",
        "strengths": ["list", "of", "3-4", "strengths"],
        "improvements": ["list", "of", "3-4", "specific", "fixes"],
        "skillsDetected": ["list", "of", "top", "5", "skills"]
      }
      `
    );

    const outputText = result.response.text();
    const analysisData = JSON.parse(outputText);
    res.status(200).json(analysisData);

  } catch (error) {
    console.error("Analysis Error:", error.message || error);
    res.status(500).json({ error: "Failed to analyze resume" });
  }
});

router.post('/generate-resume-html', async (req, res) => {
  const { skills, projects, education, experience, contact } = req.body;

  const prompt = `
    Act as a Senior Technical Recruiter at a Fortune 500 company. 
    Your goal is to generate a high-conversion, ATS-optimized resume in HTML/CSS.

    --- DATA INPUT ---
    Name: ${contact.name}
    Contact: Email: ${contact.email}, Phone: ${contact.phone}, LinkedIn: ${contact.linkedin}
    Skills: ${skills.join(', ')}
    Experience: ${JSON.stringify(experience)}
    Projects: ${JSON.stringify(projects)}
    Education: ${JSON.stringify(education)}

    --- CRITICAL ARCHITECTURAL REQUIREMENTS ---
    1. Layout: Single-column only (multi-column layouts fail ATS parsing).
    2. Fonts: Use standard web-safe sans-serif fonts (Arial, Helvetica, sans-serif).
    3. Google XYZ Formula: Rewrite the "Experience" and "Projects" descriptions into strong bullet points using the formula: "Accomplished [X] as measured by [Y], by doing [Z]".
    4. Education: Format education with the Degree and Institution clearly separated, including the graduation year.
    5. HTML Semantics: Use <header>, <section>, <article>, and <ul> tags.
    6. CSS: Include a <style> block. Use a professional color palette (Deep Slate #1e293b, Accent Blue #2563eb).

    Output ONLY the raw HTML/CSS code. No conversational text.
  `;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Use stable flash for rapid HTML generation

    const result = await model.generateContent(prompt);
    let resumeHtml = result.response.text();

    // Clean markdown artifacts
    resumeHtml = resumeHtml.replace(/^```html|```$/g, "").trim();

    res.json({ html: resumeHtml });
  } catch (error) {
    console.error('Gemini Resume Engine Error:', error);
    res.status(500).json({ error: 'System failure during resume synthesis.' });
  }
});

router.post(
  "/generate-interview-prep",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No resume uploaded" });
      }

      // Extract text from PDF
      const pdfData = await pdfParse(req.file.buffer);
      const resumeText = pdfData.text;

      if (!resumeText || resumeText.trim().length === 0) {
        return res.status(400).json({ error: "Could not extract text" });
      }

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
      });

      const prompt = `
        You are a Senior Technical Interviewer at a top tech company.

        Analyze the following resume and create a personalized interview preparation guide.

        Resume:
        ${resumeText}

        Return ONLY valid JSON in this format:

        {
          "detected_skills": ["top 5 skills from resume"],
          "technical_questions": ["5 advanced technical questions"],
          "project_deep_dive": ["3 architectural what-if questions"],
          "behavioral_scenarios": ["3 STAR behavioral questions"],
          "skill_gaps": ["missing or weak areas candidate should improve"]
        }
      `;

      const result = await model.generateContent(prompt);
      const output = result.response.text();

      const cleanJson = output.replace(/```json|```/g, "").trim();

      res.status(200).json(JSON.parse(cleanJson));

    } catch (error) {
      
      console.error("Interview Prep Error:", error);
      res.status(500).json({ error: "Failed to generate interview prep" });
    }
  }
);

router.post('/convert-to-pdf', (req, res) => {
  const { htmlContent } = req.body;

  const options = {
    format: 'A4',
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
  };

  const file = { content: htmlContent };

  // generatePdf returns a Promise that resolves to a Buffer
  html_to_pdf.generatePdf(file, options).then(pdfBuffer => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=resume.pdf');
    res.send(pdfBuffer);
  }).catch(err => {
    console.error('PDF Error:', err);
    res.status(500).json({ error: 'Failed to convert HTML to PDF.' });
  });
});

module.exports = router; 