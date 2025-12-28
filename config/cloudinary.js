import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

// Configure Cloudinary
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});


const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		// This storage needs public/images folder in the root directory
		// Else it will throw an error saying cannot find path public/images
		cb(null, './public/uploads');
	},
	// Store file in a .png/.jpeg/.jpg format instead of binary
	filename: function (req, file, cb) {
		let fileExtension = '';
		if (file.originalname.split('.').length > 1) {
			fileExtension = file.originalname.substring(
				file.originalname.lastIndexOf('.')
			);
		}
		const filenameWithoutExtension = file.originalname
			.toLowerCase()
			.split(' ')
			.join('-')
			?.split('.')[0];
		cb(
			null,
			filenameWithoutExtension +
				Date.now() +
				Math.ceil(Math.random() * 1e5) + // avoid rare name conflict
				fileExtension
		);
	},
});




// Upload helper functions
export const uploadImage = async (
	filePath,
	folder = 'business_management/products'
) => {
	try {
		const result = await cloudinary.uploader.upload(filePath, {
			folder,
			transformation: [
				{ width: 1200, height: 800, crop: 'limit' },
				{ quality: 'auto:good' },
			],
		});
		return result;
	} catch (error) {
		console.error('Cloudinary upload error:', error);
		throw new Error('Failed to upload image');
	}
};

export const uploadMultipleImages = async (
	files,
	folder = '/products'
) => {
	try {
		const uploadPromises = files.map((file) =>
			cloudinary.uploader.upload(file.path, {
				folder,
				transformation: [
					{ width: 800, height: 600, crop: 'limit' },
					{ quality: 'auto:good' },
				],
			})
		);
		const results = await Promise.all(uploadPromises);
		return results.map((result) => result.secure_url);
	} catch (error) {
		console.error('Cloudinary multiple upload error:', error);
		throw new Error('Failed to upload images');
	}
};

export const deleteImage = async (publicId) => {
	try {
		const result = await cloudinary.uploader.destroy(publicId);
		return result;
	} catch (error) {
		console.error('Cloudinary delete error:', error);
		throw new Error('Failed to delete image');
	}
};

export const getPublicIdFromUrl = (url) => {
	// Extract public_id from Cloudinary URL
	const regex = /\/v\d+\/(.+?)\./;
	const match = url.match(regex);
	return match ? match[1] : null;
};

export default cloudinary;
