import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Outlet from '../models/Outlet.js';
import { generateProductId, generateSku } from '../utils/generateId.js';
import cloudinary, {
	getPublicIdFromUrl,
	deleteImage,
} from '../config/cloudinary.js';
import { formatCurrency } from '../utils/helpers.js';

import { uploadAndExtractImageUrls } from '../utils/uploadAndExtractImageUrls.js';

export const createProduct = async (req, res) => {
	try {
		const productData = { ...req.body };
		// Extract image URLs
		const uploads = await uploadAndExtractImageUrls(req.files);

		if (uploads.images.length > 0) {
			productData.images = uploads.images;
		}
		if (uploads.banner) {
			productData.banner = uploads.banner;
		}

		let { businessId, outletId } = productData;

		// 1️⃣ If businessId is not provided, outletId must be provided
		if (!businessId && !outletId) {
			return res.status(400).json({
				success: false,
				message: 'Either businessId or outletId is required',
			});
		}

		let outlet = null;

		// 2️⃣ If outletId exists, fetch outlet and validate existence
		if (outletId) {
			outlet = await Outlet.findOne({ outletId });

			if (!outlet) {
				return res.status(404).json({
					success: false,
					message: 'Outlet not found',
				});
			}

			// 3️⃣ If businessId was NOT provided, extract it from outlet
			if (!businessId) businessId = outlet.businessId.toString();

			// 4️⃣ If BOTH were provided, validate the outlet belongs to that business
			if (
				businessId &&
				businessId.toString() !== outlet.businessId.toString()
			) {
				return res.status(400).json({
					success: false,
					message: 'Provided outlet does not belong to the given businessId',
				});
			}
		}

		// Generate product ID and SKU
		const productId = generateProductId();
		const sku = generateSku(productData.category, productData.brand);

		// Prepare product data
		const newProductData = {
			businessId,
			outletId: outlet ? outlet._id : null,
			productId,
			sku,
			title: productData.title,
			description: productData.description,
			banner: productData.banner || 'https://via.placeholder.com/800x600',
			images: productData.images || ['https://via.placeholder.com/800x600'],
			colors: productData.colors || [],
			price: parseFloat(productData.price),
			discount: parseFloat(productData.discount) || 0,
			stock: parseInt(productData.stock) || 0,
			moq: parseInt(productData.moq) || 1,
			category: productData.category,
			brand: productData.brand || '',
			tags: productData.tags || [],
			features: productData.features || [],
			specifications: productData.specifications || {},
			rating: parseFloat(productData.rating) || 0,
			sold: parseInt(productData.sold) || 0,
			reviews: parseInt(productData.reviews) || 0,
			outlets: [
				{
					outletId: outlet._id,
					stock: parseInt(productData.stock) || 0,
					price: parseFloat(productData.price),
					discount: parseFloat(productData.discount) || 0,
					isAvailable: true,
				},
			],
			supplier: productData.supplier || {
				name: '',
				contact: '',
				email: '',
				phone: '',
			},
			variants: productData.variants || [],
			shipping: productData.shipping || {
				requiresShipping: true,
				shippingCost: 0,
			},
			status: parseInt(productData.stock) > 0 ? 'active' : 'out_of_stock',
			isFeatured: productData.isFeatured === 'true',
			isBestSeller: parseInt(productData.sold) > 100,
			metaTitle: productData.metaTitle || productData.title,
			metaDescription:
				productData.metaDescription ||
				productData.description.substring(0, 160),
			createdBy: req.user.id,
			updatedBy: req.user.id,
		};

		// Create the product
		const product = new Product(newProductData);
		await product.save();

		// Populate the response
		const populatedProduct = await Product.findById(product._id)
			.populate('outletId', 'name outletId type')
			.populate(
				'createdBy',
				'username email profile.firstName profile.lastName'
			);

		res.status(201).json({
			success: true,
			message: 'Product created successfully',
			product: populatedProduct,
		});
	} catch (error) {
		console.error('Create Product Error:', error);

		// Clean up uploaded files if there was an error
		if (req.files) {
			try {
				const files = req.files;
				if (files.banner?.[0]?.path) {
					const publicId = getPublicIdFromUrl(files.banner[0].path);
					if (publicId) await deleteImage(publicId);
				}
				if (files.images) {
					for (const file of files.images) {
						const publicId = getPublicIdFromUrl(file.path);
						if (publicId) await deleteImage(publicId);
					}
				}
			} catch (cleanupError) {
				console.error('Error cleaning up uploaded files:', cleanupError);
			}
		}

		// Handle duplicate key error
		if (error.code === 11000) {
			return res.status(400).json({
				success: false,
				message: 'Product ID or SKU already exists',
				error: error.keyValue,
			});
		}

		// Handle validation errors
		if (error.name === 'ValidationError') {
			const errors = Object.values(error.errors).map((err) => ({
				field: err.path,
				message: err.message,
			}));

			return res.status(400).json({
				success: false,
				message: 'Validation failed',
				errors,
			});
		}

		res.status(500).json({
			success: false,
			message: 'Failed to create product',
			error: error.message,
		});
	}
};

