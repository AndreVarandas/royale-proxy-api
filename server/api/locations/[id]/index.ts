import { defineEventHandler } from "h3";
import { api, handleApiError } from "~/utils/apiHelpers";

export default defineEventHandler(async (event) => {
  const locationId = event.context.params?.id;

  if (!locationId) {
    event.node.res.statusCode = 400;
    return { message: "Location ID is required" };
  }

  try {
    return await api.getLocationById(locationId);
  } catch (error: any) {
    return handleApiError(event, error);
  }
});
