import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({ baseURL: API_BASE });

export async function searchApps(params) {
  const { data } = await api.get('/search', { params });
  return data;
}

export async function getAppDetail(appId) {
  const { data } = await api.get(`/app/${encodeURIComponent(appId)}`);
  return data;
}

export async function getSimilarApps(appId) {
  const { data } = await api.get(`/app/${encodeURIComponent(appId)}/similar`);
  return data;
}

export async function getDeveloperInfo(devId) {
  const { data } = await api.get(`/developer/${encodeURIComponent(devId)}`);
  return data;
}

export async function getCategories() {
  const { data } = await api.get('/categories');
  return data;
}

export async function getLowRated(params) {
  const { data } = await api.get('/opportunities/low-rated', { params });
  return data;
}

export async function getSoloDev(params) {
  const { data } = await api.get('/opportunities/solo-dev', { params });
  return data;
}

export async function getNicheProfitable(params) {
  const { data } = await api.get('/opportunities/niche-profitable', { params });
  return data;
}

export async function getTrending(params) {
  const { data } = await api.get('/opportunities/trending', { params });
  return data;
}

export async function getGems(params) {
  const { data } = await api.get('/opportunities/gems', { params });
  return data;
}

export async function startCrawl(body) {
  const { data } = await api.post('/crawler/start', body);
  return data;
}

export async function getCrawlStatus() {
  const { data } = await api.get('/crawler/status');
  return data;
}

export async function getCrawledGems(params) {
  const { data } = await api.get('/crawler/gems', { params });
  return data;
}

export async function dismissCrawledApp(appId) {
  const { data } = await api.post(`/crawler/dismiss/${encodeURIComponent(appId)}`);
  return data;
}

export async function resetCrawl() {
  const { data } = await api.post('/crawler/reset');
  return data;
}
