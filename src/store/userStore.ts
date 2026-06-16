import { create } from 'zustand';
import type { User, UserRole } from 'shared/types';

const mockUsers: User[] = [
  { id: 1, name: '张同学', account: 'stu001', role: 'student', department: '化学学院', createdAt: '' },
  { id: 2, name: '李同学', account: 'stu002', role: 'student', department: '物理学院', createdAt: '' },
  { id: 3, name: '王导师', account: 'tut001', role: 'tutor', department: '化学学院', createdAt: '' },
  { id: 4, name: '赵导师', account: 'tut002', role: 'tutor', department: '物理学院', createdAt: '' },
  { id: 5, name: '陈管理员', account: 'adm001', role: 'admin', department: '实验中心', createdAt: '' },
  { id: 6, name: '刘安全员', account: 'saf001', role: 'safety', department: '安全办公室', createdAt: '' },
];

interface UserState {
  currentUser: User;
  users: User[];
  switchUser: (userId: number) => void;
  loginAs: (user: User) => void;
  logout: () => void;
}

const defaultUser: User = mockUsers[0];

export const useUserStore = create<UserState>((set) => ({
  currentUser: defaultUser,
  users: mockUsers,
  switchUser: (userId: number) => {
    const user = mockUsers.find((u) => u.id === userId);
    if (user) set({ currentUser: user });
  },
  loginAs: (user: User) => set({ currentUser: user }),
  logout: () => set({ currentUser: defaultUser }),
}));
