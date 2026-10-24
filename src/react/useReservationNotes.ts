"use client";
import type { HookContext } from "./context";
type AppLocale = string;
const translateUi = (_locale: string, key: string) => key;
import { useState } from "react";
import type { ReservationStatus } from "../sdk/types.gen";
export const EDITABLE_STATUSES: ReservationStatus[] = [
  "Hold",
  "Pending",
  "Confirmed",
];
type ReservationNotesSectionProps = {
  locale: AppLocale;
  notes: string | null | undefined;
  onSave: (notes: string) => void;
  reservationId: string;
  status: ReservationStatus;
};
export const useReservationNotes = (
  {
    locale,
    notes,
    onSave,
    reservationId,
    status,
  }: ReservationNotesSectionProps,
  context: HookContext,
) => {
  const { actionUpdateMyReservationNotes } = context.operations;
  const translateUi = context.translate;
  const {
    PAYMENT_PROVIDER_PUBLIC_KEYS,
    getPaymentProviderLabel,
    isBookingFrontendPaymentProvider,
  } = context.paymentProviders;
  const t = context.translations("myReservations.notes");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEdit = EDITABLE_STATUSES.includes(status);
  const handleEdit = () => {
    setDraft(notes ?? "");
    setError(null);
    setEditing(true);
  };
  const handleCancel = () => {
    setEditing(false);
    setError(null);
  };
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const result = await actionUpdateMyReservationNotes({
      locale,
      reservationId,
      notes: draft,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error || t("errors.save"));
      return;
    }

    onSave(draft.trim());
    setEditing(false);
  };
  return {
    t,
    editing,
    setEditing,
    draft,
    setDraft,
    saving,
    setSaving,
    error,
    setError,
    canEdit,
    handleEdit,
    handleCancel,
    handleSave,
  };
};
