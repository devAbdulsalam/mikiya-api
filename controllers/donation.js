import Donation from '../models/Donation.js';
import Fund from '../models/Fund.js';

export const createDonation = async (req, res) => {
	const donation = await Donation.create(req.body);

	// auto-credit fund
	await Fund.create({
		foundationId: donation.foundationId,
		sourceType: 'donation',
		sourceId: donation._id,
		amount: donation.amount,
	});

	res.status(201).json(donation);
};

export const getDonations = async (req, res) => {
	const donations = await Donation.find({
		foundationId: req.query.foundationId,
	});
	res.json(donations);
};

export const deleteDonation = async (req, res) => {
	await Donation.findByIdAndDelete(req.params.id);
	res.json({ message: 'Donation removed' });
};
