
export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "CANCELLED";

export interface Order {
  id: string;
  customerName: string;
  email: string;
  status: OrderStatus;
  totalAmount: string;
  createdAt: string;
  _count: {
    items: number;
  };
}

export interface OrdersResponse {
  data: Order[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
