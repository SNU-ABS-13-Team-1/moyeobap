export interface Menu {
  name: string;
  price: string;
}

export interface Restaurant {
  id: string;
  name: string;
  emoji: string;
  category: 'lunch' | 'cafe';
  minOrder: number;
  deliveryTime: string;
  menus: Menu[];
}

export interface User {
  id: string;
  name: string;
  initial: string;
}

export interface Pot {
  id: string;
  restaurantId: string;
  deadline: Date;
  participants: User[];
  status: 'active' | 'closed' | 'failed';
}

export interface ToastNotice {
  message: string;
  type: 'success' | 'warning' | 'error';
}
