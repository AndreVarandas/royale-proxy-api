import { api, handleApiError } from "~/utils/apiHelpers";

export default defineEventHandler(async (event) => {
  try {
    return await api.getGlobalTournaments();
  } catch (error: any) {
    return handleApiError(event, error);
  }
});
