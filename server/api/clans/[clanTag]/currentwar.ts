import { defineEventHandler } from "h3";
import { api, handleApiError } from "~/utils/apiHelpers";

export default defineEventHandler(async (event) => {
  const clanTag = event.context.params?.clanTag;

  if (!clanTag) {
    event.node.res.statusCode = 400;
    return { message: "Clan tag is required" };
  }

  try {
    return await api.getClanCurrentWar(`#${clanTag}`);
  } catch (error: any) {
    return handleApiError(event, error);
  }
});
