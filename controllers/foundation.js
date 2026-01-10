import Foundation from '../models/Foundation.js';

export const createFoundation = async (req, res) => {
	const foundation = await Foundation.create(req.body);
	res.status(201).json(foundation);
};

export const getFoundations = async (req, res) => {
	const foundations = await Foundation.find();
	res.json(foundations);
};

export const getFoundationById = async (req, res) => {
	const foundation = await Foundation.findById(req.params.id);
	if (!foundation) return res.status(404).json({ message: 'Not found' });
	res.json(foundation);
};

export const updateFoundation = async (req, res) => {
	const foundation = await Foundation.findByIdAndUpdate(
		req.params.id,
		req.body,
		{ new: true }
	);
	res.json(foundation);
};

export const deleteFoundation = async (req, res) => {
	await Foundation.findByIdAndDelete(req.params.id);
	res.json({ message: 'Foundation deleted' });
};
