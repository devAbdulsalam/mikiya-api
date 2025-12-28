import mongoose from 'mongoose';

const foundationSchema = new mongoose.Schema({
	foundationId: {
		type: String,
		required: true,
		unique: true,
		trim: true,
	},
	name: {
		type: String,
		required: true,
		trim: true,
	},
	description: {
		type: String,
		trim: true,
	},
	registrationNumber: {
		type: String,
		required: true,
		unique: true,
	},
	taxId: String,
	establishmentDate: {
		type: Date,
		required: true,
	},
	mission: String,
	vision: String,
	values: [String],
	legalForm: {
		type: String,
		enum: ['nonprofit', 'charity', 'trust', 'ngo', 'other'],
		default: 'nonprofit',
	},
	status: {
		type: String,
		enum: ['active', 'inactive', 'suspended', 'dormant'],
		default: 'active',
	},

	// Contact Information
	contact: {
		address: {
			street: String,
			city: String,
			state: String,
			country: String,
			postalCode: String,
		},
		phone: String,
		email: String,
		website: String,
		socialMedia: {
			facebook: String,
			twitter: String,
			linkedin: String,
			instagram: String,
		},
	},

	// Leadership
	boardOfDirectors: [
		{
			name: String,
			position: String,
			email: String,
			phone: String,
			appointmentDate: Date,
			termEnd: Date,
			isActive: Boolean,
		},
	],
	executiveDirector: {
		name: String,
		email: String,
		phone: String,
		appointmentDate: Date,
	},

	// Financial Information
	financialYear: {
		startMonth: {
			type: Number,
			min: 1,
			max: 12,
			default: 1, // January
		},
		endMonth: {
			type: Number,
			min: 1,
			max: 12,
			default: 12, // December
		},
	},
	currency: {
		type: String,
		default: 'NGN',
	},
	initialCapital: {
		type: Number,
		default: 0,
	},

	// Bank Accounts
	bankAccounts: [
		{
			bankName: String,
			accountName: String,
			accountNumber: String,
			accountType: String,
			currency: String,
			isPrimary: {
				type: Boolean,
				default: false,
			},
			balance: {
				type: Number,
				default: 0,
			},
			lastReconciliation: Date,
		},
	],

	// Settings
	settings: {
		allowMultipleFunds: {
			type: Boolean,
			default: true,
		},
		requireApprovalForExpenses: {
			type: Boolean,
			default: true,
		},
		approvalThreshold: {
			type: Number,
			default: 100000, // Amount above which approval is required
		},
		fiscalPolicy: String,
		reportingFrequency: {
			type: String,
			enum: ['monthly', 'quarterly', 'biannually', 'annually'],
			default: 'monthly',
		},
	},

	// Statistics
	statistics: {
		totalFunds: {
			type: Number,
			default: 0,
		},
		totalDonations: {
			amount: { type: Number, default: 0 },
			count: { type: Number, default: 0 },
		},
		totalGrants: {
			amount: { type: Number, default: 0 },
			count: { type: Number, default: 0 },
		},
		totalExpenses: {
			amount: { type: Number, default: 0 },
			count: { type: Number, default: 0 },
		},
		activeProjects: {
			type: Number,
			default: 0,
		},
		totalBeneficiaries: {
			type: Number,
			default: 0,
		},
		lastUpdated: Date,
	},

	// Documents
	documents: [
		{
			name: String,
			type: String,
			url: String,
			uploadDate: Date,
			expires: Date,
		},
	],

	// Audit Trail
	createdBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	updatedBy: {
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

// Update timestamp before saving
foundationSchema.pre('save', async function () {
	this.updatedAt = Date.now();
});

// Update statistics before saving
foundationSchema.pre('save', async function () {
	if (this.isModified('statistics')) {
		this.statistics.lastUpdated = new Date();
	}
});

const Foundation = mongoose.model('Foundation', foundationSchema);

export default Foundation;
