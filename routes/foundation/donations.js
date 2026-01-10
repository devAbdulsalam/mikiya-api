import express from 'express';
import {
	createDonation,
	getDonations,
	deleteDonation,
} from '../../controllers/donation.js';

const router = express.Router();

router.post('/', createDonation);
router.get('/', getDonations);
router.delete('/:id', deleteDonation);

export default router;
