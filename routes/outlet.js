import express from 'express';
import Outlet from '../models/Outlet.js';
import Transaction from '../models/Transaction.js';
import { auth, isAdmin, isManagerOrAdmin } from '../middlewares/auth.js';
import { generateOutletId } from '../utils/generateId.js';

const router = express.Router();

// Get all outlets (Admin/Manager only)
router.get('/', auth, isManagerOrAdmin, async (req, res) => {
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
});

// Create outlet (Admin only)
router.post('/', auth, isAdmin, async (req, res) => {
	try {
		const outletData = {
			...req.body,
			outletId: generateOutletId(),
			createdBy: req.user.id,
			businessId,
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
});

router.get('/:id', auth, async (req, res) => {
	try {
		const { id } = req.params;
		const outlet = await Outlet.findById(id);

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
});

export default router;
