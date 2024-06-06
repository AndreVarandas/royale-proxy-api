import { ClashRoyaleAPI } from "@varandas/clash-royale-api";
import { H3Event } from "h3";

const { CLASH_ROYALE_API_TOKEN } = useRuntimeConfig();

export function handleApiError(event: H3Event, error: any) {
  event.node.res.statusCode = error.response?.status || 500;
  return (
    error.response?.data || {
      message: "An error occurred during the API request",
    }
  );
}

const apiInstance = new ClashRoyaleAPI(CLASH_ROYALE_API_TOKEN);

export const api = apiInstance;
