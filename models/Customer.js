import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
	customerId: {
		type: String,
		required: true,
		unique: true,
	},
	name: {
		type: String,
		required: true,
		trim: true,
	},
	totalSales: { type: Number, default: 0 },
	creditBalance: { type: Number, default: 0 },
	creditLimit: { type: Number, default: 0 },
	currentDebt: { type: Number, default: 0 },
	creditEnabled: { type: Boolean, default: true },
	paymentTerms: { type: String, default: '30 days' },
	totalAmount: { type: Number, default: 0 },
	totalTransactions: { type: Number, default: 0 },
	outletId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Outlet',
	},
	businessId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Business',
	},
	type: {
		type: String,
		enum: ['wholesale', 'retail', 'corporate', 'individual'],
		default: 'retail',
	},
	phone: String,
	email: String,
	address: String,
	businessInfo: {
		businessName: String,
		businessType: String,
		registrationNumber: String,
	},
	createdBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	isActive: {
		type: Boolean,
		default: true,
	},
	notes: String,
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});

// Update timestamp
customerSchema.pre('save', async function () {
	this.updatedAt = Date.now();
});

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