export const updateProduct = async (req, res) => {
	try {
		const { id } = req.params;
		const updateData = { ...req.body };
		const files = req.files || {};

		// Find the product
		let product;
		if (mongoose.Types.ObjectId.isValid(id)) {
			product = await Product.findById(id);
		} else {
			product = await Product.findOne({ productId: id });
		}

		if (!product) {
			return res.status(404).json({
				success: false,
				message: 'Product not found',
			});
		}

		// Check if user has permission to update this product
		if (
			req.user.role !== 'admin' &&
			product.createdBy.toString() !== req.user.id
		) {
			return res.status(403).json({
				success: false,
				message: 'You do not have permission to update this product',
			});
		}

		// Extract image URLs from request
		const newImages = extractImageUrls(req);

		// Handle banner update
		if (files.banner?.[0]) {
			updateData.banner = files.banner[0].path;
		} else if (req.body.banner) {
			updateData.banner = req.body.banner;
		}

		// Handle gallery images update
		if (files.images || req.body.images) {
			const galleryImages = [];

			// Add new uploaded images
			if (files.images) {
				files.images.forEach((file) => {
					galleryImages.push(file.path);
				});
			}

			// Add existing images from request body
			if (req.body.images && Array.isArray(req.body.images)) {
				galleryImages.push(...req.body.images);
			}

			updateData.images = galleryImages;
		}

		// Handle stock update
		if (updateData.stock !== undefined) {
			// If stock is being set to 0, update status
			if (updateData.stock <= 0) {
				updateData.status = 'out_of_stock';
			} else if (product.status === 'out_of_stock') {
				updateData.status = 'active';
			}
		}

		// Handle discount update
		if (updateData.discount !== undefined || updateData.price !== undefined) {
			const price =
				updateData.price !== undefined ? updateData.price : product.price;
			const discount =
				updateData.discount !== undefined
					? updateData.discount
					: product.discount;

			if (discount > 0) {
				updateData.isOnSale = true;
			} else {
				updateData.isOnSale = false;
			}

			// Calculate discounted price
			updateData.discountedPrice = price - discount;
		}

		// Update outlet information if provided
		if (updateData.outlet) {
			const outlet = await Outlet.findOne({ outletId: updateData.outlet });
			if (outlet) {
				updateData.outletId = outlet._id;

				// Update or add to outlets array
				const outletIndex = product.outlets.findIndex(
					(o) => o.outletId.toString() === outlet._id.toString()
				);

				if (outletIndex > -1) {
					// Update existing outlet
					if (updateData.price !== undefined) {
						product.outlets[outletIndex].price = updateData.price;
					}
					if (updateData.stock !== undefined) {
						product.outlets[outletIndex].stock = updateData.stock;
					}
					if (updateData.discount !== undefined) {
						product.outlets[outletIndex].discount = updateData.discount;
					}
					updateData.outlets = product.outlets;
				} else {
					// Add new outlet
					product.outlets.push({
						outletId: outlet._id,
						outletName: outlet.name,
						stock: updateData.stock || 0,
						price: updateData.price || product.price,
						discount: updateData.discount || product.discount,
						isAvailable: true,
					});
					updateData.outlets = product.outlets;
				}
			}
		}

		// Set updatedBy
		updateData.updatedBy = req.user.id;
		updateData.updatedAt = new Date();

		// Check for bestseller update
		if (updateData.sold !== undefined && updateData.sold > 100) {
			updateData.isBestSeller = true;
		}

		// Delete old images if they're being replaced
		const oldBanner = product.banner;
		const oldImages = product.images;

		// Update the product
		const updatedProduct = await Product.findByIdAndUpdate(
			product._id,
			{ $set: updateData },
			{ new: true, runValidators: true }
		)
			.populate('outletId', 'name outletId type')
			.populate('updatedBy', 'username email');

		// Delete old images from Cloudinary after successful update
		if (updatedProduct) {
			await deleteOldImages(
				product,
				updatedProduct.banner,
				updatedProduct.images
			);
		}

		res.json({
			success: true,
			message: 'Product updated successfully',
			product: updatedProduct,
		});
	} catch (error) {
		console.error('Update Product Error:', error);

		// Clean up uploaded files if there was an error
		if (req.files) {
			try {
				const files = req.files;
				if (files.banner?.[0]?.path) {
					const publicId = getPublicIdFromUrl(files.banner[0].path);
					if (publicId) await deleteImage(publicId);
				}
				if (files.images) {
					for (const file of files.images) {
						const publicId = getPublicIdFromUrl(file.path);
						if (publicId) await deleteImage(publicId);
					}
				}
			} catch (cleanupError) {
				console.error('Error cleaning up uploaded files:', cleanupError);
			}
		}

		// Handle duplicate key error
		if (error.code === 11000) {
			return res.status(400).json({
				success: false,
				message: 'Product ID already exists',
				error: error.keyValue,
			});
		}

		// Handle validation errors
		if (error.name === 'ValidationError') {
			const errors = Object.values(error.errors).map((err) => ({
				field: err.path,
				message: err.message,
			}));

			return res.status(400).json({
				success: false,
				message: 'Validation failed',
				errors,
			});
		}

		res.status(500).json({
			success: false,
			message: 'Failed to update product',
			error: error.message,
		});
	}
};

