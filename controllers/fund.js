import Fund from '../models/Fund.js';

export const getFunds = async (req, res) => {
	const funds = await Fund.find({ foundationId: req.query.foundationId });
	res.json(funds);
};

export const getFundSummary = async (req, res) => {
	const summary = await Fund.aggregate([
		{ $match: { foundationId: req.query.foundationId } },
		{ $group: { _id: '$currency', total: { $sum: '$amount' } } },
	]);
	res.json(summary);
};
