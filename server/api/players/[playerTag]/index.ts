import { defineEventHandler } from "h3";
import { api, handleApiError } from "~/utils/apiHelpers";

export default defineEventHandler(async (event) => {
  const playerTag = event.context.params?.playerTag;

  if (!playerTag) {
    event.node.res.statusCode = 400;

    return { message: "Player tag is required" };
  }

  try {
    return api.getPlayerByTag(`#${playerTag}`);
  } catch (error: any) {
    return handleApiError(event, error);
  }
});
