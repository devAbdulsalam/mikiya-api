import { body, validationResult, param } from 'express-validator';

export const validate = (validations) => {
	return async (req, res, next) => {
		await Promise.all(validations.map((validation) => validation.run(req)));

		const errors = validationResult(req);
		if (errors.isEmpty()) {
			return next();
		}

		res.status(400).json({
			success: false,
			message: 'Validation errors',
			errors: errors.array(),
		});
	};
};
// User registration and login validation

export const registerValidation = [
	body('username')
		.trim()
		.isLength({ min: 3, max: 30 })
		.withMessage('Username must be between 3 and 30 characters'),
	body('email')
		.isEmail()
		.normalizeEmail()
		.withMessage('Please provide a valid email'),
	body('password')
		.isLength({ min: 6 })
		.withMessage('Password must be at least 6 characters long'),
	body('role')
		.optional()
		.isIn(['admin', 'manager', 'staff'])
		.withMessage('Invalid role specified'),
];

export const loginValidation = [
	body('email')
		.isEmail()
		.normalizeEmail()
		.withMessage('Please provide a valid email'),
	body('password').notEmpty().withMessage('Password is required'),
];

export const changePasswordValidation = [
	body('currentPassword')
		.notEmpty()
		.withMessage('Current password is required'),
	body('newPassword')
		.isLength({ min: 6 })
		.withMessage('New password must be at least 6 characters long')
		.custom((value, { req }) => {
			if (value === req.body.currentPassword) {
				throw new Error('New password cannot be the same as current password');
			}
			return true;
		}),
	body('confirmPassword').custom((value, { req }) => {
		if (value !== req.body.newPassword) {
			throw new Error('Passwords do not match');
		}
		return true;
	}),
];

export const forgotPasswordValidation = [
	body('email')
		.isEmail()
		.normalizeEmail()
		.withMessage('Please provide a valid email'),
];

export const resetPasswordValidation = [
	body('token').notEmpty().withMessage('Reset token is required'),
	body('password')
		.isLength({ min: 6 })
		.withMessage('Password must be at least 6 characters long'),
	body('confirmPassword').custom((value, { req }) => {
		if (value !== req.body.password) {
			throw new Error('Passwords do not match');
		}
		return true;
	}),
];

// Product validation
export const productValidation = [
	body('title')
		.trim()
		.isLength({ min: 3, max: 200 })
		.withMessage('Title must be between 3 and 200 characters'),
	body('description')
		.trim()
		.isLength({ min: 10, max: 2000 })
		.withMessage('Description must be between 10 and 2000 characters'),
	body('price')
		.isFloat({ min: 0 })
		.withMessage('Price must be a positive number'),
	body('discount')
		.optional()
		.isFloat({ min: 0 })
		.withMessage('Discount must be a positive number'),
	body('stock')
		.isInt({ min: 0 })
		.withMessage('Stock must be a non-negative integer'),
	body('moq')
		.optional()
		.isInt({ min: 1 })
		.withMessage('MOQ must be at least 1'),
	body('category')
		.trim()
		.isLength({ min: 2, max: 100 })
		.withMessage('Category must be between 2 and 100 characters'),
	body('outletId').optional(),
	// .trim().withMessage('Outlet Id is required'),
	body('businessId').optional(),
	// .trim()
	// .withMessage('Business is required'),
	// convert string → array if needed
	body('features')
		.customSanitizer((val) => {
			if (!val) return [];
			if (typeof val === 'string') return JSON.parse(val);
			return val;
		})
		.isArray()
		.withMessage('Features must be an array'),
	body('colors')
		.customSanitizer((val) => {
			if (!val) return [];
			if (typeof val === 'string') return JSON.parse(val);
			return val;
		})
		.isArray()
		.withMessage('Colors must be an array'),
	body('rating')
		.optional()
		.isFloat({ min: 0, max: 5 })
		.withMessage('Rating must be between 0 and 5'),
	body('sold')
		.optional()
		.isInt({ min: 0 })
		.withMessage('Sold must be a non-negative integer'),
	body('reviews')
		.optional()
		.isInt({ min: 0 })
		.withMessage('Reviews must be a non-negative integer'),
	body('banner').optional().isURL().withMessage('Banner must be a valid URL'),
	body('images')
		.optional()
		.isArray()
		.withMessage('Images must be an array of URLs'),
];

// Update product validation
export const updateProductValidation = [
	body('title')
		.optional()
		.trim()
		.isLength({ min: 3, max: 200 })
		.withMessage('Title must be between 3 and 200 characters'),
	body('description')
		.optional()
		.trim()
		.isLength({ min: 10, max: 2000 })
		.withMessage('Description must be between 10 and 2000 characters'),
	body('price')
		.optional()
		.isFloat({ min: 0 })
		.withMessage('Price must be a positive number'),
	body('discount')
		.optional()
		.isFloat({ min: 0 })
		.withMessage('Discount must be a positive number')
		.custom((value, { req }) => {
			if (value > req.body?.price) {
				throw new Error('Discount cannot be greater than price');
			}
			return true;
		}),
	body('stock')
		.optional()
		.isInt({ min: 0 })
		.withMessage('Stock must be a non-negative integer'),
	body('category')
		.optional()
		.trim()
		.isLength({ min: 2, max: 100 })
		.withMessage('Category must be between 2 and 100 characters'),
	// convert string → array if needed
	body('features')
		.customSanitizer((val) => {
			if (!val) return [];
			if (typeof val === 'string') return JSON.parse(val);
			return val;
		})
		.isArray()
		.withMessage('Features must be an array'),

	body('colors')
		.customSanitizer((val) => {
			if (!val) return [];
			if (typeof val === 'string') return JSON.parse(val);
			return val;
		})
		.isArray()
		.withMessage('Colors must be an array'),
	body('rating')
		.optional()
		.isFloat({ min: 0, max: 5 })
		.withMessage('Rating must be between 0 and 5'),
	body('banner').optional().isURL().withMessage('Banner must be a valid URL'),
	body('images')
		.optional()
		.isArray()
		.withMessage('Images must be an array of URLs'),
];

// Product ID validation
export const productIdValidation = [
	param('id').notEmpty().withMessage('Product ID is required'),
];
