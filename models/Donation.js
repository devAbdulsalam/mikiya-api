import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema({
	donationId: {
		type: String,
		required: true,
		unique: true,
		trim: true,
	},
	foundationId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Foundation',
		required: true,
	},
	fundId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Fund',
		required: true,
	},
	donorType: {
		type: String,
		enum: [
			'individual',
			'corporate',
			'foundation',
			'government',
			'ngo',
			'religious',
			'other',
		],
		default: 'individual',
	},
	donorId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Donor',
	},
	donorName: {
		type: String,
		required: true,
		trim: true,
	},
	donorEmail: String,
	donorPhone: String,
	donorAddress: {
		street: String,
		city: String,
		state: String,
		country: String,
	},
	anonymous: {
		type: Boolean,
		default: false,
	},

	// Donation Details
	amount: {
		type: Number,
		required: true,
		min: 0,
	},
	currency: {
		type: String,
		default: 'NGN',
	},
	donationDate: {
		type: Date,
		required: true,
		default: Date.now,
	},
	receiptDate: Date,
	paymentMethod: {
		type: String,
		enum: [
			'cash',
			'bank_transfer',
			'cheque',
			'online_payment',
			'mobile_money',
			'credit_card',
			'other',
		],
		default: 'bank_transfer',
	},
	referenceNumber: String,

	// Designation
	designation: {
		type: String,
		enum: [
			'unrestricted',
			'restricted',
			'endowment',
			'in_memory',
			'in_honor',
			'specific_project',
		],
		default: 'unrestricted',
	},
	designationDetails: String,
	projectId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Project',
	},

	// Recurring Donation
	isRecurring: {
		type: Boolean,
		default: false,
	},
	recurringDetails: {
		frequency: {
			type: String,
			enum: ['weekly', 'monthly', 'quarterly', 'annually'],
		},
		nextPaymentDate: Date,
		endDate: Date,
		totalPayments: Number,
		paymentsMade: {
			type: Number,
			default: 0,
		},
	},

	// Tax and Compliance
	taxDeductible: {
		type: Boolean,
		default: false,
	},
	taxReceiptIssued: {
		type: Boolean,
		default: false,
	},
	taxReceiptNumber: String,
	taxReceiptDate: Date,

	// Acknowledgment
	acknowledged: {
		type: Boolean,
		default: false,
	},
	acknowledgmentMethod: {
		type: String,
		enum: ['email', 'letter', 'phone', 'in_person', 'none'],
		default: 'email',
	},
	acknowledgmentDate: Date,
	acknowledgmentNotes: String,

	// Status
	status: {
		type: String,
		enum: [
			'pledged',
			'received',
			'processed',
			'acknowledged',
			'cancelled',
			'refunded',
		],
		default: 'received',
	},

	// Bank Details
	bankDetails: {
		bankName: String,
		accountName: String,
		accountNumber: String,
		transactionReference: String,
		transactionDate: Date,
	},

	// Audit Trail
	recordedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	verifiedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	verificationDate: Date,
	notes: String,
	attachments: [
		{
			name: String,
			url: String,
			uploadDate: Date,
		},
	],
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});

// Update timestamp before saving
donationSchema.pre('save', async function () {
	this.updatedAt = Date.now();
});

// Generate donation ID before saving
donationSchema.pre('save', async function () {
	if (!this.donationId) {
		const timestamp = Date.now().toString().slice(-6);
		const random = Math.floor(Math.random() * 1000)
			.toString()
			.padStart(3, '0');
		this.donationId = `DON-${timestamp}-${random}`;
	}
});

// Update fund balance after donation is saved
donationSchema.post('save', async function (doc) {
	try {
		if (doc.status === 'received') {
			// Update fund balance
			await mongoose.model('Fund').findByIdAndUpdate(doc.fundId, {
				$inc: {
					currentBalance: doc.amount,
					'performance.totalReceived': doc.amount,
				},
				$set: {
					'performance.lastDisbursement': new Date(),
				},
			});

			// Update foundation statistics
			await mongoose.model('Foundation').findByIdAndUpdate(doc.foundationId, {
				$inc: {
					'statistics.totalDonations.amount': doc.amount,
					'statistics.totalDonations.count': 1,
				},
			});
		}
	} catch (error) {
		console.error('Error updating fund balance after donation:', error);
	}
});

const Donation = mongoose.model('Donation', donationSchema);

export default Donation;
