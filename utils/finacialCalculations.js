/**
 * Calculate financial ratios for foundation
 */
export const calculateFinancialRatios = (
	income,
	expenses,
	assets,
	liabilities
) => {
	const ratios = {};

	// Liquidity Ratios
	ratios.currentRatio = assets.current / liabilities.current;
	ratios.quickRatio = (assets.current - assets.inventory) / liabilities.current;
	ratios.cashRatio = assets.cash / liabilities.current;

	// Profitability Ratios
	ratios.netProfitMargin = (income.net / income.total) * 100;
	ratios.operatingMargin = (income.operating / income.total) * 100;
	ratios.returnOnAssets = (income.net / assets.total) * 100;
	ratios.returnOnEquity =
		(income.net / (assets.total - liabilities.total)) * 100;

	// Efficiency Ratios
	ratios.assetTurnover = income.total / assets.total;
	ratios.inventoryTurnover = expenses.costOfGoodsSold / assets.inventory;
	ratios.receivablesTurnover = income.total / assets.receivables;

	// Solvency Ratios
	ratios.debtToEquity = liabilities.total / (assets.total - liabilities.total);
	ratios.debtToAssets = liabilities.total / assets.total;
	ratios.interestCoverage = income.operating / expenses.interest;

	// Program Efficiency Ratios
	ratios.programExpenseRatio = expenses.program / expenses.total;
	ratios.fundraisingEfficiency = expenses.fundraising / income.donations;
	ratios.administrativeRatio = expenses.administrative / expenses.total;

	return ratios;
};

/**
 * Calculate cash flow metrics
 */
export const calculateCashFlowMetrics = (cashFlows) => {
	const metrics = {};

	// Operating Cash Flow
	metrics.operatingCashFlow = cashFlows.operating;

	// Free Cash Flow
	metrics.freeCashFlow = cashFlows.operating - cashFlows.capitalExpenditures;

	// Cash Flow Margin
	metrics.cashFlowMargin = (cashFlows.operating / cashFlows.revenue) * 100;

	// Days Sales Outstanding (DSO)
	metrics.daysSalesOutstanding =
		(cashFlows.receivables / cashFlows.revenue) * 365;

	// Days Payable Outstanding (DPO)
	metrics.daysPayableOutstanding =
		(cashFlows.payables / cashFlows.expenses) * 365;

	// Cash Conversion Cycle
	metrics.cashConversionCycle =
		metrics.daysSalesOutstanding +
		(cashFlows.inventory / cashFlows.costOfGoodsSold) * 365 -
		metrics.daysPayableOutstanding;

	return metrics;
};

/**
 * Calculate budget variance
 */
export const calculateBudgetVariance = (actual, budget) => {
	const variance = {};

	variance.amount = actual - budget;
	variance.percentage = budget !== 0 ? (variance.amount / budget) * 100 : 0;

	if (variance.percentage > 10) {
		variance.status = 'over_budget';
	} else if (variance.percentage < -10) {
		variance.status = 'under_budget';
	} else {
		variance.status = 'on_budget';
	}

	return variance;
};

/**
 * Calculate fundraising metrics
 */
export const calculateFundraisingMetrics = (donations, expenses, donors) => {
	const metrics = {};

	// Average donation size
	metrics.averageDonation = donations.total / donations.count;

	// Donor retention rate
	metrics.donorRetentionRate = (donors.retained / donors.total) * 100;

	// Cost per dollar raised
	metrics.costPerDollarRaised = expenses.fundraising / donations.total;

	// Return on fundraising investment
	metrics.roi = (donations.total - expenses.fundraising) / expenses.fundraising;

	// Donor lifetime value
	metrics.donorLifetimeValue =
		metrics.averageDonation * donors.averageDonations * donors.averageLifespan;

	return metrics;
};

/**
 * Calculate impact metrics
 */
export const calculateImpactMetrics = (beneficiaries, projects, outcomes) => {
	const metrics = {};

	// Beneficiary metrics
	metrics.beneficiariesPerProject = beneficiaries.total / projects.total;
	metrics.costPerBeneficiary = projects.totalCost / beneficiaries.total;
	metrics.beneficiarySatisfaction = outcomes.satisfaction;

	// Project metrics
	metrics.projectSuccessRate = (projects.completed / projects.total) * 100;
	metrics.averageProjectDuration = projects.totalDuration / projects.total;
	metrics.costEffectiveness = outcomes.total / projects.totalCost;

	// Outcome metrics
	metrics.outcomeAchievementRate = (outcomes.achieved / outcomes.planned) * 100;
	metrics.socialReturnOnInvestment = outcomes.socialValue / projects.totalCost;
	metrics.sustainabilityIndex = outcomes.sustainable / outcomes.total;

	return metrics;
};

/**
 * Generate financial forecast
 */
export const generateFinancialForecast = (
	historicalData,
	growthRate,
	periods = 12
) => {
	const forecast = [];
	const lastData = historicalData[historicalData.length - 1];

	for (let i = 1; i <= periods; i++) {
		const monthForecast = {
			period: i,
			date: new Date(
				lastData.date.getFullYear(),
				lastData.date.getMonth() + i,
				1
			),
			donations: lastData.donations * Math.pow(1 + growthRate.donations, i),
			grants: lastData.grants * Math.pow(1 + growthRate.grants, i),
			expenses: lastData.expenses * Math.pow(1 + growthRate.expenses, i),
			cashBalance: 0,
		};

		// Calculate cumulative cash balance
		const previousBalance =
			i === 1 ? lastData.cashBalance : forecast[i - 2].cashBalance;
		monthForecast.cashBalance =
			previousBalance +
			(monthForecast.donations + monthForecast.grants) -
			monthForecast.expenses;

		forecast.push(monthForecast);
	}

	return forecast;
};

/**
 * Calculate break-even point
 */
export const calculateBreakEvenPoint = (fixedCosts, variableCosts, revenue) => {
	const contributionMargin = revenue - variableCosts;
	const breakEvenUnits = fixedCosts / contributionMargin;
	const breakEvenRevenue = breakEvenUnits * revenue;

	return {
		units: breakEvenUnits,
		revenue: breakEvenRevenue,
		marginOfSafety:
			revenue > 0 ? ((revenue - breakEvenRevenue) / revenue) * 100 : 0,
	};
};

export default {
	calculateFinancialRatios,
	calculateCashFlowMetrics,
	calculateBudgetVariance,
	calculateFundraisingMetrics,
	calculateImpactMetrics,
	generateFinancialForecast,
	calculateBreakEvenPoint,
};
