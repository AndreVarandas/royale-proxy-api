import { defineEventHandler, getQuery } from "h3";
import { api, handleApiError } from "~/utils/apiHelpers";

export default defineEventHandler(async (event) => {
  const locationId = event.context.params?.id;
  const query = getQuery(event);

  if (!locationId) {
    event.node.res.statusCode = 400;
    return { message: "Location ID is required" };
  }

  try {
    const params = { ...query, locationId };
    return await api.getPlayerRankingsForLocation(locationId, params);
  } catch (error: any) {
    return handleApiError(event, error);
  }
});
