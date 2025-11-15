/**
 * SECURE PROXY TEMPLATE: Node.js / Express Serverless Function
 *
 * PURPOSE: To securely handle the Gemini API Key by calling the API from the server-side,
 * and forwarding the result back to the client.
 *
 * DEPLOYMENT NOTES (For Netlify/Vercel):
 * 1. Deploy this code within the /netlify/functions/ folder.
 * 2. Set your Gemini API Key as an environment variable named: GEMINI_API_KEY
 */

import express from 'express';
import { GoogleGenAI } from '@google/genai';

// Initialize the Express app
const app = express();
app.use(express.json());

// Set up CORS (Cross-Origin Resource Sharing) for security
app.use((req, res, next) => {
    // Replace '*' with your actual deployed client domain for production
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// --- CRITICAL STEP: Initialize GoogleGenAI with the Environment Variable ---
// The Gemini API key MUST be set as an environment variable in your serverless host.
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("GEMINI_API_KEY environment variable is not set!");
}

const ai = new GoogleGenAI({ apiKey });


// --- Main Proxy Endpoint ---
app.post('/api/generate-response', async (req, res) => {
    if (!apiKey) {
        return res.status(500).json({ error: "Server error: Gemini API Key not configured." });
    }
    
    // 1. Extract data from the client request body
    const { userQuery, systemPrompt, scenario, history } = req.body;

    if (!userQuery || !systemPrompt || !history) {
        return res.status(400).json({ error: "Missing required fields in request body." });
    }

    // 2. Format history for the Gemini API structure
    const contents = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));
    
    // Add the current user query if it's not already the last item (shouldn't be, but as a safeguard)
    if (contents.length === 0 || contents[contents.length - 1].parts[0].text !== userQuery) {
         contents.push({ role: 'user', parts: [{ text: userQuery }] });
    }


    try {
        // 3. Call the Gemini API securely
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-09-2025",
            contents: contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            config: {
                // Ensure a reasonable temperature for conversational output
                temperature: 0.8, 
            }
        });

        const aiResponseText = response.text;
        
        if (!aiResponseText) {
             return res.status(500).json({ error: "AI returned an empty response." });
        }

        // 4. Return the AI's generated text to the client
        res.status(200).json({ text: aiResponseText });

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        res.status(500).json({ error: "Failed to generate AI response. Check server logs." });
    }
});

// For local testing (optional)
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`Proxy listening on port ${PORT}`));

// Export the Express app for serverless environments (e.g., Vercel, Netlify Functions)
export default app;

