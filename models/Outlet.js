import mongoose from 'mongoose';

const outletSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		trim: true,
	},
	outletId: {
		type: String,
		required: true,
		unique: true,
	},
	businessId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Business',
		required: true,
	},
	managerId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	managers: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
	],
	type: {
		type: String,
		enum: ['wholesale', 'retail', 'general_supply'],
		default: 'wholesale',
		required: true,
	},
	address: String,
	description: String,
	phone: String,
	settings: {
		currency: { type: String, default: 'NGN' },
		taxRate: { type: Number, default: 0 },
		businessHours: {
			open: { type: String, default: '08:00' },
			close: { type: String, default: '18:00' },
			days: {
				type: [String],
				default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
			},
		},
	},
	isActive: {
		type: Boolean,
		default: true,
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

outletSchema.pre('save', async function () {
	this.updatedAt = Date.now();
});

const Outlet = mongoose.model('Outlet', outletSchema);

export default Outlet;
