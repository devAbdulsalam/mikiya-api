import mongoose from 'mongoose';

const fundSchema = new mongoose.Schema({
	fundId: {
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
	name: {
		type: String,
		required: true,
		trim: true,
	},
	description: {
		type: String,
		trim: true,
	},
	purpose: {
		type: String,
		required: true,
	},
	type: {
		type: String,
		enum: [
			'general',
			'restricted',
			'endowment',
			'scholarship',
			'research',
			'capital',
			'operating',
			'special_project',
			'emergency',
			'other',
		],
		default: 'general',
	},
	category: {
		type: String,
		enum: ['revenue', 'expenditure', 'reserve', 'investment'],
		default: 'revenue',
	},

	// Financial Information
	currency: {
		type: String,
		default: 'NGN',
	},
	targetAmount: {
		type: Number,
		default: 0,
	},
	currentBalance: {
		type: Number,
		default: 0,
	},
	allocatedAmount: {
		type: Number,
		default: 0,
	},
	committedAmount: {
		type: Number,
		default: 0,
	},
	availableBalance: {
		type: Number,
		default: function () {
			return this.currentBalance - this.allocatedAmount - this.committedAmount;
		},
	},

	// Budget Information
	budget: {
		fiscalYear: Number,
		allocatedBudget: Number,
		spentBudget: Number,
		remainingBudget: Number,
		budgetStartDate: Date,
		budgetEndDate: Date,
	},

	// Timeframe
	startDate: {
		type: Date,
		required: true,
	},
	endDate: Date,
	isActive: {
		type: Boolean,
		default: true,
	},
	isRestricted: {
		type: Boolean,
		default: false,
	},

	// Restrictions
	restrictions: [
		{
			type: String,
			trim: true,
		},
	],
	allowedExpenseCategories: [
		{
			type: String,
			trim: true,
		},
	],
	disallowedExpenseCategories: [
		{
			type: String,
			trim: true,
		},
	],

	// Funding Sources
	fundingSources: [
		{
			sourceType: {
				type: String,
				enum: [
					'donation',
					'grant',
					'investment',
					'government',
					'corporate',
					'individual',
				],
			},
			sourceId: mongoose.Schema.Types.ObjectId,
			sourceName: String,
			amount: Number,
			date: Date,
		},
	],

	// Performance Metrics
	performance: {
		totalReceived: { type: Number, default: 0 },
		totalDisbursed: { type: Number, default: 0 },
		utilizationRate: {
			type: Number,
			default: function () {
				if (this.totalReceived === 0) return 0;
				return (this.totalDisbursed / this.totalReceived) * 100;
			},
		},
		averageDisbursement: { type: Number, default: 0 },
		lastDisbursement: Date,
		nextDisbursement: Date,
	},

	// Audit Trail
	createdBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	approvedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	approvalDate: Date,
	updatedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	notes: String,
	tags: [String],
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
fundSchema.pre('save', async function () {
	this.updatedAt = Date.now();

	// Calculate available balance
	this.availableBalance =
		this.currentBalance - this.allocatedAmount - this.committedAmount;

	// Calculate utilization rate
	if (this.performance.totalReceived > 0) {
		this.performance.utilizationRate =
			(this.performance.totalDisbursed / this.performance.totalReceived) * 100;
	}

});

// Virtual for fund status
fundSchema.virtual('status').get(function () {
	if (!this.isActive) return 'inactive';
	if (this.currentBalance <= 0) return 'depleted';
	if (this.availableBalance <= 0) return 'fully_allocated';
	if (this.endDate && new Date() > this.endDate) return 'expired';
	return 'active';
});

// Virtual for percentage of target achieved
fundSchema.virtual('targetAchievement').get(function () {
	if (this.targetAmount === 0) return 0;
	return (this.currentBalance / this.targetAmount) * 100;
});

// Indexes for better query performance
fundSchema.index({ foundationId: 1, isActive: 1 });
fundSchema.index({ fundId: 1 }, { unique: true });
fundSchema.index({ type: 1, category: 1 });
fundSchema.index({ startDate: 1, endDate: 1 });

const Fund = mongoose.model('Fund', fundSchema);

export default Fund;
