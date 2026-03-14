import { createContext, useContext, useState } from 'react';

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
  });

  const [gemState, setGemState] = useState({
    results: [],
    searched: false,
    category: '',
  });

  const [crawlerState, setCrawlerState] = useState({
    status: null,
    gems: [],
    threshold: 40,
    budget: 200,
  });

  return (
    <AppContext.Provider value={{ searchState, setSearchState, opportunityState, setOpportunityState, gemState, setGemState, crawlerState, setCrawlerState }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
