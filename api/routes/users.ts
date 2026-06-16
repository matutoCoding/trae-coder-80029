import { Router, type Request, type Response } from 'express';
import { userRepo } from '../repositories/repos.js';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  try {
    const { role } = req.query as { role?: string };
    const list = role ? userRepo.findByRole(role) : userRepo.findAll();
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    const item = userRepo.findById(id);
    if (!item) {
      res.json({ success: false, message: '用户不存在' });
      return;
    }
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

export default router;
