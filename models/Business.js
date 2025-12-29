import mongoose from 'mongoose';

const businessSchema = new mongoose.Schema({
	owner: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	name: {
		type: String,
		required: true,
		trim: true,
	},
	description: {
		type: String,
	},
	businessId: {
		type: String,
		required: true,
		unique: true,
	},
	address: String,
	managers: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
	],
	contact: {
		phone: String,
		email: String,
		whatsapp: String,
	},
	totalOutlets: {
		type: Number,
		default: 0,
	},
	totalSales: {
		type: Number,
		default: 0,
	},
	totalProducts: {
		type: Number,
		default: 0,
	},
	financial: {
		totalRevenue: { type: Number, default: 0 },
		totalExpenses: { type: Number, default: 0 },
		currentBalance: { type: Number, default: 0 },
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

businessSchema.pre('save', async function () {
	this.updatedAt = Date.now();
});

const Business = mongoose.model('Business', businessSchema);

export default Business;
