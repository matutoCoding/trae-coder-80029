import { Router, type Request, type Response } from 'express';
import { routeRepo } from '../repositories/repos.js';
import type { ApprovalRoute, ApprovalNode } from '../../shared/types.js';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  try {
    const list = routeRepo.findAll();
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    const item = routeRepo.findById(id);
    if (!item) {
      res.json({ success: false, message: '审批路由不存在' });
      return;
    }
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/', (req: Request, res: Response): void => {
  try {
    const body = req.body as Omit<ApprovalRoute, 'id' | 'nodes'> & {
      nodes: Omit<ApprovalNode, 'id' | 'routeId'>[];
    };
    if (!body.name || !body.condition || !body.nodes?.length) {
      res.json({ success: false, message: '名称、条件、节点必填' });
      return;
    }
    for (const n of body.nodes) {
      if (!n.name || !n.role || n.orderIndex == null) {
        res.json({ success: false, message: '节点信息不完整' });
        return;
      }
    }
    const id = routeRepo.create(body);
    res.json({ success: true, data: { id }, message: '创建成功' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    const exist = routeRepo.findById(id);
    if (!exist) {
      res.json({ success: false, message: '审批路由不存在' });
      return;
    }
    const body = req.body as Partial<Omit<ApprovalRoute, 'id' | 'nodes'>> & {
      nodes?: Omit<ApprovalNode, 'id' | 'routeId'>[];
    };
    routeRepo.update(id, body);
    res.json({ success: true, message: '更新成功' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id);
    const exist = routeRepo.findById(id);
    if (!exist) {
      res.json({ success: false, message: '审批路由不存在' });
      return;
    }
    routeRepo.remove(id);
    res.json({ success: true, message: '删除成功' });
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

export default router;
