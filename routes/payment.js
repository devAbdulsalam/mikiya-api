import  express from'express'
import  {auth} from'../middlewares/auth.js'
import { upload } from '../middlewares/upload.js';
import { getPayments, newPayment } from '../controllers/payment.js';
const  router = express.Router();

router.get('/', auth, getPayments);

router.post('/', auth, upload.single('image'), newPayment);

export default router;