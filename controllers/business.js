import Business from '../models/Business.js';
import { generateBusinessId } from '../utils/generateId.js';

export const createBusiness = async (req, res) => {
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
};
export const getBusinesses = async (req, res) => {
	try {
		const filter = {};

		// Managers can only see their Business
		if (req.user.role === 'manager' && req.user.businessId) {
			filter._id = req.user.BusinessId;
		}

		const businesses = await Business.find(filter)
			.populate('createdBy', 'username email phone')
			.populate('owner', 'username email phone')
			.populate('managers', 'username email phone')
			.sort({ createdAt: -1 });

		res.json({
			success: true,
			count: businesses.length,
			businesses,
		});
	} catch (error) {
		console.error('Get Businesses Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch Businesses',
			error: error.message,
		});
	}
};

export const getBusinessById = async (req, res) => {
	try {
		
		const business = await Business.findById(req.params.id)
			.populate('createdBy', 'username email')
			.populate('owner', 'username email')
			.populate('managers', 'username email');
		if (!business) {
			return res.status(404).json({
				success: false,
				message: 'Business not found',
			});
		}
		res.json({
			success: true,
			business,
		});
	} catch (error) {
		console.error('Get Business By ID Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch Business',
			error: error.message,
		});
	}
};

export const updateBusiness = async (req, res) => {
	try {
		console.log('Update Business Req Body:', req.body);
		const updated = await Business.findByIdAndUpdate(req.params.id, req.body, {
			new: true,
		});
		res.json({
			success: true,
			business: updated,
		});
	} catch (error) {
		console.error('Get Updating business By ID Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to update Business',
			error: error.message,
		});
	}
};

export const deleteBusiness = async (req, res) => {
	try {
		await Business.findByIdAndDelete(req.params.id);
		res.json({ success: true, message: 'Business deleted successfully' });
	} catch (error) {
		console.error('Get Business By ID Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch Business',
			error: error.message,
		});
	}
};
