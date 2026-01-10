import Beneficiary from '../models/Beneficiary.js';

export const createBeneficiary = async (req, res) => {
	const beneficiary = await Beneficiary.create(req.body);
	res.status(201).json(beneficiary);
};

export const getBeneficiaries = async (req, res) => {
	const beneficiaries = await Beneficiary.find({
		foundationId: req.query.foundationId,
	});
	res.json(beneficiaries);
};

export const deleteBeneficiary = async (req, res) => {
	await Beneficiary.findByIdAndDelete(req.params.id);
	res.json({ message: 'Beneficiary removed' });
};
