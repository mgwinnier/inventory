require("dotenv").config(); // Load .env file if running locally

const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const cheerio = require("cheerio");

// Debugging: Check if the token is loaded
console.log("🔍 DEBUG: Loaded DISCORD_TOKEN =", process.env.DISCORD_TOKEN ? "✅ Present" : "❌ MISSING");
console.log("🔍 DEBUG: Loaded CHANNEL_ID =", process.env.CHANNEL_ID ? "✅ Present" : "❌ MISSING");

// Load token from environment
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!DISCORD_TOKEN) {
    console.error("❌ ERROR: DISCORD_TOKEN is missing! Check your GitHub Secrets.");
    process.exit(1); // Stop execution if the token is missing
}

if (!CHANNEL_ID) {
    console.error("❌ ERROR: CHANNEL_ID is missing! Check your GitHub Secrets.");
    process.exit(1);
}

// Discord Bot Setup
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once("ready", async () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    client.destroy(); // Close the bot after running once
});

client.login(DISCORD_TOKEN).catch((err) => {
    console.error("❌ Discord login failed:", err);
});
