import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
	expenseId: {
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
	projectId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Project',
	},

	// Expense Details
	expenseType: {
		type: String,
		enum: [
			'operational',
			'program',
			'administrative',
			'fundraising',
			'capital',
			'travel',
			'training',
			'equipment',
			'rent',
			'utilities',
			'salary',
			'consultancy',
			'other',
		],
		default: 'operational',
	},
	category: {
		type: String,
		required: true,
		trim: true,
	},
	subcategory: String,
	description: {
		type: String,
		required: true,
		trim: true,
	},

	// Amount
	amount: {
		type: Number,
		required: true,
		min: 0,
	},
	currency: {
		type: String,
		default: 'NGN',
	},
	taxAmount: {
		type: Number,
		default: 0,
	},
	totalAmount: {
		type: Number,
		required: true,
		min: 0,
	},

	// Dates
	expenseDate: {
		type: Date,
		required: true,
		default: Date.now,
	},
	paymentDate: Date,
	dueDate: Date,

	// Vendor/Payee
	payeeType: {
		type: String,
		enum: ['vendor', 'employee', 'contractor', 'beneficiary', 'other'],
		default: 'vendor',
	},
	payeeId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Vendor',
	},
	payeeName: {
		type: String,
		required: true,
		trim: true,
	},
	payeeContact: {
		email: String,
		phone: String,
		address: String,
	},

	// Payment Details
	paymentMethod: {
		type: String,
		enum: [
			'cash',
			'cheque',
			'bank_transfer',
			'online',
			'mobile',
			'credit_card',
		],
		default: 'bank_transfer',
	},
	paymentReference: String,
	bankDetails: {
		bankName: String,
		accountName: String,
		accountNumber: String,
	},

	// Approval Workflow
	requiresApproval: {
		type: Boolean,
		default: false,
	},
	approvalStatus: {
		type: String,
		enum: ['pending', 'approved', 'rejected', 'cancelled'],
		default: 'pending',
	},
	approvedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	approvalDate: Date,
	approvalNotes: String,

	// Budget Allocation
	budgetLineItem: String,
	budgetCategory: String,
	isBudgeted: {
		type: Boolean,
		default: true,
	},
	budgetVariance: {
		type: Number,
		default: 0,
	},

	// Receipt and Documentation
	hasReceipt: {
		type: Boolean,
		default: false,
	},
	receiptNumber: String,
	receiptDate: Date,
	attachments: [
		{
			name: String,
			url: String,
			type: String,
			uploadDate: Date,
		},
	],

	// Status
	status: {
		type: String,
		enum: [
			'draft',
			'submitted',
			'approved',
			'paid',
			'rejected',
			'cancelled',
			'reimbursed',
		],
		default: 'draft',
	},

	// Recurring Expense
	isRecurring: {
		type: Boolean,
		default: false,
	},
	recurringDetails: {
		frequency: {
			type: String,
			enum: ['daily', 'weekly', 'monthly', 'quarterly', 'annually'],
		},
		nextDate: Date,
		endDate: Date,
		totalOccurrences: Number,
		occurrences: Number,
	},

	// Audit Trail
	submittedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	paidBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	verifiedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	verificationDate: Date,
	notes: String,
	tags: [String],
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
expenseSchema.pre('save', async function () {
	this.updatedAt = Date.now();

	// Calculate total amount
	this.totalAmount = this.amount + this.taxAmount;

	// Set requiresApproval based on amount
	if (this.amount >= 100000) {
		// Threshold for approval
		this.requiresApproval = true;
	}

});

// Generate expense ID before saving
expenseSchema.pre('save', async function () {
	if (!this.expenseId) {
		const timestamp = Date.now().toString().slice(-6);
		const random = Math.floor(Math.random() * 1000)
			.toString()
			.padStart(3, '0');
		this.expenseId = `EXP-${timestamp}-${random}`;
	}
});

// Update fund balance and foundation statistics after expense is paid
expenseSchema.post('save', async function (doc) {
	try {
		if (doc.status === 'paid') {
			// Update fund balance
			await mongoose.model('Fund').findByIdAndUpdate(doc.fundId, {
				$inc: {
					currentBalance: -doc.totalAmount,
					allocatedAmount: -doc.totalAmount,
					'performance.totalDisbursed': doc.totalAmount,
				},
				$set: {
					'performance.lastDisbursement': new Date(),
				},
			});

			// Update foundation statistics
			await mongoose.model('Foundation').findByIdAndUpdate(doc.foundationId, {
				$inc: {
					'statistics.totalExpenses.amount': doc.totalAmount,
					'statistics.totalExpenses.count': 1,
				},
			});
		}
	} catch (error) {
		console.error('Error updating fund balance after expense:', error);
	}
});

const FoundationExpense = mongoose.model('FoundationExpense', expenseSchema);

export default FoundationExpense;
