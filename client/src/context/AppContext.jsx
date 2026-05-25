import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getFavoriteIds, addFavorite as apiAddFavorite, removeFavorite as apiRemoveFavorite, getSaasFavoriteIds, addSaasFavorite as apiAddSaasFavorite, removeSaasFavorite as apiRemoveSaasFavorite } from '../services/api';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [searchState, setSearchState] = useState({
    results: [],
    searched: false,
    filters: { term: '', category: '', price: 'all' },
    viewMode: 'grid',
  });

  const [opportunityState, setOpportunityState] = useState({
    results: [],
    searched: false,
    tab: 0,
    category: '',
    sortBy: 'installs',
    sortDir: 'desc',
  });

  const [gemState, setGemState] = useState({
    results: [],
    searched: false,
    category: '',
    sortBy: 'score',
    sortDir: 'desc',
  });

  const [crawlerState, setCrawlerState] = useState({
    status: null,
    gems: [],
    threshold: 40,
    budget: 200,
    sortBy: 'score',
    sortDir: 'desc',
  });

  const [saasFinderState, setSaasFinderState] = useState({
    tab: 0,
    search: '',
    category: '',
    source: '',
    pricingModel: '',
    sortBy: 'date',
    sortDir: 'desc',
  });

  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [saasFavoriteIds, setSaasFavoriteIds] = useState(new Set());

  useEffect(() => {
    getFavoriteIds().then(ids => setFavoriteIds(new Set(ids))).catch(() => {});
    getSaasFavoriteIds().then(ids => setSaasFavoriteIds(new Set(ids))).catch(() => {});
  }, []);

  const isFavorite = useCallback((appId) => favoriteIds.has(appId), [favoriteIds]);

  const toggleFavorite = useCallback(async (app) => {
    const id = app.appId || app.app_id;
    if (!id) return;
    if (favoriteIds.has(id)) {
      setFavoriteIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      await apiRemoveFavorite(id).catch(() => {});
    } else {
      setFavoriteIds(prev => new Set(prev).add(id));
      const normalized = {
        appId: id,
        title: app.title,
        developer: app.developer,
        developerId: app.developerId || app.developer_id,
        icon: app.icon,
        score: app.score,
        minInstalls: app.minInstalls ?? app.min_installs,
        price: app.price,
        free: typeof app.free === 'number' ? !!app.free : app.free,
        offersIAP: typeof app.offers_iap === 'number' ? !!app.offers_iap : (app.offersIAP ?? false),
        category: app.category || app.genre || app.genreId,
        url: app.url,
      };
      await apiAddFavorite(normalized).catch(() => {});
    }
  }, [favoriteIds]);

  const isSaasFavorite = useCallback((id) => saasFavoriteIds.has(id), [saasFavoriteIds]);

  const toggleSaasFavorite = useCallback(async (product) => {
    const id = product.id;
    if (!id) return;
    if (saasFavoriteIds.has(id)) {
      setSaasFavoriteIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      await apiRemoveSaasFavorite(id).catch(() => {});
    } else {
      setSaasFavoriteIds(prev => new Set(prev).add(id));
      await apiAddSaasFavorite({
        id,
        name: product.name,
        url: product.url,
        logoUrl: product.logoUrl,
        category: product.category,
        tagline: product.tagline,
      }).catch(() => {});
    }
  }, [saasFavoriteIds]);

  return (
    <AppContext.Provider value={{
      searchState, setSearchState,
      opportunityState, setOpportunityState,
      gemState, setGemState,
      crawlerState, setCrawlerState,
      saasFinderState, setSaasFinderState,
      favoriteIds, isFavorite, toggleFavorite,
      saasFavoriteIds, isSaasFavorite, toggleSaasFavorite,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
