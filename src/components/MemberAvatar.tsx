import React from 'react';
import {
  AvatarMember,
  AvatarPreference,
  getAvatarColorOption,
  getAvatarIconOption,
  useMemberAvatarPreference,
} from '../lib/avatarPreferences';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface MemberAvatarProps {
  member?: AvatarMember | null;
  size?: AvatarSize;
  className?: string;
  preferenceOverride?: AvatarPreference;
}

const avatarSizeClasses: Record<AvatarSize, string> = {
  xs: 'h-7 w-7 rounded-xl',
  sm: 'h-8 w-8 rounded-xl',
  md: 'h-10 w-10 rounded-2xl',
  lg: 'h-12 w-12 rounded-2xl',
  xl: 'h-16 w-16 rounded-[22px]',
};

const iconSizeClasses: Record<AvatarSize, string> = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
};

export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  member,
  size = 'md',
  className = '',
  preferenceOverride,
}) => {
  const { preference } = useMemberAvatarPreference(member);
  const activePreference = preferenceOverride ?? preference;
  const iconOption = getAvatarIconOption(activePreference.icon);
  const colorOption = getAvatarColorOption(activePreference.color);
  const Icon = iconOption.Icon;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${avatarSizeClasses[size]} ${className}`}
      style={{
        backgroundColor: colorOption.background,
        color: colorOption.foreground,
        boxShadow: `0 0 0 1px ${colorOption.ring}, 0 6px 18px rgba(15, 23, 42, 0.12)`,
      }}
      aria-hidden="true"
    >
      <Icon className={iconSizeClasses[size]} strokeWidth={2.15} />
    </span>
  );
};
