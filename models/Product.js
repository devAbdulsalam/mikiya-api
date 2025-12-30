import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
	{
		// Basic Information
		productId: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		title: {
			type: String,
			required: true,
			trim: true,
			maxlength: 200,
		},
		description: {
			type: String,
			required: true,
			trim: true,
			maxlength: 2000,
		},

		// Visual Content
		banner: {
			type: String,
			default: 'https://via.placeholder.com/800x600',
		},
		images: [
			{
				type: String,
			},
		],
		colors: [
			{
				type: String,
				trim: true,
			},
		],

		// Pricing & Inventory
		price: {
			type: Number,
			required: true,
			min: 0,
		},
		discount: {
			type: Number,
			default: 0,
			min: 0,
			validate: {
				validator: function (value) {
					return value <= this.price;
				},
				message: 'Discount cannot be greater than price',
			},
		},
		discountedPrice: {
			type: Number,
			default: function () {
				return this.price - this.discount;
			},
		},
		stock: {
			type: Number,
			required: true,
			min: 0,
			default: 0,
		},
		moq: {
			type: Number,
			default: 1,
			min: 1,
		},

		// Categorization
		category: {
			type: String,
			required: true,
			trim: true,
			index: true,
		},
		subcategory: {
			type: String,
			trim: true,
		},
		brand: {
			type: String,
			trim: true,
		},
		tags: [
			{
				type: String,
				trim: true,
			},
		],

		// Specifications
		features: [
			{
				type: String,
				trim: true,
			},
		],
		specifications: {
			type: Map,
			of: String,
			default: {},
		},
		dimensions: {
			length: Number,
			width: Number,
			height: Number,
			unit: {
				type: String,
				default: 'cm',
			},
		},
		weight: {
			value: Number,
			unit: {
				type: String,
				default: 'kg',
			},
		},

		// Sales & Ratings
		rating: {
			type: Number,
			default: 0,
			min: 0,
			max: 5,
		},
		sold: {
			type: Number,
			default: 0,
			min: 0,
		},
		reviews: {
			type: Number,
			default: 0,
			min: 0,
		},

		// Business Information
		businessId: {
			type: String,
			required: true,
			ref: 'Business',
		},
		outletId: {
			type: String,
			ref: 'Outlet',
		},

		// Multi-outlet Support
		outlets: [
			{
				outletId: {
					type: mongoose.Schema.Types.ObjectId,
					ref: 'Outlet',
					required: true,
				},
				stock: {
					type: Number,
					default: 0,
				},
				price: {
					type: Number,
					required: true,
				},
				discount: {
					type: Number,
					default: 0,
				},
				reorderLevel: {
					type: Number,
					default: 10,
				},
				isAvailable: {
					type: Boolean,
					default: true,
				},
				lastRestocked: Date,
			},
		],

		// Supplier Information
		supplier: {
			name: String,
			contact: String,
			email: String,
			phone: String,
		},

		// Product Variants
		variants: [
			{
				name: String,
				options: [String],
				values: [String],
			},
		],

		// Shipping Information
		shipping: {
			weight: Number,
			dimensions: String,
			shippingClass: String,
			requiresShipping: {
				type: Boolean,
				default: true,
			},
			shippingCost: Number,
		},

		// Status & Metadata
		status: {
			type: String,
			enum: ['active', 'out_of_stock', 'discontinued', 'draft'],
			default: 'active',
		},
		isFeatured: {
			type: Boolean,
			default: false,
		},
		isBestSeller: {
			type: Boolean,
			default: false,
		},
		isNewArrival: {
			type: Boolean,
			default: false,
		},
		isOnSale: {
			type: Boolean,
			default: false,
		},

		// SEO & Marketing
		metaTitle: String,
		metaDescription: String,
		slug: {
			type: String,
			unique: true,
			trim: true,
			lowercase: true,
		},
		keywords: [String],

		// Timestamps & Ownership
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		updatedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
		updatedAt: {
			type: Date,
			default: Date.now,
		},
		publishedAt: Date,
		lastSold: Date,
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

// Virtual for inStock status
productSchema.virtual('inStock').get(function () {
	return this.stock > 0;
});

// Virtual for saving percentage
productSchema.virtual('savingPercentage').get(function () {
	if (this.discount > 0 && this.price > 0) {
		return Math.round((this.discount / this.price) * 100);
	}
	return 0;
});

// Virtual for product rating breakdown
productSchema.virtual('ratingBreakdown').get(function () {
	// This would typically be populated from reviews
	return {
		5: Math.floor(this.rating * 20),
		4: Math.floor(this.rating * 15),
		3: Math.floor(this.rating * 10),
		2: Math.floor(this.rating * 5),
		1: Math.floor(this.rating * 2),
	};
});

// Pre-save middleware
productSchema.pre('save', async function () {
	// Calculate discounted price
	this.discountedPrice = this.price - this.discount;

	// Set on sale status
	this.isOnSale = this.discount > 0;

	// Set status based on stock
	if (this.stock <= 0) {
		this.status = 'out_of_stock';
	}

	// Generate slug from title
	if (this.title && !this.slug) {
		this.slug = this.title
			.toLowerCase()
			.replace(/[^\w\s]/gi, '')
			.replace(/\s+/g, '-')
			.substring(0, 100);
	}

	// Set bestseller status
	if (this.sold > 100) {
		this.isBestSeller = true;
	}

	// Set new arrival status (products less than 30 days old)
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	if (this.createdAt > thirtyDaysAgo) {
		this.isNewArrival = true;
	}
});

// Indexes for better query performance
productSchema.index({
	title: 'text',
	description: 'text',
	category: 'text',
	brand: 'text',
});
productSchema.index({ category: 1, status: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ sold: -1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ isBestSeller: 1 });
productSchema.index({ isNewArrival: 1 });
productSchema.index({ isOnSale: 1 });
productSchema.index({ createdAt: -1 });

// Static methods
productSchema.statics.findByCategory = function (category) {
	return this.find({ category, status: 'active' });
};

productSchema.statics.findFeatured = function () {
	return this.find({ isFeatured: true, status: 'active' });
};

productSchema.statics.findBestSellers = function (limit = 10) {
	return this.find({ status: 'active' }).sort({ sold: -1 }).limit(limit);
};

productSchema.statics.findNewArrivals = function (limit = 10) {
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	return this.find({
		status: 'active',
		createdAt: { $gte: thirtyDaysAgo },
	})
		.sort({ createdAt: -1 })
		.limit(limit);
};

productSchema.statics.findOnSale = function () {
	return this.find({
		isOnSale: true,
		status: 'active',
		discount: { $gt: 0 },
	});
};

// Instance methods
productSchema.methods.updateStock = async function (quantity, outletId = null) {
	if (outletId) {
		const outlet = this.outlets.find((o) => o.outletId.toString() === outletId);
		if (outlet) {
			outlet.stock += quantity;
			if (outlet.stock < 0) outlet.stock = 0;
			outlet.lastRestocked = new Date();
		}
	} else {
		this.stock += quantity;
		if (this.stock < 0) this.stock = 0;
	}

	// Update status based on stock
	if (this.stock <= 0) {
		this.status = 'out_of_stock';
	} else if (this.status === 'out_of_stock') {
		this.status = 'active';
	}

	return this.save();
};

productSchema.methods.addReview = async function (rating) {
	const totalRating = this.rating * this.reviews + rating;
	this.reviews += 1;
	this.rating = totalRating / this.reviews;
	return this.save();
};

productSchema.methods.markAsSold = async function (quantity) {
	this.sold += quantity;
	this.stock -= quantity;
	this.lastSold = new Date();

	if (this.stock < 0) this.stock = 0;
	if (this.stock <= 0) this.status = 'out_of_stock';

	// Update bestseller status
	if (this.sold > 100) {
		this.isBestSeller = true;
	}

	return this.save();
};

const Product = mongoose.model('Product', productSchema);

export default Product;
