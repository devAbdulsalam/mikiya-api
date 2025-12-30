import multer from 'multer';
import path from 'path';

// const storage = multer.diskStorage({
// 	destination: function (req, file, cb) {
// 		// This storage needs public/images folder in the root directory
// 		// Else it will throw an error saying cannot find path public/images
// 		cb(null, './public/uploads');
// 	},
// 	// Store file in a .png/.jpeg/.jpg format instead of binary
// 	filename: function (req, file, cb) {
// 		let fileExtension = '';
// 		if (file.originalname.split('.').length > 1) {
// 			fileExtension = file.originalname.substring(
// 				file.originalname.lastIndexOf('.')
// 			);
// 		}
// 		const filenameWithoutExtension = file.originalname
// 			.toLowerCase()
// 			.split(' ')
// 			.join('-')
// 			?.split('.')[0];
// 		cb(
// 			null,
// 			filenameWithoutExtension +
// 				Date.now() +
// 				Math.ceil(Math.random() * 1e5) + // avoid rare name conflict
// 				fileExtension
// 		);
// 	},
// });

const storage = multer.memoryStorage();        // <-- REQUIRED to get file.buffer

// export const upload = multer({
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 } // optional: 5MB max
// });


// File filter for images
const fileFilter = (req, file, cb) => {
	const allowedTypes = process.env.ALLOWED_IMAGE_TYPES?.split(',') || [
		'image/jpeg',
		'image/png',
		'image/webp',
		'image/jpg',
	];

	if (allowedTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(
			new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'),
			false
		);
	}
};

// Multer upload configuration
export const upload = multer({
	storage: storage,
	fileFilter: fileFilter,
	limits: {
		fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880, // 5MB
		files: 10, // Maximum 10 files
	},
});

// Middleware for single file upload (banner)
export const uploadBanner = upload.single('banner');

// Middleware for multiple files upload (images)
export const uploadImages = upload.array('images', 10);

// Middleware for handling both single and multiple uploads
export const uploadProductImages = (req, res, next) => {
	upload.fields([
		{ name: 'banner', maxCount: 1 },
		{ name: 'images', maxCount: 10 },
	])(req, res, (err) => {
		if (err) {
			return res.status(400).json({
				success: false,
				message: err.message || 'File upload error',
			});
		}
		next();
	});
};

// Validate uploaded files
export const validateUpload = (req, res, next) => {
	if (!req.files && !req.file && !req.body.images && !req.body.banner) {
		return next(); // No files to upload, continue
	}

	// Check if banner is provided
	if (req.files?.banner) {
		const banner = req.files.banner[0];
		if (banner.size > (parseInt(process.env.MAX_FILE_SIZE) || 5242880)) {
			return res.status(400).json({
				success: false,
				message: 'Banner image is too large. Maximum size is 5MB',
			});
		}
	}

	// Check if images are provided
	if (req.files?.images) {
		const images = req.files.images;
		for (const image of images) {
			if (image.size > (parseInt(process.env.MAX_FILE_SIZE) || 5242880)) {
				return res.status(400).json({
					success: false,
					message: `Image ${image.originalname} is too large. Maximum size is 5MB`,
				});
			}
		}
	}

	next();
};
