import express from 'express';
import Business from '../models/Business.js';
import { auth, isAdmin, isManagerOrAdmin } from '../middlewares/auth.js';
import { generateBusinessId } from '../utils/generateId.js';

const router = express.Router();

// Get all Businesss (Admin/Manager only)
router.get('/', auth, isManagerOrAdmin, async (req, res) => {
	try {
		const filter = {};

		// Managers can only see their Business
		if (req.user.role === 'manager' && req.user.businessId) {
			filter._id = req.user.BusinessId;
		}

		const busineses = await Business.find(filter)
			.populate('createdBy', 'username email')
			.sort({ createdAt: -1 });

		res.json({
			success: true,
			count: busineses.length,
			busineses,
		});
	} catch (error) {
		console.error('Get Businesses Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch Businesses',
			error: error.message,
		});
	}
});

// Create Business (Admin only)
router.post('/', auth, isAdmin, async (req, res) => {
	try {
		const businessData = {
			...req.body,
			businessId: generateBusinessId(),
			createdBy: req.user.id,
			userId: req.user.userId,
		};

		const business = new Business(businessData);
		await business.save();

		res.status(201).json({
			success: true,
			message: 'Business created successfully',
			business,
		});
	} catch (error) {
		console.error('Create business Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to create business',
			error: error.message,
		});
	}
});

// ... other Business routes

export default router;
