import express from 'express';
import {
  createSale,
  getSales,
  syncSales,
} from '../controllers/saleController.js';

const router = express.Router();

router.post('/', createSale);
router.get('/', getSales);
router.post('/sync', syncSales);

export default router;