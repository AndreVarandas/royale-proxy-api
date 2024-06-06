import { api, handleApiError } from "~/utils/apiHelpers";

export default defineEventHandler(async (event) => {
  const { name } = getQuery(event);

  if (!name) {
    event.node.res.statusCode = 400;

    return { message: "Name is required" };
  }

  try {
    return await api.getTournaments({ name: name as string });
  } catch (error: any) {
    return handleApiError(event, error);
  }
});
