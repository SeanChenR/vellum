/**
 * ProfileTab — `/account?tab=profile` panel content.
 *
 * Extracted from `ProfilePage.tsx` so AccountPage can mount it as one of
 * four tab panels (see design Decision 10 / spec
 * "Account settings live under a single tabbed route").
 *
 * The outer `max-w-7xl` page container lives in AccountPage; this
 * component only owns the inner form column.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
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
    }),
  });
  const body = (await resp.json()) as ProfileResponse;
  if (!resp.ok) throw new Error(body.error?.errorKey ?? "patch failed");
  return body.data!;
}

export function ProfileTab() {
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
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: profile
      ? {
          name: profile.name,
          image: profile.image ?? "",
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: patchProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(["account", "profile"], updated);
      void queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
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
        <span className="text-text-muted">{t("common.loading")}</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Card variant="elevated" data-testid="profile-form-card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted"
            >
              {t("account.profile.nameLabel")}
            </label>
            <input
              id="name"
              type="text"
              placeholder={t("account.profile.namePlaceholder")}
              className="focus-visible-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted"
              {...register("name")}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-accent-red">{t(errors.name.message ?? "")}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="image"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted"
            >
              {t("account.profile.imageLabel")}
            </label>
            <input
              id="image"
              type="url"
              placeholder={t("account.profile.imagePlaceholder")}
              className="focus-visible-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted"
              {...register("image")}
            />
            {errors.image && (
              <p data-testid="image-error" className="mt-1 text-xs text-accent-red">
                {t(errors.image.message ?? "account.errors.invalidImageUrl")}
              </p>
            )}
          </div>

          <div>
            <p className="text-sm text-text-muted">{profile?.email}</p>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full"
            disabled={isSubmitting || mutation.isPending}
          >
            {t("account.profile.saveButton")}
          </Button>

          {mutation.isSuccess && (
            <p className="text-center text-sm text-accent-cyan">
              {t("account.profile.saveSuccess")}
            </p>
          )}
        </form>
      </Card>

      <section className="border-t border-border pt-6">
        <h2 className="text-base font-semibold text-accent-red">
          {t("account.deleteAccount.title")}
        </h2>
        <p className="mt-2 text-sm text-text-muted">{t("account.deleteAccount.warning")}</p>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="mt-4"
          onClick={() => setDeleteDialogOpen(true)}
        >
          {t("account.deleteAccount.confirmButton")}
        </Button>
      </section>

      <DeleteAccountDialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} />
    </div>
  );
}
