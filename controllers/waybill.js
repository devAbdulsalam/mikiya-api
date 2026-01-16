import Waybill from '../models/Waybill.js';

/**
 * CREATE waybill
 */
export const createWaybill = async (req, res) => {
	try {
		const waybill = await Waybill.create({
			...req.body,
			createdBy: req.user._id,
		});

		res.status(201).json({
			success: true,
			data: waybill,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			message: error.message,
		});
	}
};

/**
 * GET all waybills
 */
export const getWaybills = async (req, res) => {
	try {
		const waybills = await Waybill.find({ createdBy: req.user._id }).sort({
			createdAt: -1,
		});

		res.status(200).json({
			success: true,
			count: waybills.length,
			data: waybills,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

/**
 * GET single waybill
 */
export const getWaybillById = async (req, res) => {
	try {
		const waybill = await Waybill.findOne({
			_id: req.params.id,
			createdBy: req.user._id,
		});

		if (!waybill) {
			return res.status(404).json({
				success: false,
				message: 'Waybill not found',
			});
		}

		res.status(200).json({
			success: true,
			data: waybill,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

/**
 * UPDATE waybill
 */
export const updateWaybill = async (req, res) => {
	try {
		const waybill = await Waybill.findOneAndUpdate(
			{ _id: req.params.id, createdBy: req.user._id },
			req.body,
			{ new: true, runValidators: true }
		);

		if (!waybill) {
			return res.status(404).json({
				success: false,
				message: 'Waybill not found',
			});
		}

		res.status(200).json({
			success: true,
			data: waybill,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			message: error.message,
		});
	}
};

/**
 * DELETE waybill
 */
export const deleteWaybill = async (req, res) => {
	try {
		const waybill = await Waybill.findOneAndDelete({
			_id: req.params.id,
			createdBy: req.user._id,
		});

		if (!waybill) {
			return res.status(404).json({
				success: false,
				message: 'Waybill not found',
			});
		}

		res.status(200).json({
			success: true,
			message: 'Waybill deleted successfully',
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};
