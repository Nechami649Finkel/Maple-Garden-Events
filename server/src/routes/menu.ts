import { Router } from 'express';
import { getMenu, addDish, updateDish, deleteDish } from '../controllers/menu';
import { requireAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { RBAC } from '../config/rbac';
import { validate } from '../middlewares/validate';
import { addDishSchema, deleteDishSchema, updateDishSchema } from '../validators/menu.validator';

const router = Router();
router.use(requireAuth);

router.get('/', requireRole(...RBAC.MENU_READ), getMenu);
router.post('/', requireRole(...RBAC.MENU_WRITE), validate(addDishSchema), addDish);
router.put('/:id', requireRole(...RBAC.MENU_WRITE), validate(updateDishSchema), updateDish);
router.delete('/:id', requireRole(...RBAC.MENU_WRITE), validate(deleteDishSchema), deleteDish);

export default router;
