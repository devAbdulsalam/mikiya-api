import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const generateTemporaryPassword = (length = 8) => {
	const chars =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
	let password = '';

	// Ensure at least one of each required character type
	password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(
		Math.floor(Math.random() * 26)
	);
	password += 'abcdefghijklmnopqrstuvwxyz'.charAt(
		Math.floor(Math.random() * 26)
	);
	password += '0123456789'.charAt(Math.floor(Math.random() * 10));
	password += '!@#$%^&*'.charAt(Math.floor(Math.random() * 8));

	// Fill the rest randomly
	for (let i = 4; i < length; i++) {
		password += chars.charAt(Math.floor(Math.random() * chars.length));
	}

	// Shuffle the password
	return password
		.split('')
		.sort(() => Math.random() - 0.5)
		.join('');
};

export const validatePasswordStrength = (password) => {
	const minLength = 6;
	const hasUpperCase = /[A-Z]/.test(password);
	const hasLowerCase = /[a-z]/.test(password);
	const hasNumbers = /\d/.test(password);
	const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

	const strength = {
		isValid: password.length >= minLength,
		length: password.length >= minLength,
		uppercase: hasUpperCase,
		lowercase: hasLowerCase,
		numbers: hasNumbers,
		specialChar: hasSpecialChar,
		score: 0,
	};

	// Calculate score
	if (password.length >= minLength) strength.score++;
	if (password.length >= 8) strength.score++;
	if (hasUpperCase) strength.score++;
	if (hasLowerCase) strength.score++;
	if (hasNumbers) strength.score++;
	if (hasSpecialChar) strength.score++;

	return strength;
};

export const generateApiKey = () => {
	return `bms_${crypto.randomBytes(32).toString('hex')}`;
};

export const sanitizeInput = (input) => {
	if (typeof input === 'string') {
		return input.trim().replace(/[<>]/g, '');
	}
	return input;
};

// export const formatCurrency = (amount, currency = 'NGN') => {
// 	return new Intl.NumberFormat('en-NG', {
// 		style: 'currency',
// 		currency: currency,
// 		minimumFractionDigits: 2,
// 	}).format(amount);
// };

// export const formatDate = (date, format = 'DD/MM/YYYY HH:mm') => {
// 	const d = new Date(date);
// 	const pad = (num) => num.toString().padStart(2, '0');

// 	const formats = {
// 		'DD/MM/YYYY': `${pad(d.getDate())}/${pad(
// 			d.getMonth() + 1
// 		)}/${d.getFullYear()}`,
// 		'YYYY-MM-DD': `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
// 			d.getDate()
// 		)}`,
// 		'DD/MM/YYYY HH:mm': `${pad(d.getDate())}/${pad(
// 			d.getMonth() + 1
// 		)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
// 		relative: getRelativeTime(d),
// 	};

// 	return formats[format] || d.toLocaleString();
// };

const getRelativeTime = (date) => {
	const now = new Date();
	const diff = now - date;
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (minutes < 1) return 'Just now';
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
	if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
	if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

	return formatDate(date, 'DD/MM/YYYY');
};

// Add these functions to your existing helpers.js file

/**
 * Format currency with proper symbols
 */
export const formatCurrency = (amount, currency = 'NGN') => {
    if (amount === null || amount === undefined) return 'N/A';
    
    const formatter = new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    
    return formatter.format(amount);
};

/**
 * Format date in various formats
 */
export const formatDate = (date, format = 'DD/MM/YYYY') => {
    if (!date) return 'N/A';
    
    const d = new Date(date);
    const pad = (num) => num.toString().padStart(2, '0');
    
    const formats = {
        'DD/MM/YYYY': `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
        'YYYY-MM-DD': `${d.getFullYear()}-${pad(d.getMonth()  + 1)}-${pad(d.getDate())}`,
        'DD/MM/YYYY HH:mm': `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
        'MMM DD, YYYY': d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        'full': d.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }),
    };
    
    return formats[format] || d.toLocaleDateString();
};

/**
 * Calculate percentage change
 */
export const calculatePercentageChange = (current, previous) => {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / Math.abs(previous)) * 100;
};

/**
 * Generate a unique report ID
 */
export const generateReportId = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `REP-${timestamp}-${random}`;
};

/**
 * Convert object to CSV row
 */
export const objectToCSV = (obj, headers) => {
    return headers.map(header => {
        const value = obj[header.key] || obj[header] || '';
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }).join(',');
};

/**
 * Format large numbers with K, M, B suffixes
 */
export const formatLargeNumber = (num) => {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
};

/**
 * Calculate age from date of birth
 */
export const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
};

/**
 * Get month name from number
 */
export const getMonthName = (monthNumber) => {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNumber - 1] || '';
};

/**
 * Generate fiscal year string
 */
export const getFiscalYear = (date, startMonth = 1) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    
    if (month < startMonth) {
        return `${year - 1}-${year}`;
    }
    return `${year}-${year + 1}`;
};