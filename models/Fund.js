import mongoose from 'mongoose';

const fundSchema = new mongoose.Schema(
	{
		foundationId: { type: String, required: true, index: true },
		sourceType: {
			type: String,
			enum: [
				'donation',
				'grant',
				'sponsorship',
				'general',
				'restricted',
				'endowment',
				'scholarship',
				'research',
				'capital',
				'operating',
				'special_project',
				'emergency',
				'other',
			],
			default: 'general',
			required: true,
		},
		sourceId: { type: mongoose.Schema.Types.ObjectId },
		amount: { type: Number, required: true },
		currency: { type: String, default: 'NGN' },
		receivedDate: { type: Date, default: Date.now },
		notes: String,
	},
	{ timestamps: true }
);

const Fund = mongoose.model('Fund', fundSchema);

export default Fund;
