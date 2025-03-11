const fs = require("fs");

const oldInventoryFile = "inventory_old.json";
const newInventoryFile = "inventory.json";

// SKU to Product Name Mapping
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

const skuMap = Object.fromEntries(skuList.map(({ sku, name }) => [sku, name]));

// Load JSON files
function loadJSON(file) {
    if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    }
    return {};
}

const oldInventory = loadJSON(oldInventoryFile);
const newInventory = loadJSON(newInventoryFile);

// Compare two inventories
function compareInventories(oldInv, newInv) {
    let changes = [];

    for (let zipCode in newInv) {
        if (!oldInv[zipCode]) oldInv[zipCode] = {};
        
        for (let sku in newInv[zipCode]) {
            let productName = skuMap[sku] || sku; // Get product name from mapping
            if (!oldInv[zipCode][sku]) oldInv[zipCode][sku] = {};
            
            for (let store in newInv[zipCode][sku]) {
                let newQty = newInv[zipCode][sku][store];
                let oldQty = oldInv[zipCode][sku][store] ?? "Not tracked";

                if (oldQty !== newQty) {
                    changes.push({
                        zipCode,
                        product: productName,
                        store,
                        oldQty,
                        newQty,
                        change: `**${productName}** at **${store}** changed: ${oldQty} → ${newQty}`
                    });
                }
            }
        }
    }
    return changes;
}

const changes = compareInventories(oldInventory, newInventory);

if (changes.length > 0) {
    console.log("📋 Inventory Changes Detected:");
    changes.forEach(change => console.log(change.change));
} else {
    console.log("✅ No changes detected.");
}

// Save changes to a file (optional)
fs.writeFileSync("changes.json", JSON.stringify(changes, null, 2));