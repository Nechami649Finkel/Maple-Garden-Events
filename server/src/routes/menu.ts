import { Router } from 'express';
import { getMenu, addDish, updateDish, deleteDish } from '../controllers/menu';

const router = Router();

router.get('/', getMenu);
router.post('/', addDish);        // הוספה
router.put('/:id', updateDish);   // עריכה
router.delete('/:id', deleteDish); // מחיקה

export default router;