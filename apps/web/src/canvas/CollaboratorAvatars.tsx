/**
 * CollaboratorAvatars — TopBar list of remote-presence avatars.
 *
 * Pure presentation: receives the local user id + a list of collaborator
 * presence rows, filters the local user, renders up to 4 inline avatars
 * with a `+N` overflow badge for any remainder. Reuses the existing
 * `UserAvatar` styling indirectly so phase-2 presence colour-coding can
 * be added without touching this component.
 *
 * Spec: canvas-editor — "TopBar displays the current collaborator avatar list"
 */

export interface CollaboratorPresence {
  userId: string;
  name: string;
  image: string | null;
}

export interface CollaboratorAvatarsProps {
  localUserId: string;
  collaborators: CollaboratorPresence[];
}

const MAX_INLINE_AVATARS = 4;

export function CollaboratorAvatars({ localUserId, collaborators }: CollaboratorAvatarsProps) {
  const remote = collaborators.filter((c) => c.userId !== localUserId);
  const inline = remote.slice(0, MAX_INLINE_AVATARS);
  const overflow = remote.length - inline.length;

  if (remote.length === 0) {
    return <div data-testid="collaborator-list" className="flex items-center" />;
  }

  return (
    <div data-testid="collaborator-list" className="flex shrink-0 items-center -space-x-2">
      {inline.map((c) => (
        <Avatar key={c.userId} presence={c} />
      ))}
      {overflow > 0 && (
        <span
          data-testid="collaborator-overflow"
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-warm-sepia text-[11px] font-semibold text-white"
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

function Avatar({ presence }: { presence: CollaboratorPresence }) {
  const initial = presence.name.charAt(0).toUpperCase() || "?";
  const baseClass =
    "flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-ink-navy text-[11px] font-bold text-white";
  if (presence.image) {
    return (
      <img
        data-testid="collaborator-avatar"
        aria-label={presence.name}
        src={presence.image}
        alt=""
        referrerPolicy="no-referrer"
        className={`${baseClass} object-cover`}
        draggable={false}
      />
    );
  }
  return (
    <span data-testid="collaborator-avatar" aria-label={presence.name} className={baseClass}>
      {initial}
    </span>
  );
}
