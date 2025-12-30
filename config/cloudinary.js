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

export const uploadAndExtractImageUrls = async (files) => {
	let bannerUrl = null;
	let imageUrls = [];

	// Upload Banner (Single File)
	if (files?.banner && files.banner[0]) {
		const result = await cloudinary.uploader.upload_stream(
			{ folder: "products/banner" },
			(err, res) => { if (err) console.log(err) }
		);
	}

	// Instead → convert to a buffer upload
	if (files?.banner && files.banner[0]) {
		bannerUrl = await uploadBufferToCloudinary(
			files.banner[0].buffer,
			`products/banner-${Date.now()}`
		);
	}

	// Upload Images (Array)
	if (files?.images && files.images.length > 0) {
		for (const img of files.images) {
			const url = await uploadBufferToCloudinary(
				img.buffer,
				`products/images-${Date.now()}`
			);
			if (url) imageUrls.push(url);
		}
	}

	return {
		banner: bannerUrl,
		images: imageUrls
	};
};

// Helper fn to upload buffer
const uploadBufferToCloudinary = (buffer, publicId) => {
	return new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{ public_id: publicId, folder: "products" },
			(err, result) => {
				if (err) reject(err);
				else resolve(result.secure_url);
			}
		);
		stream.end(buffer);
	});
};

export default cloudinary;
