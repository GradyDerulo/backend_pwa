import express from 'express';
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  syncProducts,
} from '../controllers/productController.js';

const router = express.Router();

router.post('/', createProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.put('/:id', updateProduct);
router.post('/sync', syncProducts);

export default router;