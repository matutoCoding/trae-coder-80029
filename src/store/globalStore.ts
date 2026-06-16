import { create } from 'zustand';

export interface BreadcrumbItem {
  title: string;
  path?: string;
}

interface GlobalState {
  sidebarCollapsed: boolean;
  breadcrumbs: BreadcrumbItem[];
  pageTitle: string;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void;
  setPageTitle: (title: string) => void;
}

export const useGlobalStore = create<GlobalState>((set) => ({
  sidebarCollapsed: false,
  breadcrumbs: [{ title: '首页', path: '/dashboard' }],
  pageTitle: '仪表盘',
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed: boolean) =>
    set({ sidebarCollapsed: collapsed }),
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => set({ breadcrumbs }),
  setPageTitle: (title: string) => set({ pageTitle: title }),
}));
