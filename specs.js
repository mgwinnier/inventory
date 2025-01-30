
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const cheerio = require("cheerio");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "your-default-token";
const CHANNEL_ID = process.env.CHANNEL_ID || "your-default-channel-id";


// SKU List
const skuList = [
    { name: "Stagg Jr.", sku: "008800401858" },
    { name: "Weller 12 YR", sku: "008800402773" },
    { name: "EHT SiB", sku: "008800400551" },
    { name: "M10 Rye", sku: "003938300228" },
    { name: "Birthday Bourbon", sku: "008112800289" },
    { name: "Blantons Gold", sku: "008024400939" }
];

const zipCode = "75204";  // Change ZIP if needed
const radius = "100";  // Adjust search radius
const fulfillment_nonce = "7bf1b33b1e";  // Replace with correct nonce
const inventoryFile = "inventory.json";  // File to track previous inventory

// Load previous inventory from file (or create a blank object if file doesn't exist)
let previousInventory = {};
if (fs.existsSync(inventoryFile)) {
    previousInventory = JSON.parse(fs.readFileSync(inventoryFile, "utf8"));
} else {
    previousInventory = {};
}

// Discord Bot Setup
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Function to send messages to Discord
async function sendMessage(message) {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        await channel.send(message);
        console.log("✅ Sent to Discord:", message);
    } catch (error) {
        console.error("❌ Error sending message:", error);
    }
}

// Function to check inventory for a given SKU
async function checkInventory(skuObj) {
    try {
        console.log(`🔍 Checking inventory for **${skuObj.name}** (SKU: ${skuObj.sku})...`);

        const response = await fetch("https://specsonline.com/wp-admin/admin-ajax.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest"
            },
            body: new URLSearchParams({
                action: "prod_avail_check",
                zip: zipCode,
                sku: skuObj.sku,
                zero_inventory_check: "true",
                radius: radius,
                fulfillment_nonce: fulfillment_nonce
            })
        });

        const data = await response.json();
        if (!data || !data.data || typeof data.data !== "string") return { skuObj, changes: [] };

        const $ = cheerio.load(data.data);
        let stores = $(".single-store");

        let storeData = {};
        let changes = [];

        stores.each((_, store) => {
            let storeName = $(store).find(".store-name").text().trim() || "Unknown";
            let qtyMatch = $(store).html().match(/Qty in Stock: (\d+)/);
            let qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 0;

            // Track inventory for this SKU
            storeData[storeName] = qty;

            // Compare with previous inventory
            let prevQty = previousInventory[skuObj.sku]?.[storeName] ?? "Not tracked";
            if (prevQty !== "Not tracked" && prevQty !== qty) {
                changes.push(`🔔 **${skuObj.name}** at **${storeName}** changed: ${prevQty} → ${qty}`);
            }
        });

        // Update inventory
        previousInventory[skuObj.sku] = storeData;

        return { skuObj, changes };
    } catch (error) {
        console.error(`❌ Error fetching inventory for ${skuObj.name}:`, error);
        return { skuObj, changes: ["❌ Error checking this SKU."] };
    }
}

// Main function to check all SKUs
async function trackInventory() {
    let allChanges = [];

    for (let skuObj of skuList) {
        let result = await checkInventory(skuObj);
        allChanges.push(result);
    }

    // Save updated inventory to file
    fs.writeFileSync(inventoryFile, JSON.stringify(previousInventory, null, 2));

    // Format Discord message
    let message = "**📋 Inventory Update:**\n";
    let changesExist = false;

    allChanges.forEach(({ skuObj, changes }) => {
        if (changes.length > 0) {
            changesExist = true;
            message += `\n📢 **${skuObj.name}** (${skuObj.sku}):\n`;
            changes.forEach(change => message += `• ${change}\n`);
        }
    });

    if (!changesExist) {
        message += "\n✅ No inventory changes detected.";
        skuList.forEach(({ name, sku }) => message += `\n- ${name} (${sku})`);
    }

    await sendMessage(message);
}

// Run the bot when it's ready
client.once("ready", async () => {
    console.log("🤖 Bot is online and tracking inventory...");
    await trackInventory();
    client.destroy(); // Close connection after checking inventory
});

// Start bot
client.login(DISCORD_TOKEN);