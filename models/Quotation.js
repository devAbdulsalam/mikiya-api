import mongoose from 'mongoose';

const quotationSchema = new mongoose.Schema({
	clientName: String,
	quotationNumber: String,
	date: Date,
	quotationInfo: {
		quotationNumber: String,
		validUntil: String,
		terms: String,
		date: Date,
	},
	items: [
		{
			id: String,
			description: String,
			unitPrice: Number,
			quantity: Number,
			total: Number,
		},
	],
	clientDetails: {
		name: String,
		email: String,
		phone: String,
		address: String,
		_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Customer',
		},
	},
	bankDetails: {
		bankName: String,
		accountName: String,
		accountNumber: String,
	},
	grandTotal: {
		type: Number,
		required: true,
		min: 0,
	},
	createdBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
});

const Quotation = mongoose.model('Quotation', quotationSchema);
export default Quotation;