export const getAllProducts = async (req, res) => {
	try {
		const {
			category,
			outlet,
			minPrice,
			maxPrice,
			inStock,
			featured,
			bestSeller,
			newArrival,
			onSale,
			search,
			page = 1,
			limit = 20,
			sortBy = 'createdAt',
			order = 'desc',
		} = req.query;

		const filter = {};
		const pageNum = parseInt(page);
		const limitNum = parseInt(limit);
		const skip = (pageNum - 1) * limitNum;
		const sortOrder = order === 'asc' ? 1 : -1;

		// Category filter
		if (category) {
			filter.category = category;
		}

		// Outlet filter
		if (outlet) {
			filter.outlet = outlet;
		}

		// Price range filter
		if (minPrice || maxPrice) {
			filter.price = {};
			if (minPrice) filter.price.$gte = parseFloat(minPrice);
			if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
		}

		// Stock filter
		if (inStock === 'true') {
			filter.stock = { $gt: 0 };
			filter.status = 'active';
		} else if (inStock === 'false') {
			filter.stock = 0;
			filter.status = 'out_of_stock';
		}

		// Featured products
		if (featured === 'true') {
			filter.isFeatured = true;
		}

		// Best sellers
		if (bestSeller === 'true') {
			filter.isBestSeller = true;
		}

		// New arrivals
		if (newArrival === 'true') {
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
			filter.createdAt = { $gte: thirtyDaysAgo };
		}

		// On sale products
		if (onSale === 'true') {
			filter.isOnSale = true;
			filter.discount = { $gt: 0 };
		}

		// Search functionality
		if (search) {
			filter.$or = [
				{ title: { $regex: search, $options: 'i' } },
				{ description: { $regex: search, $options: 'i' } },
				{ category: { $regex: search, $options: 'i' } },
				{ brand: { $regex: search, $options: 'i' } },
				{ tags: { $regex: search, $options: 'i' } },
			];
		}

		// Status filter (default to active)
		if (!filter.status) {
			filter.status = 'active';
		}

		// Get total count
		const total = await Product.countDocuments(filter);

		// Get products with pagination and sorting
		const products = await Product.find(filter)
			.populate('outletId', 'name outletId type')
			.populate(
				'createdBy',
				'username email profile.firstName profile.lastName'
			)
			.sort({ [sortBy]: sortOrder })
			.skip(skip)
			.limit(limitNum);

		// Calculate pagination info
		const totalPages = Math.ceil(total / limitNum);
		const hasNextPage = pageNum < totalPages;
		const hasPrevPage = pageNum > 1;

		// Format response
		const formattedProducts = products.map((product) => ({
			id: product._id,
			productId: product.productId,
			title: product.title,
			description: product.description,
			banner: product.banner,
			images: product.images,
			colors: product.colors,
			price: product.price,
			discount: product.discount,
			discountedPrice: product.discountedPrice,
			stock: product.stock,
			moq: product.moq,
			category: product.category,
			brand: product.brand,
			features: product.features,
			rating: product.rating,
			sold: product.sold,
			reviews: product.reviews,
			outlet: product.outlet,
			outletDetails: product.outletId,
			status: product.status,
			isFeatured: product.isFeatured,
			isBestSeller: product.isBestSeller,
			isNewArrival: product.isNewArrival,
			isOnSale: product.isOnSale,
			inStock: product.inStock,
			savingPercentage: product.savingPercentage,
			createdAt: product.createdAt,
			updatedAt: product.updatedAt,
		}));

		res.json({
			success: true,
			count: products.length,
			total,
			pagination: {
				currentPage: pageNum,
				totalPages,
				hasNextPage,
				hasPrevPage,
				nextPage: hasNextPage ? pageNum + 1 : null,
				prevPage: hasPrevPage ? pageNum - 1 : null,
				limit: limitNum,
			},
			filters: {
				category,
				outlet,
				minPrice,
				maxPrice,
				inStock,
				featured,
				bestSeller,
				newArrival,
				onSale,
				search,
			},
			products: formattedProducts,
		});
	} catch (error) {
		console.error('Get Products Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch products',
			error: error.message,
		});
	}
};

