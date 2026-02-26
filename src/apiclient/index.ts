import { Apiclient } from "./Apiclient";
import type { RequestParams } from "./http-client";

type BaseApiParams = Omit<RequestParams, "signal" | "baseUrl" | "cancelToken">;

const constructBaseApiParams = (): BaseApiParams => {
  return {
    credentials: "same-origin",
  };
};

const constructClient = () => {
  const baseApiParams = constructBaseApiParams();

  const baseUrl = import.meta.env.VITE_API_URL || "";
  return new Apiclient({
    baseUrl,
    baseApiParams,
  });
};

const apiclient = constructClient();

export default apiclient;
