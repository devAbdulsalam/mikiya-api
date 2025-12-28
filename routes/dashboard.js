import express from 'express';
import { auth } from '../middlewares/auth.js';
import { getMikiyaPlasticDashboard } from '../controllers/dashboard.js';

const router = express.Router();

router.get('/mikiya-plastic',  getMikiyaPlasticDashboard);

export default router;