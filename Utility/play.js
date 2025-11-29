const fs = require('fs')
const hash = require('./encrypt')



const hashPassword = hash.hashPassword;

const changePassword = async (userId, password) => {
    try {
        const rawData = fs.readFileSync("Storage/UserStorage.json", 'utf-8');
        const jsonData = JSON.parse(rawData);
        let userFound = false;
        for (const element of jsonData.Users) {
            if (element.userId == userId) {
                element.hashedPassword = await hashPassword(password);
                userFound = true;
                break;
            }
        }
        if (userFound) {
            await fs.writeFileSync("Storage/UserStorage.json", JSON.stringify(jsonData, null, 4));
            console.log(`UserID ${userId} password changed`);
        }else{
            console.log(`UserID ${userId} not found`);
        }

    } catch (err) {
        console.log(err);
    }
}

changePassword(2, "dmeotest@321");
