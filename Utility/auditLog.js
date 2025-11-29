import fs from "fs";

try {
    const rawData = fs.readFileSync("Storage/AuditLogStorage.json", 'utf-8');
    const jsonData = JSON.parse(rawData);
    console.log(jsonData);
} catch (error) {
    console.log("error in parsing", error);
}