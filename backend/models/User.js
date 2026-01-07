const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, unique: true, lowercase: true },
        mobileno: { type: String, trim: true, default: '' },
        password: { type: String },
        firebaseUid: { type: String, sparse: true },
        photoURL: { type: String },
        authProvider: { type: String, enum: ['local', 'google'], default: 'local' }
    },
    { timestamps: true }
);

userSchema.pre('save', async function (next) {
    // Only hash password if it exists and is modified
    if (!this.password || !this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    }
    catch (error) {
        next(error);
    }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
