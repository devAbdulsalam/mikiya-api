import mongoose from 'mongoose';

const grantSchema = new mongoose.Schema({
	grantId: {
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
	},
	grantorType: {
		type: String,
		enum: [
			'government',
			'corporate',
			'foundation',
			'international',
			'ngo',
			'individual',
		],
		default: 'foundation',
	},
	grantorId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Grantor',
	},
	grantorName: {
		type: String,
		required: true,
		trim: true,
	},
	grantorContact: {
		email: String,
		phone: String,
		address: String,
	},

	// Grant Details
	title: {
		type: String,
		required: true,
		trim: true,
	},
	description: String,
	purpose: {
		type: String,
		required: true,
	},
	amount: {
		type: Number,
		required: true,
		min: 0,
	},
	currency: {
		type: String,
		default: 'NGN',
	},

	// Timeline
	applicationDate: {
		type: Date,
		required: true,
	},
	approvalDate: Date,
	startDate: {
		type: Date,
		required: true,
	},
	endDate: {
		type: Date,
		required: true,
	},
	reportingDates: [Date],

	// Payment Schedule
	paymentSchedule: [
		{
			installmentNumber: Number,
			amount: Number,
			dueDate: Date,
			status: {
				type: String,
				enum: ['pending', 'due', 'paid', 'overdue'],
				default: 'pending',
			},
			paymentDate: Date,
			reference: String,
		},
	],

	// Requirements and Restrictions
	requirements: [
		{
			type: String,
			trim: true,
		},
	],
	restrictions: [
		{
			type: String,
			trim: true,
		},
	],
	reportingRequirements: [
		{
			reportType: String,
			dueDate: Date,
			frequency: String,
			submitted: Boolean,
			submissionDate: Date,
		},
	],

	// Status
	status: {
		type: String,
		enum: [
			'draft',
			'submitted',
			'under_review',
			'approved',
			'rejected',
			'active',
			'completed',
			'terminated',
			'cancelled',
		],
		default: 'draft',
	},
	progress: {
		type: Number,
		min: 0,
		max: 100,
		default: 0,
	},

	// Budget
	budget: {
		totalAllocated: Number,
		totalSpent: Number,
		remaining: Number,
		categories: [
			{
				category: String,
				allocated: Number,
				spent: Number,
				remaining: Number,
			},
		],
	},

	// Outcomes and Impact
	expectedOutcomes: [
		{
			outcome: String,
			indicator: String,
			target: String,
			achieved: String,
		},
	],
	impactMetrics: {
		beneficiariesTargeted: Number,
		beneficiariesReached: Number,
		communitiesImpacted: Number,
		sustainabilityScore: Number,
	},

	// Team
	projectManager: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	teamMembers: [
		{
			userId: {
				type: mongoose.Schema.Types.ObjectId,
				ref: 'User',
			},
			role: String,
			responsibilities: [String],
		},
	],

	// Documents
	documents: [
		{
			documentType: String,
			name: String,
			url: String,
			uploadDate: Date,
			version: String,
		},
	],

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
	updatedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
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
grantSchema.pre('save', async function () {
	this.updatedAt = Date.now();

	// Calculate budget remaining
	if (this.budget) {
		this.budget.remaining = this.budget.totalAllocated - this.budget.totalSpent;
	}
});

// Generate grant ID before saving
grantSchema.pre('save', async function () {
	if (!this.grantId) {
		const timestamp = Date.now().toString().slice(-6);
		const random = Math.floor(Math.random() * 1000)
			.toString()
			.padStart(3, '0');
		this.grantId = `GRANT-${timestamp}-${random}`;
	}
});

// Update foundation statistics when grant is approved
grantSchema.post('save', async function (doc) {
	try {
		if (doc.status === 'approved') {
			await mongoose.model('Foundation').findByIdAndUpdate(doc.foundationId, {
				$inc: {
					'statistics.totalGrants.amount': doc.amount,
					'statistics.totalGrants.count': 1,
				},
			});
		}
	} catch (error) {
		console.error('Error updating foundation statistics:', error);
	}
});

const Grant = mongoose.model('Grant', grantSchema);

export default Grant;
