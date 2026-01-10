import express from 'express';
import {
	createFoundation,
	getFoundations,
	getFoundationById,
	updateFoundation,
	deleteFoundation,
} from '../../controllers/foundation.js';

const router = express.Router();

router.post('/', createFoundation);
router.get('/', getFoundations);
router.get('/:id', getFoundationById);
router.put('/:id', updateFoundation);
router.delete('/:id', deleteFoundation);

export default router;
