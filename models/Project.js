import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
	{
		foundationId: { type: String, required: true, index: true },

		name: { type: String, required: true },
		description: String,
		category: String,

		status: {
			type: String,
			enum: ['planning', 'active', 'on-hold', 'completed'],
			default: 'planning',
		},

		budget: { type: Number, default: 0 },
		spent: { type: Number, default: 0 },

		startDate: Date,
		endDate: Date,

		beneficiaries: { type: Number, default: 0 },
		location: String,
	},
	{ timestamps: true }
);

export default mongoose.model('Project', projectSchema);
