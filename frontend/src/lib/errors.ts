import { ApiError } from "../api";

export const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Try again.");
