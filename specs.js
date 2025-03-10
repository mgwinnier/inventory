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
    { name: "Eagle Rare", sku: "008800402134" },
    { name: "JD Coy Hill", sku: "008218400763" },
    { name: "JD 10 Year", sku: "008218400637" },
    { name: "JD 12 Year", sku: "008218400638" },
    { name: "JD 14 Year", sku: "008218400726" },
    { name: "OF 1924", sku: "008112800341" },
    { name: "Forta Blanco", sku: "750222196610" },
    { name: "Forta Reposado", sku: "750222196710" },
    { name: "Forta Anejo", sku: "750222196810" },
    { name: "Penelope 17year ALW", sku: "008835214260" },
];

// Define zip codes and their corresponding Discord channels
const zipCodes = {
    "75204": process.env.CHANNEL_ID,  // Existing location
    "78132": "1348635596054200340",  // New Braunfels, Texas
};

const NO_CHANGE_CHANNEL_ID = "1334889254328733766"; // Channel for no-change updates
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const inventoryFile = "inventory.json";

// Load previous inventory from file
let previousInventory = {};
if (fs.existsSync(inventoryFile)) {
    previousInventory = JSON.parse(fs.readFileSync(inventoryFile, "utf8"));
}

// Initialize Discord Bot
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// ✅ Fetch the latest public fulfillment_nonce (only once)
async function fetchNonce() {
    try {
        const response = await fetch("https://specsonline.com");
        const body = await response.text();
        const $ = cheerio.load(body);

        const scriptContent = $('script:contains("fulfillmentJS")').html();
        const nonceMatch = scriptContent?.match(/"nonce":"(.*?)"/);
        const nonce = nonceMatch ? nonceMatch[1] : null;

        if (!nonce) throw new Error("⚠️ Could not find fulfillment_nonce.");
        console.log(`✅ Found Nonce: ${nonce}`);
        return nonce;
    } catch (error) {
        console.error("❌ Error fetching nonce:", error);
        return "7bf1b33b1e"; // Fallback nonce
    }
}

// ✅ Check inventory for a specific SKU at a specific zip code
async function checkInventory(skuObj, zipCode, fulfillment_nonce) {
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
                radius: "100",
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
            let prevQty = previousInventory[zipCode]?.[skuObj.sku]?.[storeName] ?? "Not tracked";

            if (prevQty !== "Not tracked" && prevQty !== qty) {
                changes.push(`**${skuObj.name}** at **${storeName}** changed: ${prevQty} → ${qty}`);
            }
        });

        if (!previousInventory[zipCode]) previousInventory[zipCode] = {};
        previousInventory[zipCode][skuObj.sku] = storeData;

        return { skuObj, changes, zipCode };

    } catch (error) {
        console.error(`❌ Error fetching inventory data for ${skuObj.name} in ${zipCode}:`, error);
        return { skuObj, changes: ["❌ Error checking this SKU."], zipCode };
    }
}

// ✅ Send inventory updates to Discord
async function sendInventoryUpdates() {
    let fulfillment_nonce = await fetchNonce(); // Fetch nonce once before making requests
    let allChangesByZip = {};

    for (let zipCode of Object.keys(zipCodes)) {
        allChangesByZip[zipCode] = [];

        for (let skuObj of skuList) {
            let result = await checkInventory(skuObj, zipCode, fulfillment_nonce);
            allChangesByZip[zipCode].push(result);
        }
    }

    fs.writeFileSync(inventoryFile, JSON.stringify(previousInventory, null, 2));

    for (let [zipCode, allChanges] of Object.entries(allChangesByZip)) {
        let messageChunks = [];
        let currentMessage = `**📋 Inventory Update for ${zipCode}:**\n`;
        let changesExist = false;
        const MAX_MESSAGE_LENGTH = 2000;

        allChanges.forEach(({ skuObj, changes }) => {
            if (changes.length > 0) {
                changesExist = true;
                let header = `\n📢 **${skuObj.name}** (${skuObj.sku}):\n`;
                let changesText = changes.map(change => `- ${change}`).join("\n");

                let potentialMessage = currentMessage + header + changesText + "\n";

                if (potentialMessage.length > MAX_MESSAGE_LENGTH) {
                    messageChunks.push(currentMessage);
                    currentMessage = `**📋 Inventory Update for ${zipCode} (Continued):**\n` + header + changesText + "\n";
                } else {
                    currentMessage = potentialMessage;
                }
            }
        });

        const channelId = changesExist ? zipCodes[zipCode] : NO_CHANGE_CHANNEL_ID;
        const channel = client.channels.cache.get(channelId);

        if (channel) {
            for (let msg of messageChunks) {
                await channel.send(msg);
            }
        } else {
            console.error(`❌ Error: Unable to find the Discord channel for zip ${zipCode}`);
        }
    }
}

// ✅ Start the bot and check inventory
client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await sendInventoryUpdates();
    client.destroy();
});

client.login(DISCORD_TOKEN);
