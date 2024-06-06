import { api, handleApiError } from "~/utils/apiHelpers";

export default defineEventHandler(async (event) => {
  try {
    return await api.getCards();
  } catch (error: any) {
    return handleApiError(event, error);
  }
});
