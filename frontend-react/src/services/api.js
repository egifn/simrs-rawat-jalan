import axios from "axios";

export const yiiApi = axios.create({
  baseURL: "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
});

export const nodeApi = axios.create({
  baseURL: "http://localhost:3001/api",
  headers: { "Content-Type": "application/json" },
});

const attachToken = (config) => {
  const token = localStorage.getItem("simrs_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

yiiApi.interceptors.request.use(attachToken);
nodeApi.interceptors.request.use(attachToken);
