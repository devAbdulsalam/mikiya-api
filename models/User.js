import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
	username: {
		type: String,
		required: true,
		unique: true,
		trim: true,
		minlength: 3,
		maxlength: 30,
	},
	email: {
		type: String,
		required: true,
		unique: true,
		lowercase: true,
		trim: true,
	},
	password: {
		type: String,
		required: true,
		minlength: 6,
		select: false,
	},
	role: {
		type: String,
		enum: ['admin', 'manager', 'staff'],
		default: 'staff',
	},
	branch: {
		type: String,
		enum: ['admin', 'foundation', 'solar'],
		default: 'admin',
	},
	assignedBusinesses: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Business',
		},
	],
	assignedOutlets: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Outlet',
		},
	],
	isActive: {
		type: Boolean,
		default: true,
	},
	isSuspended: {
		type: Boolean,
		default: false,
	},
	suspensionReason: String,
	suspendedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	suspensionDate: Date,
	lastLogin: Date,
	lastPasswordChange: Date,
	passwordResetToken: String,
	passwordResetExpires: Date,
	loginAttempts: {
		type: Number,
		default: 0,
	},
	lockUntil: Date,
	profile: {
		firstName: String,
		lastName: String,
		phone: String,
		avatar: String,
		address: String,
	},
	settings: {
		emailNotifications: { type: Boolean, default: true },
		smsNotifications: { type: Boolean, default: false },
		language: { type: String, default: 'en' },
		theme: { type: String, default: 'light' },
	},
	createdBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});


// Generate password reset token
userSchema.methods.createPasswordResetToken = function () {
	const resetToken = crypto.randomBytes(32).toString('hex');

	this.passwordResetToken = crypto
		.createHash('sha256')
		.update(resetToken)
		.digest('hex');

	this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

	return resetToken;
};

// Check if account is locked
userSchema.methods.isLocked = function () {
	return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = function () {
	if (this.lockUntil && this.lockUntil < Date.now()) {
		return this.updateOne({
			$set: { loginAttempts: 1 },
			$unset: { lockUntil: 1 },
		});
	}

	const updates = { $inc: { loginAttempts: 1 } };

	if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
		updates.$set = { lockUntil: Date.now() + 15 * 60 * 1000 }; // 15 minutes
	}

	return this.updateOne(updates);
};

// Reset login attempts on successful login
userSchema.methods.resetLoginAttempts = function () {
	return this.updateOne({
		$set: { loginAttempts: 0 },
		$unset: { lockUntil: 1 },
	});
};

const User = mongoose.model('User', userSchema);

export default User;