export const getProductById = async (req, res) => {
	try {
		const { id } = req.params;

		// Check if ID is valid MongoDB ObjectId or productId
		let product;
		if (mongoose.Types.ObjectId.isValid(id)) {
			product = await Product.findById(id)
				.populate('outletId', 'name outletId type address contact')
				.populate(
					'createdBy',
					'username email profile.firstName profile.lastName'
				)
				.populate('updatedBy', 'username email');
		} else {
			// Try to find by productId
			product = await Product.findOne({ productId: id })
				.populate('outletId', 'name outletId type address contact')
				.populate(
					'createdBy',
					'username email profile.firstName profile.lastName'
				)
				.populate('updatedBy', 'username email');
		}

		if (!product) {
			return res.status(404).json({
				success: false,
				message: 'Product not found',
			});
		}

		// Get related products
		const relatedProducts = await Product.find({
			category: product.category,
			_id: { $ne: product._id },
			status: 'active',
		})
			.limit(4)
			.select('title price discount banner images rating sold');

		// Format product details
		const productDetails = {
			id: product._id,
			productId: product.productId,
			title: product.title,
			description: product.description,
			banner: product.banner,
			images: product.images,
			colors: product.colors,
			price: product.price,
			discount: product.discount,
			discountedPrice: product.discountedPrice,
			stock: product.stock,
			moq: product.moq,
			category: product.category,
			subcategory: product.subcategory,
			brand: product.brand,
			tags: product.tags,
			features: product.features,
			specifications: product.specifications,
			dimensions: product.dimensions,
			weight: product.weight,
			rating: product.rating,
			sold: product.sold,
			reviews: product.reviews,
			outlet: product.outlet,
			outletDetails: product.outletId,
			outlets: product.outlets,
			supplier: product.supplier,
			variants: product.variants,
			shipping: product.shipping,
			status: product.status,
			isFeatured: product.isFeatured,
			isBestSeller: product.isBestSeller,
			isNewArrival: product.isNewArrival,
			isOnSale: product.isOnSale,
			inStock: product.inStock,
			savingPercentage: product.savingPercentage,
			metaTitle: product.metaTitle,
			metaDescription: product.metaDescription,
			slug: product.slug,
			keywords: product.keywords,
			createdBy: product.createdBy,
			updatedBy: product.updatedBy,
			createdAt: product.createdAt,
			updatedAt: product.updatedAt,
			publishedAt: product.publishedAt,
			lastSold: product.lastSold,
		};

		res.json({
			success: true,
			product: productDetails,
			relatedProducts,
		});
	} catch (error) {
		console.error('Get Product Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch product',
			error: error.message,
		});
	}
};

