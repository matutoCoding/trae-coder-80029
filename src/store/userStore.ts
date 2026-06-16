import { create } from 'zustand';

export type UserRole = 'student' | 'teacher' | 'admin' | 'approver';

export interface User {
  id: number;
  name: string;
  role: UserRole;
  username?: string;
}

const mockUsers: User[] = [
  { id: 1, name: '张同学', role: 'student', username: 'stu001' },
  { id: 2, name: '李老师', role: 'teacher', username: 'tea001' },
  { id: 3, name: '王主任', role: 'approver', username: 'app001' },
  { id: 4, name: '赵管理员', role: 'admin', username: 'adm001' },
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
    if (user) {
      set({ currentUser: user });
    }
  },
  loginAs: (user: User) => {
    set({ currentUser: user });
  },
  logout: () => {
    set({ currentUser: defaultUser });
  },
}));
