import { defineEventHandler, getQuery } from "h3";
import { api, handleApiError } from "~/utils/apiHelpers";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  try {
    return await api.getLocations(query);
  } catch (error: any) {
    return handleApiError(event, error);
  }
});
