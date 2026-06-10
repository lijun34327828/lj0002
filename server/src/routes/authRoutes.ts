import { Router, Request, Response } from 'express';
import { register, login, getUserProfile, changePassword, getUsers } from '../services/userService';
import { authMiddleware, AuthRequest, roleMiddleware } from '../middleware/auth';

const router = Router();

router.post('/register', (req: Request, res: Response) => {
  try {
    const { username, email, password, realName, role } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    const result = register({ username, email, password, realName, role });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    const result = login(username, password);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

router.get('/profile', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const user = getUserProfile(req.userId!);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/password', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '原密码和新密码不能为空' });
    }
    
    const success = changePassword(req.userId!, oldPassword, newPassword);
    res.json({ success });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', authMiddleware, roleMiddleware('admin'), (req: AuthRequest, res: Response) => {
  try {
    const { role, keyword, page, pageSize } = req.query;
    const result = getUsers({
      role: role as string,
      keyword: keyword as string,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