export const deleteProduct = async (req, res) => {
	try {
		const { id } = req.params;

		// Find the product
		let product;
		if (mongoose.Types.ObjectId.isValid(id)) {
			product = await Product.findById(id);
		} else {
			product = await Product.findOne({ productId: id });
		}

		if (!product) {
			return res.status(404).json({
				success: false,
				message: 'Product not found',
			});
		}

		// Delete images from Cloudinary
		try {
			// Delete banner
			if (product.banner) {
				const bannerPublicId = getPublicIdFromUrl(product.banner);
				if (bannerPublicId && !bannerPublicId.startsWith('http')) {
					await deleteImage(bannerPublicId);
				}
			}

			// Delete gallery images
			for (const imageUrl of product.images) {
				const publicId = getPublicIdFromUrl(imageUrl);
				if (publicId && !publicId.startsWith('http')) {
					await deleteImage(publicId);
				}
			}
		} catch (imageError) {
			console.error('Error deleting images from Cloudinary:', imageError);
			// Continue with product deletion even if image deletion fails
		}

		// Delete the product
		await Product.findByIdAndDelete(product._id);

		res.json({
			success: true,
			message: 'Product deleted successfully',
			productId: product.productId,
			title: product.title,
		});
	} catch (error) {
		console.error('Delete Product Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to delete product',
			error: error.message,
		});
	}
};

export const addProductImages = async (req, res) => {
	try {
		const { id } = req.params;

		// Find the product
		const product = await Product.findById(id);
		if (!product) {
			return res.status(404).json({
				success: false,
				message: 'Product not found',
			});
		}

		// Check permission
		if (
			req.user.role !== 'admin' &&
			product.createdBy.toString() !== req.user.id
		) {
			return res.status(403).json({
				success: false,
				message: 'You do not have permission to update this product',
			});
		}

		// Add new images
		const newImages = req.files?.map((file) => file.path) || [];
		product.images.push(...newImages);

		// Update product
		product.updatedBy = req.user.id;
		product.updatedAt = new Date();
		await product.save();

		res.json({
			success: true,
			message: 'Images added successfully',
			addedImages: newImages,
			totalImages: product.images.length,
		});
	} catch (error) {
		console.error('Add Images Error:', error);

		// Clean up uploaded files
		if (req.files) {
			try {
				for (const file of req.files) {
					const publicId = getPublicIdFromUrl(file.path);
					if (publicId) await deleteImage(publicId);
				}
			} catch (cleanupError) {
				console.error('Error cleaning up uploaded files:', cleanupError);
			}
		}

		res.status(500).json({
			success: false,
			message: 'Failed to add images',
			error: error.message,
		});
	}
};

export const deleteProductImage = async (req, res) => {
	try {
		const { id } = req.params;
		const { imageUrl } = req.body;

		if (!imageUrl) {
			return res.status(400).json({
				success: false,
				message: 'Image URL is required',
			});
		}

		// Find the product
		const product = await Product.findById(id);
		if (!product) {
			return res.status(404).json({
				success: false,
				message: 'Product not found',
			});
		}

		// Check permission
		if (
			req.user.role !== 'admin' &&
			product.createdBy.toString() !== req.user.id
		) {
			return res.status(403).json({
				success: false,
				message: 'You do not have permission to update this product',
			});
		}

		// Find image index
		const imageIndex = product.images.indexOf(imageUrl);
		if (imageIndex === -1) {
			return res.status(404).json({
				success: false,
				message: 'Image not found in product',
			});
		}

		// Remove image from array
		const removedImage = product.images.splice(imageIndex, 1)[0];

		// Delete image from Cloudinary if it's a Cloudinary image
		const publicId = getPublicIdFromUrl(removedImage);
		if (publicId && !publicId.startsWith('http')) {
			await deleteImage(publicId);
		}

		// Update product
		product.updatedBy = req.user.id;
		product.updatedAt = new Date();
		await product.save();

		res.json({
			success: true,
			message: 'Image removed successfully',
			removedImage,
			remainingImages: product.images,
		});
	} catch (error) {
		console.error('Remove Image Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to remove image',
			error: error.message,
		});
	}
};

