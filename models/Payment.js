import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
	invoiceId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Invoice',
	},
	customerId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Customer',
		required: true,
	},
	amount: {
		type: Number,
		required: true,
		min: 0,
	},
	date: {
		type: Date,
		default: Date.now,
	},
	method: {
		type: String,
		enum: ['cash', 'bank transfer', 'cheque', 'card'],
		required: true,
	},
	receipt: {
		type: String,
	},
	reference: {
		type: String,
	},
	createdBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
});

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
