require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Cache file and one-week constant
const CACHE_FILE = path.join(__dirname, 'timingsCache.json');
const oneWeek = 7 * 24 * 60 * 60 * 1000;

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

function loadCachedTimings() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const rawData = fs.readFileSync(CACHE_FILE, 'utf-8');
      const cache = JSON.parse(rawData);
      return cache;
    }
  } catch (err) {
    console.error("Error loading cache:", err);
  }
  return null;
}

function saveCachedTimings(timings) {
  const cache = {
    lastUpdate: Date.now(),
    timings: timings,
  };
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error("Error saving cache:", err);
  }
}

async function fetchTimingsFromAPI() {
  const chatSession = model.startChat({ generationConfig, history: [] });
  const prompt = "Provide ONLY a valid JSON object representing the Namaz timings for Fajr, Zohar, Asar, Maghrib, and Isha in HH:MM 24-hour format in India. Example: {\"Fajr\":\"05:50\", \"Zohar\":\"12:30\", \"Asar\":\"15:45\", \"Maghrib\":\"18:20\", \"Isha\":\"20:00\"}.";
  const result = await chatSession.sendMessage(prompt);
  const rawText = result.response.text().trim();
  console.log("Raw response from Gemini:", rawText);
  
  let timings;
  try {
    timings = JSON.parse(rawText);
  } catch (jsonErr) {
    console.error("Initial JSON parse failed:", jsonErr);
    // Attempt to extract JSON substring if there is extra text.
    const jsonStart = rawText.indexOf('{');
    const jsonEnd = rawText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonString = rawText.substring(jsonStart, jsonEnd + 1);
      try {
        timings = JSON.parse(jsonString);
      } catch (extractionErr) {
        console.error("Failed to parse extracted JSON:", extractionErr);
        throw new Error("Invalid JSON response from Gemini API");
      }
    } else {
      throw new Error("Invalid response format from Gemini API");
    }
  }
  return timings;
}

// API endpoint to get prayer timings
app.get('/api/namaz_timings', async (req, res) => {
  try {
    let cache = loadCachedTimings();
    const now = Date.now();

    // Use cached timings if present and not older than one week
    if (cache && (now - cache.lastUpdate) < oneWeek) {
      return res.json(cache.timings);
    }

    // Otherwise, fetch new timings from Gemini API
    const timings = await fetchTimingsFromAPI();
    // Save to cache file
    saveCachedTimings(timings);
    res.json(timings);
  } catch (error) {
    console.error("Error fetching prayer timings:", error);
    res.status(500).json({ error: "Failed to fetch prayer timings" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
