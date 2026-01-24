import Quotation from '../models/Quotation.js';
import Customer from '../models/Customer.js';

/**
 * CREATE quotation
 */
export const createQuotation = async (req, res) => {
	try {
		const { clientDetails, ...quotationData } = req.body;

		if (!clientDetails) {
			return res.status(400).json({
				success: false,
				message: 'Client details are required',
			});
		}

		// Find or create customer
		const customer = clientDetails._id
			? await Customer.findById(clientDetails._id)
			: await Customer.create(clientDetails);

		if (!customer) {
			return res.status(404).json({
				success: false,
				message: 'Customer not found',
			});
		}

		const quotation = await Quotation.create({
			...quotationData,
			createdBy: req.user._id,
			clientDetails: {
				...clientDetails,
				_id: customer._id,
			},
		});

		return res.status(201).json({
			success: true,
			data: quotation,
		});
	} catch (error) {
		console.error(error);

		return res.status(500).json({
			success: false,
			message: error.message || 'Failed to create quotation',
		});
	}
};


/**
 * GET all quotations
 */
export const getQuotations = async (req, res) => {
	try {
		const quotations = await Quotation.find({ createdBy: req.user._id }).sort({
			createdAt: -1,
		});

		res.status(200).json({
			success: true,
			count: quotations.length,
			data: quotations,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

/**
 * GET single quotation
 */
export const getQuotationById = async (req, res) => {
	try {
		const quotation = await Quotation.findOne({
			_id: req.params.id,
			createdBy: req.user._id,
		});

		if (!quotation) {
			return res.status(404).json({
				success: false,
				message: 'Quotation not found',
			});
		}

		res.status(200).json({
			success: true,
			data: quotation,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

/**
 * UPDATE quotation
 */
export const updateQuotation = async (req, res) => {
	try {
		const { clientDetails, ...quotationData } = req.body;

		if (!clientDetails) {
			return res.status(400).json({
				success: false,
				message: 'Client details are required',
			});
		}

		// Find or create customer
		const customer = clientDetails._id
			? await Customer.findById(clientDetails._id)
			: await Customer.create(clientDetails);

		if (!customer) {
			return res.status(404).json({
				success: false,
				message: 'Customer not found',
			});
		}
		const quotation = await Quotation.findOneAndUpdate(
			{ _id: req.params.id, createdBy: req.user._id },
			{
				...quotationData,
				clientDetails: {
					...clientDetails,
					_id: customer._id,
				}},
			{ new: true, runValidators: true },
		);

		if (!quotation) {
			return res.status(404).json({
				success: false,
				message: 'Quotation not found',
			});
		}

		res.status(200).json({
			success: true,
			data: quotation,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			message: error.message,
		});
	}
};

/**
 * DELETE quotation
 */
export const deleteQuotation = async (req, res) => {
	try {
		const quotation = await Quotation.findOneAndDelete({
			_id: req.params.id,
			createdBy: req.user._id,
		});

		if (!quotation) {
			return res.status(404).json({
				success: false,
				message: 'Quotation not found',
			});
		}

		res.status(200).json({
			success: true,
			message: 'Quotation deleted successfully',
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};
