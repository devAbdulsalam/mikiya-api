import mongoose from 'mongoose';

const passwordResetSchema = new mongoose.Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	token: {
		type: String,
		required: true,
	},
	expiresAt: {
		type: Date,
		required: true,
		default: () => new Date(Date.now() + 3600000), // 1 hour
		index: { expires: '1h' }, // Auto-delete after 1 hour
	},
	used: {
		type: Boolean,
		default: false,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

export default PasswordReset;
