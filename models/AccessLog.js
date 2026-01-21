import mongoose from 'mongoose';

const accessLogSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},

		location: String,
	},
	{ timestamps: true },
);

const AccessLog = mongoose.model('AccessLog', accessLogSchema);

export default AccessLog;

export const createAccessLog = async (userId, location) => {
	try {
		const accessLog = new AccessLog({
			user: userId,
			location,
		});
		await accessLog.save();
	} catch (error) {
		console.error('Error creating access log:', error);
		throw error;
	}
};
