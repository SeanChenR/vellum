/**
 * ProfilePage — edit display name, avatar URL, and locale preference.
 *
 * - GET /api/account/profile on mount (via TanStack Query)
 * - PATCH /api/account/profile on submit
 * - Image must be https:// or null; otherwise shows account.errors.invalidImageUrl
 * - Locale persists to the server and updates i18n immediately
 *
 * Visual styling: preview-iteration (not TDD scope).
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import i18n from "../i18n";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

const profileSchema = z.object({
  name: z.string().min(1).max(80),
  image: z
    .string()
    .refine(
      (v) => {
        if (!v) return true;
        try {
          return new URL(v).protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "account.errors.invalidImageUrl" },
    )
    .or(z.literal(""))
    .optional(),
  locale: z.enum(["zh-TW", "en"]).optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

interface ProfileData {
  id: string;
  email: string;
  name: string;
  image: string | null;
  locale: string;
  createdAt: string;
}

interface ProfileResponse {
  data?: ProfileData;
  error?: { errorKey: string };
}

async function fetchProfile(): Promise<ProfileData> {
  const resp = await fetch("/api/account/profile");
  const body = (await resp.json()) as ProfileResponse;
  if (!resp.ok || !body.data) throw new Error("fetch profile failed");
  return body.data;
}

async function patchProfile(data: ProfileForm): Promise<ProfileData> {
  const resp = await fetch("/api/account/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: data.name,
      image: data.image || null,
      locale: data.locale,
    }),
  });
  const body = (await resp.json()) as ProfileResponse;
  if (!resp.ok) throw new Error(body.error?.errorKey ?? "patch failed");
  return body.data!;
}

export function ProfilePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["account", "profile"],
    queryFn: fetchProfile,
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: profile
      ? {
          name: profile.name,
          image: profile.image ?? "",
          locale: profile.locale as "zh-TW" | "en",
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: patchProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(["account", "profile"], updated);
      void queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
      if (updated.locale === "en" || updated.locale === "zh-TW") {
        void i18n.changeLanguage(updated.locale);
      }
    },
    onError: (err) => {
      const errorKey = err instanceof Error ? err.message : "account.errors.saveFailed";
      setError("image", { message: errorKey });
    },
  });

  const onSubmit = (values: ProfileForm) => {
    mutation.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <span className="text-warm-sepia">Loading…</span>
      </div>
    );
  }

  return (
    <div>
      <main className="mx-auto w-full max-w-lg px-6 py-10">
        <h1 className="font-serif text-2xl text-ink-navy mb-8">{t("account.profile.title")}</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              {t("account.profile.nameLabel")}
            </label>
            <input
              id="name"
              type="text"
              placeholder={t("account.profile.namePlaceholder")}
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ink-navy"
              {...register("name")}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{t(errors.name.message ?? "")}</p>
            )}
          </div>

          {/* Image URL */}
          <div>
            <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
              {t("account.profile.imageLabel")}
            </label>
            <input
              id="image"
              type="url"
              placeholder={t("account.profile.imagePlaceholder")}
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ink-navy"
              {...register("image")}
            />
            {errors.image && (
              <p data-testid="image-error" className="mt-1 text-sm text-red-600">
                {t(errors.image.message ?? "account.errors.invalidImageUrl")}
              </p>
            )}
          </div>

          {/* Locale */}
          <div>
            <label htmlFor="locale" className="block text-sm font-medium text-gray-700 mb-1">
              {t("account.profile.localeLabel")}
            </label>
            <select
              id="locale"
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-ink-navy"
              {...register("locale")}
            >
              <option value="zh-TW">繁體中文</option>
              <option value="en">English</option>
            </select>
          </div>

          {/* Email (read-only) */}
          <div>
            <p className="text-sm text-gray-500">{profile?.email}</p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="w-full rounded-lg bg-ink-navy px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("account.profile.saveButton")}
          </button>

          {mutation.isSuccess && (
            <p className="text-center text-sm text-green-600">{t("account.profile.saveSuccess")}</p>
          )}
        </form>

        {/* Danger zone: account deletion. Lives at the bottom of the page so it
          stays out of normal-flow tab order; the dialog is the single trigger
          for DELETE /api/account. */}
        <section className="mt-12 border-t border-red-200 pt-6">
          <h2 className="text-base font-semibold text-red-700">
            {t("account.deleteAccount.title")}
          </h2>
          <p className="mt-2 text-sm text-warm-sepia">{t("account.deleteAccount.warning")}</p>
          <button
            type="button"
            onClick={() => setDeleteDialogOpen(true)}
            className="mt-4 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            {t("account.deleteAccount.confirmButton")}
          </button>
        </section>

        <DeleteAccountDialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} />
      </main>
    </div>
  );
}
