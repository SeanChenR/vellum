/**
 * UserAvatar — circular avatar showing the user's image when available,
 * otherwise the first letter of their display name (or email fallback).
 */

import type { AuthUser } from "../auth/useAuth";

export interface UserAvatarProps {
  user: AuthUser;
  className?: string;
}

export function UserAvatar({ user, className = "" }: UserAvatarProps) {
  const base =
    "flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-ink-navy text-xs font-bold text-white";
  const merged = className ? `${base} ${className}` : base;

  if (user.image) {
    return (
      <img
        src={user.image}
        alt=""
        referrerPolicy="no-referrer"
        className={`${merged} object-cover`}
        draggable={false}
      />
    );
  }

  const initial = (user.name || user.email).charAt(0).toUpperCase();
  return <span className={merged}>{initial}</span>;
}
