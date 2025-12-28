import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
	{
		customer: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Customer',
			required: true,
		},
		outlet: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Outlet',
			required: true,
		},
		items: [
			{
				product: {
					type: mongoose.Schema.Types.ObjectId,
					ref: 'Product',
				},
				qty: Number,
				pricePerUnit: Number,
				totalPrice: Number,
			},
		],
		totalAmount: {
			type: Number,
			required: true,
			min: 0,
		},
		status: {
			type: String,
			enum: ['pending', 'confirmed', 'shipped', 'delivered'],
			default: 'pending',
		},
		description: String, // Reason for the order

		paymentStatus: {
			type: String,
			enum: ['paid', 'partial', 'unpaid'],
			default: 'unpaid',
		},

		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
		updatedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: true }
);

const Order = mongoose.model('Order', orderSchema);
export default Order;
