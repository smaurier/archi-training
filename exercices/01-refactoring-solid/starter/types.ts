// Types du domaine — à compléter si besoin
export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerEmail: string;
  customerType: 'standard' | 'vip' | 'employee';
  items: OrderItem[];
  country: string;
  total?: number;
}
