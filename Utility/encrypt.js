import bcrypt from 'bcryptjs';

export const hashPassword = async(password) => {
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(password, salt);
    return passwordHash;
}


export const verifyHashPassword = async (plaintext, hashedPassword) => {
    const isMatch = await bcrypt.compare(plaintext, hashedPassword);
    return isMatch;
}
