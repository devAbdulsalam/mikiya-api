import Grant from '../models/grants.js';

export const createGrant = async (req, res) => {
	const grant = await Grant.create(req.body);
	res.status(201).json(grant);
};

export const getGrants = async (req, res) => {
	const grants = await Grant.find({ foundationId: req.query.foundationId });
	res.json(grants);
};

export const updateGrant = async (req, res) => {
	const grant = await Grant.findByIdAndUpdate(req.params.id, req.body, {
		new: true,
	});
	res.json(grant);
};

export const deleteGrant = async (req, res) => {
	await Grant.findByIdAndDelete(req.params.id);
	res.json({ message: 'Grant deleted' });
};
