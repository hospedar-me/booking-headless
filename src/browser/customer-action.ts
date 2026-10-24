import type { BookingEngineCustomerAction } from "../sdk/types.gen";

export type BookingCustomerActionSubmission =
  | {
      method: "get";
      url: string;
    }
  | {
      fields: Record<string, string>;
      method: "post";
      url: string;
    };

export const isBookingCustomerActionExpired = (
  action: BookingEngineCustomerAction,
  now = Date.now(),
) => {
  if (!action.expiresAt) return false;

  const expiresAt = Date.parse(action.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now;
};

export const buildBookingCustomerActionSubmission = (
  action: BookingEngineCustomerAction,
  currentUrl: string,
): BookingCustomerActionSubmission => {
  if (action.method === "post") {
    return {
      fields: { ...action.fields },
      method: "post",
      url: new URL(action.url, currentUrl).toString(),
    };
  }

  const url = new URL(action.url, currentUrl);
  Object.entries(action.fields).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return {
    method: "get",
    url: url.toString(),
  };
};

export const executeBookingCustomerAction = (
  action: BookingEngineCustomerAction,
) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Customer action can only be executed in the browser.");
  }

  if (isBookingCustomerActionExpired(action)) {
    throw new Error("Customer action has expired.");
  }

  const submission = buildBookingCustomerActionSubmission(
    action,
    window.location.href,
  );

  if (submission.method === "get") {
    window.location.assign(submission.url);
    return;
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = submission.url;
  form.acceptCharset = "UTF-8";
  form.style.display = "none";

  Object.entries(submission.fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
};
