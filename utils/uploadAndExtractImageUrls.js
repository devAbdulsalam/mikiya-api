import cloudinary from '../config/cloudinary.js';

export const uploadAndExtractImageUrls = async (files) => {
	let bannerUrl = null;
	let imageUrls = [];

	// Upload Banner (Single File)
	if (files?.banner && files.banner[0]) {
		const result = await cloudinary.uploader.upload_stream(
			{ folder: 'products/banner' },
			(err, res) => {
				if (err) console.log(err);
			}
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
		images: imageUrls,
	};
};

// Helper fn to upload buffer
const uploadBufferToCloudinary = (buffer, publicId) => {
	return new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{ public_id: publicId, folder: 'products' },
			(err, result) => {
				if (err) reject(err);
				else resolve(result.secure_url);
			}
		);
		stream.end(buffer);
	});
};

// Helper function to extract image URLs from request
export const extractImageUrls = (req) => {
	const images = [];

	// Handle banner upload
	if (req.files?.banner?.[0]) {
		images.push({ type: 'banner', url: req.files.banner[0].path });
	} else if (req.body.banner) {
		images.push({ type: 'banner', url: req.body.banner });
	}

	// Handle multiple images upload
	if (req.files?.images) {
		req.files.images.forEach((file) => {
			images.push({ type: 'gallery', url: file.path });
		});
	} else if (req.body.images && Array.isArray(req.body.images)) {
		req.body.images.forEach((url) => {
			images.push({ type: 'gallery', url });
		});
	}

	return images;
};

// Helper function to delete old images when updating
export const deleteOldImages = async (product, newBanner, newImages) => {
	const imagesToDelete = [];

	// Check and mark old banner for deletion
	if (product.banner && product.banner !== newBanner) {
		const publicId = getPublicIdFromUrl(product.banner);
		if (publicId && !publicId.startsWith('http')) {
			// Only delete Cloudinary images
			imagesToDelete.push(publicId);
		}
	}

	// Check and mark old gallery images for deletion
	product.images.forEach((oldImage) => {
		if (!newImages.includes(oldImage)) {
			const publicId = getPublicIdFromUrl(oldImage);
			if (publicId && !publicId.startsWith('http')) {
				// Only delete Cloudinary images
				imagesToDelete.push(publicId);
			}
		}
	});

	// Delete images from Cloudinary
	if (imagesToDelete.length > 0) {
		try {
			await Promise.all(
				imagesToDelete.map((publicId) => deleteImage(publicId))
			);
			console.log(
				`Deleted ${imagesToDelete.length} old images from Cloudinary`
			);
		} catch (error) {
			console.error('Error deleting old images:', error);
			// Don't throw error, continue with update
		}
	}
};
