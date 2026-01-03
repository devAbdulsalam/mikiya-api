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
	creditInfo: {
		creditBalance: { type: Number, default: 0 },
		creditLimit: { type: Number, default: 0 },
		currentDebt: { type: Number, default: 0 },
		creditEnabled: { type: Boolean, default: false },
		paymentTerms: { type: String, default: '30 days' },
	},
	salesStats: {
		totalTransactions: { type: Number, default: 0 },
		totalAmount: { type: Number, default: 0 },
		lastPurchase: Date,
		averagePurchase: { type: Number, default: 0 },
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
