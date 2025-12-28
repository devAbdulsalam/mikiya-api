import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
	projectId: {
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

	// Project Details
	title: {
		type: String,
		required: true,
		trim: true,
	},
	description: {
		type: String,
		required: true,
	},
	objectives: [
		{
			objective: String,
			indicators: [String],
			target: String,
			achieved: String,
		},
	],
	problemStatement: String,
	solutionApproach: String,

	// Categories
	category: {
		type: String,
		enum: [
			'education',
			'health',
			'environment',
			'livelihood',
			'humanitarian',
			'advocacy',
			'research',
			'capacity_building',
			'infrastructure',
			'other',
		],
		default: 'education',
	},
	subcategory: String,
	tags: [String],

	// Timeline
	startDate: {
		type: Date,
		required: true,
	},
	endDate: {
		type: Date,
		required: true,
	},
	duration: {
		type: Number, // in months
		default: function () {
			if (this.startDate && this.endDate) {
				const diff = this.endDate.getTime() - this.startDate.getTime();
				return Math.ceil(diff / (1000 * 60 * 60 * 24 * 30));
			}
			return 0;
		},
	},

	// Budget
	budget: {
		totalBudget: {
			type: Number,
			required: true,
			min: 0,
		},
		allocatedBudget: {
			type: Number,
			default: 0,
		},
		spentBudget: {
			type: Number,
			default: 0,
		},
		remainingBudget: {
			type: Number,
			default: function () {
				return this.budget.totalBudget - this.budget.spentBudget;
			},
		},
		currency: {
			type: String,
			default: 'NGN',
		},
		lineItems: [
			{
				item: String,
				category: String,
				allocated: Number,
				spent: Number,
				remaining: Number,
			},
		],
	},

	// Funding Sources
	fundingSources: [
		{
			sourceType: {
				type: String,
				enum: [
					'grant',
					'donation',
					'foundation',
					'corporate',
					'government',
					'self_funded',
				],
			},
			sourceId: mongoose.Schema.Types.ObjectId,
			sourceName: String,
			amount: Number,
			committed: Number,
			received: Number,
			pending: Number,
		},
	],

	// Location
	location: {
		country: String,
		state: String,
		city: String,
		communities: [String],
		coordinates: {
			lat: Number,
			lng: Number,
		},
	},

	// Beneficiaries
	beneficiaries: {
		target: {
			type: Number,
			default: 0,
		},
		reached: {
			type: Number,
			default: 0,
		},
		demographics: {
			children: Number,
			youth: Number,
			adults: Number,
			elderly: Number,
			male: Number,
			female: Number,
			specialNeeds: Number,
		},
		criteria: [String],
	},

	// Team
	projectManager: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	teamMembers: [
		{
			userId: {
				type: mongoose.Schema.Types.ObjectId,
				ref: 'User',
			},
			role: String,
			responsibilities: [String],
			startDate: Date,
			endDate: Date,
		},
	],
	partners: [
		{
			name: String,
			type: String,
			contact: String,
			role: String,
		},
	],

	// Milestones and Activities
	milestones: [
		{
			title: String,
			description: String,
			dueDate: Date,
			completed: Boolean,
			completionDate: Date,
			deliverables: [String],
		},
	],
	activities: [
		{
			activity: String,
			responsible: String,
			startDate: Date,
			endDate: Date,
			status: {
				type: String,
				enum: ['planned', 'in_progress', 'completed', 'delayed', 'cancelled'],
				default: 'planned',
			},
			progress: Number,
		},
	],

	// Monitoring and Evaluation
	monitoring: {
		indicators: [
			{
				indicator: String,
				baseline: String,
				target: String,
				current: String,
				source: String,
				frequency: String,
			},
		],
		reports: [
			{
				reportType: String,
				dueDate: Date,
				submitted: Boolean,
				submissionDate: Date,
				url: String,
			},
		],
		evaluations: [
			{
				type: String,
				date: Date,
				findings: String,
				recommendations: String,
				url: String,
			},
		],
	},

	// Risks
	risks: [
		{
			risk: String,
			impact: {
				type: String,
				enum: ['low', 'medium', 'high'],
			},
			probability: {
				type: String,
				enum: ['low', 'medium', 'high'],
			},
			mitigation: String,
			owner: String,
		},
	],

	// Status
	status: {
		type: String,
		enum: [
			'planning',
			'approved',
			'active',
			'suspended',
			'completed',
			'cancelled',
			'extended',
		],
		default: 'planning',
	},
	progress: {
		type: Number,
		min: 0,
		max: 100,
		default: 0,
	},
	health: {
		type: String,
		enum: ['good', 'warning', 'critical'],
		default: 'good',
	},

	// Documents
	documents: [
		{
			type: String,
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
projectSchema.pre('save', async function () {
	this.updatedAt = Date.now();

	// Calculate remaining budget
	this.budget.remainingBudget =
		this.budget.totalBudget - this.budget.spentBudget;

	// Calculate duration
	if (this.startDate && this.endDate) {
		const diff = this.endDate.getTime() - this.startDate.getTime();
		this.duration = Math.ceil(diff / (1000 * 60 * 60 * 24 * 30));
	}

	// Update project health based on budget and timeline
	const now = new Date();
	const timeElapsed = (now - this.startDate) / (this.endDate - this.startDate);
	const budgetUtilization = this.budget.spentBudget / this.budget.totalBudget;

	if (timeElapsed > 0.8 && budgetUtilization < 0.6) {
		this.health = 'warning';
	} else if (timeElapsed > 0.9 && budgetUtilization < 0.8) {
		this.health = 'critical';
	} else if (budgetUtilization > 1.1) {
		this.health = 'warning';
	} else {
		this.health = 'good';
	}

});

// Generate project ID before saving
projectSchema.pre('save', async function () {
	if (!this.projectId) {
		const timestamp = Date.now().toString().slice(-6);
		const random = Math.floor(Math.random() * 1000)
			.toString()
			.padStart(3, '0');
		this.projectId = `PROJ-${timestamp}-${random}`;
	}
});

// Update foundation statistics when project is active
projectSchema.post('save', async function (doc) {
	try {
		if (doc.status === 'active') {
			await mongoose.model('Foundation').findByIdAndUpdate(doc.foundationId, {
				$inc: {
					'statistics.activeProjects': 1,
				},
			});
		}
	} catch (error) {
		console.error('Error updating foundation statistics:', error);
	}
});

const Project = mongoose.model('Project', projectSchema);

export default Project;
