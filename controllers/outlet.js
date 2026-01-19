import Outlet from '../models/Outlet.js';
import Transaction from '../models/Transaction.js';
import Product from '../models/Product.js';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import Business from '../models/Business.js';
import { generateOutletId } from '../utils/generateId.js';

export const createOutlet = async (req, res) => {
	try {
		const outletData = {
			...req.body,
			outletId: generateOutletId(),
			createdBy: req.user.id,
		};
		if (!req.body.businessId) {
			return res.status(400).json({
				success: false,
				message: 'Business ID is required',
			});
		}
		const business = await Business.findById(req.body.businessId);
		if (!business) {
			return res.status(404).json({
				success: false,
				message: 'Business not found',
			});
		}
		const outlet = new Outlet({
			...outletData,
			managerId: req.body.managerId || business.managerId,
		});
		await outlet.save();
		business.totalOutlets = business.totalOutlets + 1;
		await business.save();
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
			.populate('managerId', 'username email phone')
			.populate('businessId', 'name email phone')
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
		const outlet = await Outlet.findById(id)
			.populate('managerId', 'username email phone')
			.populate('businessId', 'name email phone');
		if (!outlet) {
			return res.status(404).json({
				success: false,
				message: 'Outlet not found',
			});
		}

		const outletProducts = await Product.find({ outletId: id });
		const lowStockProducts = await Product.find({
			outletId: id,
			stock: { $lte: 10 },
		});
		const totalProductWorth = await Product.aggregate([
			{
				$match: {
					outletId: id,
				},
			},
			{
				$group: {
					_id: null,
					totalWorth: {
						$sum: { $multiply: ['$price', '$stock'] },
					},
				},
			},
		]);

		const outletTransactions = await Invoice.find({
			outletId: id,
		});

		res.status(201).json({
			success: true,
			message: 'Outlet fetched successfully',
			outlet: {
				...outlet._doc,
				outletProducts,
				outletTransactions,
				lowStockProducts,
				totalProducts: outletProducts.length,
				currentProducts: totalProductWorth[0]?.totalWorth || 0,
				totalOrders: 0,
				totalSales: 0,
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
	try {
		const outlet = await Outlet.findById(req.params.id);
		if (!outlet) {
			return res.status(404).json({
				success: false,
				message: 'Outlet not found',
			});
		}
		const products = await Product.find({ outletId: req.params.id });
		if (products.length > 0) {
			return res.status(400).json({
				success: false,
				message: 'Cannot delete outlet with products',
			});
		}
		const business = await Business.findById(outlet._doc.businessId);
		business.totalOutlets = business.totalOutlets - 1;
		await business.save();
		await Outlet.findByIdAndDelete(req.params.id);
		res.json({ message: 'Outlet deleted' });
	} catch (error) {
		console.error('Delete Outlet Error:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to delete outlet',
			error: error.message,
		});
	}
};