export const getAllCatergories = async (req, res) => {
	try {
		const categories = await Product.distinct('category', { status: 'active' });

		// Get count for each category
		const categoriesWithCount = await Promise.all(
			categories.map(async (category) => {
				const count = await Product.countDocuments({
					category,
					status: 'active',
				});
				return {
					name: category,
					count,
					slug: category.toLowerCase().replace(/\s+/g, '-'),
				};
			})
		);

		res.json({
			success: true,
			categories: categoriesWithCount.sort((a, b) =>
				a.name.localeCompare(b.name)
			),
		});
	} catch (error) {
		console.error('Get Categories Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch categories',
			error: error.message,
		});
	}
};

export const getAllFeaturedProducts = async (req, res) => {
	try {
		const { limit = 10 } = req.query;
		const featuredProducts = await Product.find({
			isFeatured: true,
			status: 'active',
		})
			.limit(parseInt(limit))
			.populate('outletId', 'name outletId')
			.select('title price discount banner images rating sold stock');

		res.json({
			success: true,
			count: featuredProducts.length,
			products: featuredProducts,
		});
	} catch (error) {
		console.error('Get Featured Products Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch featured products',
			error: error.message,
		});
	}
};

export const getBestSellers = async (req, res) => {
	try {
		const { limit = 10 } = req.query;
		const bestsellers = await Product.find({
			status: 'active',
			sold: { $gt: 0 },
		})
			.sort({ sold: -1 })
			.limit(parseInt(limit))
			.populate('outletId', 'name outletId')
			.select(
				'title price discount banner images rating sold stock isBestSeller'
			);

		res.json({
			success: true,
			count: bestsellers.length,
			products: bestsellers,
		});
	} catch (error) {
		console.error('Get Bestsellers Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch bestsellers',
			error: error.message,
		});
	}
};

export const getNewArrivals = async (req, res) => {
	try {
		const { limit = 10 } = req.query;
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const newArrivals = await Product.find({
			status: 'active',
			createdAt: { $gte: thirtyDaysAgo },
		})
			.sort({ createdAt: -1 })
			.limit(parseInt(limit))
			.populate('outletId', 'name outletId')
			.select(
				'title price discount banner images rating sold stock isNewArrival'
			);

		res.json({
			success: true,
			count: newArrivals.length,
			products: newArrivals,
		});
	} catch (error) {
		console.error('Get New Arrivals Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch new arrivals',
			error: error.message,
		});
	}
};

export const getAllOnSaleProducts = async (req, res) => {
	try {
		const { limit = 10 } = req.query;
		const onSaleProducts = await Product.find({
			status: 'active',
			discount: { $gt: 0 },
			isOnSale: true,
		})
			.sort({ discount: -1 })
			.limit(parseInt(limit))
			.populate('outletId', 'name outletId')
			.select(
				'title price discount discountedPrice banner images rating sold stock savingPercentage'
			);

		res.json({
			success: true,
			count: onSaleProducts.length,
			products: onSaleProducts,
		});
	} catch (error) {
		console.error('Get On Sale Products Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch products on sale',
			error: error.message,
		});
	}
};

export const getProductByOutlet = async (req, res) => {
	try {
		const { outletId } = req.params;
		const { page = 1, limit = 20 } = req.query;
		const pageNum = parseInt(page);
		const limitNum = parseInt(limit);
		const skip = (pageNum - 1) * limitNum;

		// Find outlet
		const outlet = await Outlet.findOne({ outletId });
		if (!outlet) {
			return res.status(404).json({
				success: false,
				message: 'Outlet not found',
			});
		}

		// Get products for this outlet
		const filter = {
			outlet: outletId,
			status: 'active',
		};

		const [products, total] = await Promise.all([
			Product.find(filter)
				.skip(skip)
				.limit(limitNum)
				.populate('outletId', 'name outletId')
				.select('title price discount banner images rating sold stock'),
			Product.countDocuments(filter),
		]);

		const totalPages = Math.ceil(total / limitNum);
		const hasNextPage = pageNum < totalPages;
		const hasPrevPage = pageNum > 1;

		res.json({
			success: true,
			outlet: {
				id: outlet._id,
				name: outlet.name,
				outletId: outlet.outletId,
				type: outlet.type,
			},
			count: products.length,
			total,
			pagination: {
				currentPage: pageNum,
				totalPages,
				hasNextPage,
				hasPrevPage,
			},
			products,
		});
	} catch (error) {
		console.error('Get Products by Outlet Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch products for outlet',
			error: error.message,
		});
	}
};

