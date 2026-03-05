// Domain events pour le pattern CQRS

export type DomainEvent =
  | { type: 'ProductCreated'; payload: { id: string; name: string; price: number; stock: number } }
  | { type: 'ProductPriceUpdated'; payload: { id: string; oldPrice: number; newPrice: number } }
  | { type: 'ProductStockDecremented'; payload: { id: string; quantity: number; newStock: number } }
  | { type: 'OrderPlaced'; payload: { orderId: string; items: Array<{ productId: string; quantity: number; unitPrice: number }> } };
