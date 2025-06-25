import { defineEventHandler, getQuery } from "h3";
import { api, handleApiError } from "~/utils/apiHelpers";

export default defineEventHandler(async (event) => {
  const leaderboardId = event.context.params?.leaderboardId;
  const query = getQuery(event);

  if (!leaderboardId) {
    event.node.res.statusCode = 400;
    return { message: "Leaderboard ID is required" };
  }

  try {
    return await api.getLeaderboardById(Number(leaderboardId), query);
  } catch (error: any) {
    return handleApiError(event, error);
  }
});
