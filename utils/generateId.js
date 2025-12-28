import crypto from 'crypto';

export const generateUserId = () => {
	const timestamp = Date.now().toString();
	const random = crypto.randomBytes(4).toString('hex');
	return `USER-${timestamp.slice(-6)}-${random.slice(0, 4)}`.toUpperCase();
};

export const generateOutletId = () => {
	const timestamp = Date.now().toString();
	const random = crypto.randomBytes(3).toString('hex');
	return `OUT-${timestamp.slice(-6)}-${random.slice(0, 3)}`.toUpperCase();
};

export const generateCustomerId = () => {
	const timestamp = Date.now().toString();
	const random = crypto.randomBytes(3).toString('hex');
	return `CUST-${timestamp.slice(-6)}-${random.slice(0, 3)}`.toUpperCase();
};

export const generateProductId = () => {
	const timestamp = Date.now().toString();
	const random = crypto.randomBytes(4).toString('hex');
	return `PROD-${timestamp.slice(-6)}-${random.slice(0, 4)}`.toUpperCase();
};

export const generateTransactionId = () => {
	const timestamp = Date.now().toString();
	const random = crypto.randomBytes(4).toString('hex');
	return `TXN-${timestamp.slice(-6)}-${random.slice(0, 4)}`.toUpperCase();
};

export const generateSku = (category, brand) => {
	const categoryCode = category.slice(0, 3).toUpperCase();
	const brandCode = brand ? brand.slice(0, 3).toUpperCase() : 'GEN';
	const random = crypto.randomBytes(3).toString('hex').toUpperCase();
	return `${categoryCode}-${brandCode}-${random}`;
};
