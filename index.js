import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import connectDB from './config/database.js';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import outletRoutes from './routes/outlet.js';
import customerRoutes from './routes/customer.js';
import transactionRoutes from './routes/transaction.js';
import invoiceRoutes from './routes/invoice.js';
import productRoutes from './routes/product.js';
import dashboardRoutes from './routes/dashboard.js';
import businessRoutes from './routes/business.js';
import userRoutes from './routes/user.js';
import paymentRoutes from './routes/payment.js';
// import foundationRoutes from './routes/foundation/index.js';
// import reportRoutes from './routes/report.js';

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Rate limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 500, // Limit each IP to 500 requests per windowMs
	message: 'Too many requests from this IP, please try again after 15 minutes',
	standardHeaders: true,
	legacyHeaders: false,
});

// Security middleware
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));
app.use(morgan('common'));
app.use(bodyParser.json());
app.use(express.static('public')); // configure static file to save images locally
app.use(cookieParser());
app.use(cors('*'));
app.use(
	cors({
		origin: [
			process.env.FRONTEND_URL,
			'http://localhost:3000',
			'http://localhost:5173',
			'http://localhost:8080',
			'https://mikiyainternational.com',
		],
		credentials: true,
	})
);
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
	console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
	next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/outlets', outletRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/products', productRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
// app.use('/api/reports', reportRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
	res.status(200).json({
		status: 'OK',
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		memory: process.memoryUsage(),
	});
});

// Server information endpoint
app.get('/api/info', (req, res) => {
	res.json({
		name: 'Business Management System',
		version: '1.0.0',
		description: 'Multi-outlet business management system',
		environment: process.env.NODE_ENV || 'development',
		features: [
			'User Management',
			'Multi-Outlet Support',
			'Customer Management',
			'Inventory Management',
			'Sales Processing',
			'Invoice Generation',
			'Debt Tracking',
			'Password Reset',
			'User Suspension',
		],
	});
});

// 404 handler
// app.all('*', (req, res) => {
// 	res.status(404).json({
// 		success: false,
// 		message: 'Endpoint not found',
// 		path: req.originalUrl,
// 	});
// });

// Global error handling middleware
app.use((err, req, res, next) => {
	console.error('Global Error Handler:', err.stack);

	// Default error status
	let statusCode = err.statusCode || 500;
	let message = err.message || 'Internal Server Error';
	let errors = err.errors || null;

	// Mongoose validation error
	if (err.name === 'ValidationError') {
		statusCode = 400;
		message = 'Validation Error';
		errors = Object.values(err.errors).map((error) => ({
			field: error.path,
			message: error.message,
		}));
	}

	// Mongoose duplicate key error
	if (err.code === 11000) {
		statusCode = 400;
		message = 'Duplicate field value entered';
		errors = Object.keys(err.keyValue).map((key) => ({
			field: key,
			message: `${key} already exists`,
		}));
	}

	// JWT errors
	if (err.name === 'JsonWebTokenError') {
		statusCode = 401;
		message = 'Invalid token';
	}

	if (err.name === 'TokenExpiredError') {
		statusCode = 401;
		message = 'Token expired';
	}

	res.status(statusCode).json({
		success: false,
		message,
		errors,
		stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
	});
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
	console.log(`
    🚀 Server running on port ${PORT}
    📁 Environment: ${process.env.NODE_ENV || 'development'}
    📍 MongoDB: ${process.env.MONGODB_URI}
    🌐 Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}
    🔒 JWT Expire: ${process.env.JWT_EXPIRE}
    📧 Email Service: ${
			process.env.EMAIL_USER ? 'Configured' : 'Not configured'
		}
    `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
	console.error('Unhandled Promise Rejection:', err);
	// Close server & exit process
	process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
	console.error('Uncaught Exception:', err);
	process.exit(1);
});

export default app;
