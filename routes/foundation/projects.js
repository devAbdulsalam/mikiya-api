import express from 'express';
import mongoose from 'mongoose';
import Project from '../../models/Project.js';
import Foundation from '../../models/Foundation.js';
import User from '../../models/User.js';

const router = express.Router();

// Create a new project
router.post('/', async (req, res) => {
	try {
		const { name, description, foundationId, createdBy } = req.body;
		const project = await Project.create({
			name,
			description,
			foundationId,
			createdBy,
		});
		res.status(200).json({ project, message: 'Project created sucessfully' });
	} catch (error) {
		console.error('Get project Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch project',
			error: error.message,
		});
	}
});


export default router;