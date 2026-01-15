import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Outlet from '../models/Outlet.js';
import { auth, isAdmin, isManagerOrAdmin } from '../middlewares/auth.js';
import { validate } from '../middlewares/validation.js';
import {
	uploadProductImages,
	validateUpload,
	upload,
} from '../middlewares/upload.js';
import {
	productValidation,
	updateProductValidation,
} from '../middlewares/validation.js';

import {
	updateProduct,
	getAllProducts,
	getAllCatergories,
	getProductById,
	getAllFeaturedProducts,
	deleteProduct,
	createProduct,
	addProductImages,
	getBestSellers,
	toggleFeaturedStatus,
	getNewArrivals,
	searchSuggestions,
	updateStock,
	getProductByOutlet,
	getAllOnSaleProducts,
	updateProductImages,
} from '../controllers/product.js';

const router = express.Router();

// GET /api/products - Get all products with filters
router.get('/all', getAllProducts);

// GET /api/products/:id - Get a single product
router.get('/:id', getProductById);
// GET /api/products - Get all products with filters
router.get('/', getAllProducts);

// PATCH /api/products/:id - Update product
router.patch(
	'/:id',
	auth,
	isManagerOrAdmin,
	validate(updateProductValidation),
	updateProduct
);

router.patch('/:id/images', auth, uploadProductImages, updateProductImages);

// POST /api/products - Create product with Cloudinary upload
router.post(
	'/',
	auth,
	isManagerOrAdmin,
	uploadProductImages,
	validateUpload,
	validate(productValidation),
	createProduct
);

// DELETE /api/products/:id - Delete product
router.delete('/:id', auth, isAdmin, deleteProduct);

// POST /api/products/:id/images - Add images to product
router.post(
	'/:id/images',
	auth,
	isManagerOrAdmin,
	uploadProductImages,
	validateUpload,
	addProductImages
);

// DELETE /api/products/:id/images - Remove image from product
router.delete('/:id/images', auth, isManagerOrAdmin);

// GET /api/products/categories - Get all categories
router.get('/categories/all', auth, getAllCatergories);

// GET /api/products/featured - Get featured products
router.get('/featured/all', auth, getAllFeaturedProducts);

// GET /api/products/bestsellers - Get bestseller products
router.get('/bestsellers/all', auth, getBestSellers);

// GET /api/products/new-arrivals - Get new arrivals
router.get('/new-arrivals/all', auth, getNewArrivals);

// GET /api/products/on-sale - Get products on sale
router.get('/on-sale/all', auth, getAllOnSaleProducts);

// GET /api/products/outlet/:outletId - Get products by outlet
router.get('/outlet/:outletId', auth, getProductByOutlet);

// POST /api/products/:id/stock - Update product stock
router.post('/:id/stock', auth, isManagerOrAdmin, updateStock);

// POST /api/products/:id/feature - Toggle featured status
router.post('/:id/feature', auth, isAdmin, toggleFeaturedStatus);

// GET /api/products/search/suggestions - Search suggestions
router.get('/search/suggestions', searchSuggestions);

export default router;
