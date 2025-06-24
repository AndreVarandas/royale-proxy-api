import { defineEventHandler, getQuery } from "h3";
import { api, handleApiError } from "~/utils/apiHelpers";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  if (!query.name) {
    event.node.res.statusCode = 400;
    return { message: "Clan name is required" };
  }

  try {
    return await api.getClans(query);
  } catch (error: any) {
    return handleApiError(event, error);
  }
});
