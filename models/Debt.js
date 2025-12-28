import mongoose from 'mongoose';

const debtSchema = new mongoose.Schema(
	{
		customer: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Customer',
			required: true,
		},
		outlet: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Outlet',
			required: true,
		},
		amount: {
			type: Number,
			required: true,
			min: 0,
		},
		balance: {
			type: Number,
			required: true,
			min: 0,
		},
		status: {
			type: String,
			enum: ['pending', 'partially_paid', 'paid'],
			default: 'pending',
		},
		description: String, // Reason for the debt

		// **Track order reference**
		order: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Order',
		},

		// **Payments applied toward debt**
		payments: [
			{
				amount: Number,
				paymentDate: Date,
				paymentRef: {
					type: mongoose.Schema.Types.ObjectId,
					ref: 'Payment',
				},
			},
		],

		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
		updatedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: true }
);

// === METHODS ===
debtSchema.methods.applyPayment = function (amount, paymentRef) {
	this.balance = Math.max(this.balance - amount, 0);

	// Determine updated status
	if (this.balance === 0) this.status = 'paid';
	else this.status = 'partially_paid';

	// Log the payment
	this.payments.push({
		amount,
		paymentDate: new Date(),
		paymentRef,
	});

	return this.save();
};

const Debt = mongoose.model('Debt', debtSchema);
export default Debt;
