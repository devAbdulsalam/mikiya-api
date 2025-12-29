import Outlet from '../models/Outlet.js';
import Transaction from '../models/Transaction.js';
import { generateOutletId } from '../utils/generateId.js';

export const createOutlet = async (req, res) => {
	try {
		const outletData = {
			...req.body,
			outletId: generateOutletId(),
			createdBy: req.user.id,
		};

		const outlet = new Outlet(outletData);
		await outlet.save();

		res.status(201).json({
			success: true,
			message: 'Outlet created successfully',
			outlet,
		});
	} catch (error) {
		console.error('Create Outlet Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to create outlet',
			error: error.message,
		});
	}
};
export const getOutlets = async (req, res) => {
	try {
		const filter = {};

		// Managers can only see their outlet
		if (req.user.role === 'manager' && req.user.outletId) {
			filter._id = req.user.outletId;
		}

		const outlets = await Outlet.find(filter)
			.populate('createdBy', 'username email')
			.sort({ createdAt: -1 });

		res.json({
			success: true,
			count: outlets.length,
			outlets,
		});
	} catch (error) {
		console.error('Get Outlets Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch outlets',
			error: error.message,
		});
	}
};
export const getOutletById = async (req, res) => {
	try {
		const { id } = req.params;
		const outlet = await Outlet.findById(id);
		if (!outlet) {
			return res.status(404).json({
				success: false,
				message: 'Outlet not found',
			});
		}

		const outletProducts = [];
		const outletTransactions = [];
		const lowStockProducts = [];

		res.status(201).json({
			success: true,
			message: 'Outlet fetched successfully',
			outlet: {
				...outlet._doc,
				outletProducts,
				outletTransactions,
				lowStockProducts,
			},
		});
	} catch (error) {
		console.error('Create Outlet Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch outlet',
			error: error.message,
		});
	}
};
export const updateOutlet = async (req, res) => {
	try {
		const { id } = req.params;
		const outlet = await Outlet.findById(id);
		if (!outlet) {
			return res.status(404).json({
				success: false,
				message: 'Outlet not found',
			});
		}
		const updated = await Outlet.findByIdAndUpdate(req.params.id, req.body, {
			new: true,
		});
		res.json(updated);
	} catch (error) {
		console.error('Update Outlet Error:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to update outlet',
			error: error.message,
		});
	}
};
export const deleteOutlet = async (req, res) => {
	await Outlet.findByIdAndDelete(req.params.id);
	res.json({ message: 'Outlet deleted' });
};
