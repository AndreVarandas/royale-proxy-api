import { api, handleApiError } from "~/utils/apiHelpers";

export default defineEventHandler(async (event) => {
  const tournamentTag = event.context.params?.tournamentTag;

  if (!tournamentTag) {
    event.node.res.statusCode = 400;

    return { message: "Tournament tag is required" };
  }

  try {
    return await api.getTournamentByTag(`#${tournamentTag}`);
  } catch (error: any) {
    return handleApiError(event, error);
  }
});
