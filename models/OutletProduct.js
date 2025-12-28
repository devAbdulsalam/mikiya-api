import mongoose from 'mongoose';

const outletProductSchema = new mongoose.Schema({
	outletId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Outlet',
		required: true,
	},
	productId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Product',
		required: true,
	},
	price: {
		type: Number,
		required: true,
		min: 0,
	},
	stock: {
		type: Number,
		required: true,
		min: 0,
	},
	reorderLevel: {
		type: Number,
		default: 5,
	},
});

outletProductSchema.index({ outletId: 1, productId: 1 }, { unique: true });

const OutletProduct = mongoose.model('OutletProduct', outletProductSchema);
export default OutletProduct;
