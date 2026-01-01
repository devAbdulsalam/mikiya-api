import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const createAdminUser = async () => {
	try {
		await mongoose.connect(process.env.MONGODB_URI);
		console.log('Connected to MongoDB');

		// Check if admin exists
		const adminExists = await User.findOne({ email: 'foundation@gmail.com' });

		if (adminExists) {
			console.log('Admin user already exists');
			process.exit(0);
		}

		// Create admin user
		const hashedPassword = await bcrypt.hash('Admin@123', 12);

		const adminUser = new User({
			username: 'foundation',
			email: 'foundation@gmail.com',
			password: hashedPassword,
			role: 'admin',
			department: 'foundation',
			profile: {
				firstName: 'Foundation',
				lastName: 'Manager',
			},
		});

		await adminUser.save();
		console.log('✅ Admin user created successfully');
		console.log('📧 Email: admin@gmail.com');
		console.log('🔑 Password: Admin@123');

		process.exit(0);
	} catch (error) {
		console.error('❌ Error creating admin user:', error);
		process.exit(1);
	}
};

createAdminUser();
