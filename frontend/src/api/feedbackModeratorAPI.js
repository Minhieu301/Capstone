import api from "./api";

export const getAllFeedbackModerator = async () => {
  const res = await api.get("/moderator/feedback");
  return res.data; 
};

export const markFeedbackForwarded = async (id) => {
  const res = await api.post(`/moderator/feedback/${id}/forward`);
  return res.data;
};

export const markFeedbackResolved = async (id) => {
  try {
    const res = await api.post(`/moderator/feedback/${id}/resolve`);
    return res.data;
  } catch (error) {
    // Fallback for legacy endpoint using PUT in some environments
    const res = await api.put(`/moderator/feedback/${id}/resolve`);
    return res.data;
  }
};

