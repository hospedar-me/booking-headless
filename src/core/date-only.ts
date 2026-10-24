type DateOnlyFormatOptions = Intl.DateTimeFormatOptions;

export const parseDateOnly = (value?: string | null): Date | undefined => {
  if (!value) return undefined;

  const [datePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return date;
};

export const formatDateOnly = (
  value: string,
  options?: DateOnlyFormatOptions,
  locale = "pt-BR",
) => {
  const date = parseDateOnly(value);
  if (!date) return value;

  return new Intl.DateTimeFormat(locale, options).format(date);
};

export const isConfirmedReservationStatus = (status: string): boolean =>
  status === "Confirmed";
