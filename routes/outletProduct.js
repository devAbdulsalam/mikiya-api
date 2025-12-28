import express from 'express';
import OutletProduct from '../models/OutletProduct.js';
import {auth} from '../middlewares/auth.js';
const router = express.Router();

// Get all products for a specific outlet
router.get('/:outletId', auth, async (req, res) => {
	try {
		const outletProducts = await OutletProduct.find({
			outletId: req.params.outletId,
		}).populate('productId');
		res.json(outletProducts);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// Add a product to an outlet (or update if exists)
router.post('/:outletId', auth, async (req, res) => {
	try {
		const { productId, price, stock, reorderLevel } = req.body;
		let outletProduct = await OutletProduct.findOne({
			outletId: req.params.outletId,
			productId,
		});
		if (outletProduct) {
			// Update existing
			outletProduct.price = price;
			outletProduct.stock = stock;
			outletProduct.reorderLevel = reorderLevel;
		} else {
			// Create new
			outletProduct = new OutletProduct({
				outletId: req.params.outletId,
				productId,
				price,
				stock,
				reorderLevel,
			});
		}
		await outletProduct.save();
		res.status(201).json(outletProduct);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
});

// ... other routes for updating and deleting outlet products

export default router;
