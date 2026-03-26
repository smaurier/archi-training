// bff.ts — Backend For Frontend (BFF) pour ShopArch
// Agrège plusieurs microservices en une seule réponse optimisée pour le front.

// Types des micro-services amont

export interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
}

export interface Cart {
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  total: number;
  itemCount: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  loyaltyPoints: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

// Interfaces des services amont

export interface IProductService {
  getPopular(limit: number): Promise<Product[]>;
  getByIds(ids: string[]): Promise<Product[]>;
}

export interface ICartService {
  getCart(userId: string): Promise<Cart | null>;
}

export interface IUserService {
  getProfile(userId: string): Promise<UserProfile | null>;
}

export interface ICategoryService {
  getAll(): Promise<Category[]>;
}

// Réponse BFF agrégée

export interface HomePageResponse {
  user: UserProfile | null;
  cart: Cart | null;
  popularProducts: Product[];
  categories: Category[];
  meta: {
    fetchedAt: number;
    servicesUsed: string[];
  };
}

// ---- À IMPLÉMENTER ----

/**
 * BFFAggregator : exécute tous les appels en parallèle (Promise.allSettled)
 * et compose la réponse finale. Ne doit pas échouer si un service est down.
 */
export class BFFAggregator {
  constructor(
    private readonly products: IProductService,
    private readonly cart: ICartService,
    private readonly users: IUserService,
    private readonly categories: ICategoryService,
  ) {}

  /**
   * Retourne toutes les données de la page d'accueil en un seul appel.
   * - Tous les services sont appelés EN PARALLÈLE (Promise.allSettled)
   * - Si un service échoue → sa partie est null/[] dans la réponse (pas d'erreur globale)
   * - meta.servicesUsed liste les services qui ont répondu avec succès
   */
  async getHomePage(userId: string): Promise<HomePageResponse> {
    // TODO:
    // 1. Promise.allSettled([
    //      users.getProfile(userId),
    //      cart.getCart(userId),
    //      products.getPopular(10),
    //      categories.getAll(),
    //    ])
    // 2. Extraire les résultats : si fulfilled → valeur, si rejected → null/[]
    // 3. Construire meta.servicesUsed à partir des services qui ont réussi
    // 4. Retourner la HomePageResponse
    throw new Error('Not implemented');
  }
}
