const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const cheerio = require("cheerio");

// SKU List
const skuList = [
    { name: "Stagg Jr.", sku: "008800401858" },
    { name: "Weller 12 YR", sku: "008800402773" },
    { name: "EHT SiB", sku: "008800400551" },
    { name: "M10 Rye", sku: "003938300228" },
    { name: "Birthday Bourbon", sku: "008112800289" },
    { name: "Blantons", sku: "008024400203" },
    { name: "Blantons Gold", sku: "008024400939" },
    { name: "RR15", sku: "072105900371" },
    { name: "M20", sku: "003938300899" },
    { name: "GTS", sku: "008800402784" },
    { name: "Weller SiB", sku: "008800403964" },
    { name: "Weller 107", sku: "008800402564" },
    { name: "EHT Rye", sku: "008800400550" },
    { name: "EHT SmB", sku: "008800400549" },
    { name: "Penelope Havana", sku: "008835214184" },
    { name: "Michter's Toasted", sku: "003938300228" },
    { name: "Weller Full Proof", sku: "008800403149" },
    { name: "EHT Barrel Proof", sku: "008800400552" },
];

const zipCode = "75204";
const radius = "100";
const inventoryFile = "inventory.json";

// Load previous inventory from file
let previousInventory = {};
if (fs.existsSync(inventoryFile)) {
    previousInventory = JSON.parse(fs.readFileSync(inventoryFile, "utf8"));
}

// Initialize Discord Bot with GitHub Secrets for token and channel
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const CHANNEL_ID = process.env.CHANNEL_ID;
const NO_CHANGE_CHANNEL_ID = "1334889254328733766"; // New channel for no-change updates
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

// ✅ Function to fetch the latest public fulfillment_nonce
async function fetchNonce() {
    try {
        const response = await fetch("https://specsonline.com");
        const body = await response.text();
        const $ = cheerio.load(body);

        // Extract the nonce from JavaScript
        const scriptContent = $('script:contains("fulfillmentJS")').html();
        const nonceMatch = scriptContent?.match(/"nonce":"(.*?)"/);
        const nonce = nonceMatch ? nonceMatch[1] : null;

        if (!nonce) throw new Error("⚠️ Could not find fulfillment_nonce.");
        console.log(`✅ Found Nonce: ${nonce}`);
        return nonce;
    } catch (error) {
        console.error("❌ Error fetching nonce:", error);
        return "7bf1b33b1e"; // Fallback to last known public nonce
    }
}

// ✅ Function to check inventory
async function checkInventory(skuObj) {
    const fulfillment_nonce = await fetchNonce(); // Always get the latest nonce

    try {
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
        if (!data || !data.data || typeof data.data !== "string") return;

        const $ = cheerio.load(data.data);
        let stores = $(".single-store");

        let storeData = {};
        let changes = [];

        stores.each((_, store) => {
            let storeName = $(store).find(".store-name").text().trim() || "Unknown";
            let qtyMatch = $(store).html().match(/Qty in Stock: (\d+)/);
            let qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 0;

            storeData[storeName] = qty;
            let prevQty = previousInventory[skuObj.sku]?.[storeName] ?? "Not tracked";

            if (prevQty !== "Not tracked" && prevQty !== qty) {
                changes.push(`**${skuObj.name}** at **${storeName}** changed: ${prevQty} → ${qty}`);
            }
        });

        previousInventory[skuObj.sku] = storeData;
        return { skuObj, changes };

    } catch (error) {
        console.error(`❌ Error fetching inventory data for ${skuObj.name}:`, error);
        return { skuObj, changes: ["❌ Error checking this SKU."] };
    }
}

// ✅ Function to send inventory updates to Discord
async function sendInventoryUpdates() {
    let allChanges = [];
    for (let skuObj of skuList) {
        let result = await checkInventory(skuObj);
        allChanges.push(result);
    }

    fs.writeFileSync(inventoryFile, JSON.stringify(previousInventory, null, 2));

    let message = "**📋 Inventory Update:**\n";
    let changesExist = false;

    allChanges.forEach(({ skuObj, changes }) => {
        if (changes.length > 0) {
            changesExist = true;
            message += `\n📢 **${skuObj.name}** (${skuObj.sku}):\n`;
            changes.forEach(change => message += `- ${change}\n`);
        }
    });

    if (!changesExist) {
        message += "\n✅ No changes detected.\nChecked SKUs:\n";
        skuList.forEach(({ name, sku }) => message += `- ${name} (${sku})\n`);
    }

    // Send message to appropriate channel based on changes
    const channelId = changesExist ? CHANNEL_ID : NO_CHANGE_CHANNEL_ID;
    const channel = client.channels.cache.get(channelId);
    
    if (channel) {
        await channel.send(message);
    } else {
        console.error(`❌ Error: Unable to find the Discord channel with ID: ${channelId}`);
    }
}

// ✅ Run inventory check every 6 hours
client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await sendInventoryUpdates();  // Run inventory check once when the bot starts
    client.destroy(); // Shut down the bot after sending the message
});

// ✅ Start the bot
client.login(DISCORD_TOKEN);