export const updateStock = async (req, res) => {
	try {
		const { id } = req.params;
		const { quantity, action, outletId } = req.body; // action: 'add', 'remove', 'set'

		if (!quantity || !action) {
			return res.status(400).json({
				success: false,
				message: 'Quantity and action are required',
			});
		}

		// Find the product
		const product = await Product.findById(id);
		if (!product) {
			return res.status(404).json({
				success: false,
				message: 'Product not found',
			});
		}

		// Check permission
		if (
			req.user.role !== 'admin' &&
			product.createdBy.toString() !== req.user.id
		) {
			return res.status(403).json({
				success: false,
				message: 'You do not have permission to update this product',
			});
		}

		// Update stock
		let newStock;
		switch (action) {
			case 'add':
				newStock = product.stock + parseInt(quantity);
				break;
			case 'remove':
				newStock = Math.max(0, product.stock - parseInt(quantity));
				break;
			case 'set':
				newStock = parseInt(quantity);
				break;
			default:
				return res.status(400).json({
					success: false,
					message: 'Invalid action. Use "add", "remove", or "set"',
				});
		}

		// Update product stock
		product.stock = newStock;

		// Update status based on stock
		if (product.stock <= 0) {
			product.status = 'out_of_stock';
		} else if (product.status === 'out_of_stock') {
			product.status = 'active';
		}

		// Update outlet-specific stock if outletId provided
		if (outletId) {
			const outletIndex = product.outlets.findIndex(
				(o) => o.outletId.toString() === outletId
			);

			if (outletIndex > -1) {
				product.outlets[outletIndex].stock = newStock;
				product.outlets[outletIndex].lastRestocked = new Date();
			}
		}

		product.updatedBy = req.user.id;
		product.updatedAt = new Date();
		await product.save();

		res.json({
			success: true,
			message: `Stock ${action}ed successfully`,
			productId: product.productId,
			title: product.title,
			stock: product.stock,
			status: product.status,
		});
	} catch (error) {
		console.error('Update Stock Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to update stock',
			error: error.message,
		});
	}
};

export const toggleFeaturedStatus = async (req, res) => {
	try {
		const { id } = req.params;
		const { featured } = req.body;

		// Find the product
		const product = await Product.findById(id);
		if (!product) {
			return res.status(404).json({
				success: false,
				message: 'Product not found',
			});
		}

		// Update featured status
		product.isFeatured = featured === true || featured === 'true';
		product.updatedBy = req.user.id;
		product.updatedAt = new Date();
		await product.save();

		res.json({
			success: true,
			message: product.isFeatured
				? 'Product featured successfully'
				: 'Product unfeatured successfully',
			productId: product.productId,
			title: product.title,
			isFeatured: product.isFeatured,
		});
	} catch (error) {
		console.error('Toggle Featured Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to update featured status',
			error: error.message,
		});
	}
};

export const searchSuggestions = async (req, res) => {
	try {
		const { q } = req.query;

		if (!q || q.length < 2) {
			return res.json({
				success: true,
				suggestions: [],
			});
		}

		const suggestions = await Product.find({
			$or: [
				{ title: { $regex: q, $options: 'i' } },
				{ category: { $regex: q, $options: 'i' } },
				{ brand: { $regex: q, $options: 'i' } },
				{ tags: { $regex: q, $options: 'i' } },
			],
			status: 'active',
		})
			.limit(10)
			.select('title category brand price discount banner');

		const categories = await Product.distinct('category', {
			category: { $regex: q, $options: 'i' },
			status: 'active',
		});

		res.json({
			success: true,
			query: q,
			suggestions: suggestions.map((product) => ({
				id: product._id,
				title: product.title,
				category: product.category,
				brand: product.brand,
				price: product.price,
				discountedPrice: product.price - product.discount,
				banner: product.banner,
				type: 'product',
			})),
			categories: categories.slice(0, 5).map((category) => ({
				name: category,
				type: 'category',
			})),
		});
	} catch (error) {
		console.error('Search Suggestions Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to get search suggestions',
			error: error.message,
		});
	}
};
