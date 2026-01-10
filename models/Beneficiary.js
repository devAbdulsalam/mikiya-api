import mongoose from 'mongoose';

const beneficiarySchema = new mongoose.Schema(
	{
		foundationId: { type: String, required: true },

		projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },

		name: String,
		gender: String,
		age: Number,

		contact: String,
		location: String,
	},
	{ timestamps: true }
);

export default mongoose.model('Beneficiary', beneficiarySchema);
