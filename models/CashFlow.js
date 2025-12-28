import mongoose from 'mongoose';

const cashFlowSchema = new mongoose.Schema({
	foundationId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Foundation',
		required: true,
	},
	period: {
		type: String,
		required: true,
		enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
		default: 'monthly',
	},
	periodDate: {
		type: Date,
		required: true,
	},

	// Opening and Closing Balances
	openingBalance: {
		type: Number,
		required: true,
		default: 0,
	},
	closingBalance: {
		type: Number,
		required: true,
		default: 0,
	},

	// Cash Inflows
	inflows: {
		donations: {
			amount: { type: Number, default: 0 },
			count: { type: Number, default: 0 },
		},
		grants: {
			amount: { type: Number, default: 0 },
			count: { type: Number, default: 0 },
		},
		investments: {
			amount: { type: Number, default: 0 },
			count: { type: Number, default: 0 },
		},
		otherIncome: {
			amount: { type: Number, default: 0 },
			count: { type: Number, default: 0 },
		},
		totalInflows: {
			type: Number,
			default: function () {
				return (
					this.inflows.donations.amount +
					this.inflows.grants.amount +
					this.inflows.investments.amount +
					this.inflows.otherIncome.amount
				);
			},
		},
	},

	// Cash Outflows
	outflows: {
		operationalExpenses: {
			amount: { type: Number, default: 0 },
			count: { type: Number, default: 0 },
		},
		programExpenses: {
			amount: { type: Number, default: 0 },
			count: { type: Number, default: 0 },
		},
		administrativeExpenses: {
			amount: { type: Number, default: 0 },
			count: { type: Number, default: 0 },
		},
		fundraisingExpenses: {
			amount: { type: Number, default: 0 },
			count: { type: Number, default: 0 },
		},
		capitalExpenditure: {
			amount: { type: Number, default: 0 },
			count: { type: Number, default: 0 },
		},
		otherExpenses: {
			amount: { type: Number, default: 0 },
			count: { type: Number, default: 0 },
		},
		totalOutflows: {
			type: Number,
			default: function () {
				return (
					this.outflows.operationalExpenses.amount +
					this.outflows.programExpenses.amount +
					this.outflows.administrativeExpenses.amount +
					this.outflows.fundraisingExpenses.amount +
					this.outflows.capitalExpenditure.amount +
					this.outflows.otherExpenses.amount
				);
			},
		},
	},

	// Net Cash Flow
	netCashFlow: {
		type: Number,
		default: function () {
			return this.inflows.totalInflows - this.outflows.totalOutflows;
		},
	},

	// Fund-wise Breakdown
	fundBreakdown: [
		{
			fundId: {
				type: mongoose.Schema.Types.ObjectId,
				ref: 'Fund',
			},
			fundName: String,
			openingBalance: Number,
			inflows: Number,
			outflows: Number,
			closingBalance: Number,
		},
	],

	// Analysis Metrics
	analysis: {
		operatingCashFlow: Number,
		investingCashFlow: Number,
		financingCashFlow: Number,
		cashFlowMargin: {
			type: Number,
			default: function () {
				if (this.inflows.totalInflows === 0) return 0;
				return (this.netCashFlow / this.inflows.totalInflows) * 100;
			},
		},
		daysCashOnHand: {
			type: Number,
			default: function () {
				const avgDailyExpenses = this.outflows.totalOutflows / 30; // Assuming monthly
				if (avgDailyExpenses === 0) return 0;
				return this.closingBalance / avgDailyExpenses;
			},
		},
		liquidityRatio: {
			type: Number,
			default: function () {
				if (this.outflows.totalOutflows === 0) return 0;
				return this.closingBalance / this.outflows.totalOutflows;
			},
		},
	},

	// Reconciliation
	reconciled: {
		type: Boolean,
		default: false,
	},
	reconciledBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	reconciliationDate: Date,
	reconciliationNotes: String,

	// Status
	status: {
		type: String,
		enum: ['draft', 'calculated', 'reviewed', 'approved', 'published'],
		default: 'draft',
	},

	// Audit Trail
	createdBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	reviewedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	approvedBy: {
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
cashFlowSchema.pre('save', async function () {
	this.updatedAt = Date.now();

	// Calculate totals
	this.inflows.totalInflows =
		this.inflows.donations.amount +
		this.inflows.grants.amount +
		this.inflows.investments.amount +
		this.inflows.otherIncome.amount;

	this.outflows.totalOutflows =
		this.outflows.operationalExpenses.amount +
		this.outflows.programExpenses.amount +
		this.outflows.administrativeExpenses.amount +
		this.outflows.fundraisingExpenses.amount +
		this.outflows.capitalExpenditure.amount +
		this.outflows.otherExpenses.amount;

	// Calculate net cash flow
	this.netCashFlow = this.inflows.totalInflows - this.outflows.totalOutflows;

	// Calculate closing balance
	this.closingBalance = this.openingBalance + this.netCashFlow;

	// Calculate analysis metrics
	if (this.inflows.totalInflows > 0) {
		this.analysis.cashFlowMargin =
			(this.netCashFlow / this.inflows.totalInflows) * 100;
	}

	if (this.outflows.totalOutflows > 0) {
		const avgDailyExpenses = this.outflows.totalOutflows / 30; // Assuming monthly
		this.analysis.daysCashOnHand =
			avgDailyExpenses > 0 ? this.closingBalance / avgDailyExpenses : 0;
		this.analysis.liquidityRatio =
			this.closingBalance / this.outflows.totalOutflows;
	}
});

// Indexes for better query performance
cashFlowSchema.index({ foundationId: 1, periodDate: 1 });
cashFlowSchema.index({ period: 1, status: 1 });

const CashFlow = mongoose.model('CashFlow', cashFlowSchema);

export default CashFlow;
